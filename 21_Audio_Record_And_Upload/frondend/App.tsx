import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAudioRecorder, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { deleteAsync, uploadAsync, FileSystemUploadType, cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';

type RecordState = 'idle' | 'recording' | 'uploading';
interface LogEntry { ts: string; msg: string; level: 'info' | 'warn' | 'error'; }

const UPLOAD_URL = 'http://192.168.5.5:3000/upload';

export default function App() {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // 停止录音时等待原生层 isFinished 信号的文件 URI 回调
  const stopResolveRef = useRef<((uri: string) => void) | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = (msg: string, level: LogEntry['level'] = 'info') => {
    const ts = new Date().toLocaleTimeString();
    console[level](`${ts} [${level.toUpperCase()}] ${msg}`);
    setLogs(prev => [...prev.slice(-49), { ts, msg, level }]);
  };

  // statusListener: 录音中记录时长，isFinished=true 时触发停止回调
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.isFinished) {
      // 录音完成，文件落盘完毕，通知等待中的 Promise
      add('   ⚡ 原生层 isFinished 信号到达，文件落盘完成', 'warn');
      if (stopResolveRef.current) {
        stopResolveRef.current(status.url || '');
        stopResolveRef.current = null;
      }
      return;
    }
    const recState = recorder.getStatus();
    add(`   录音中... ${(recState.durationMillis / 1000).toFixed(1)}s`, 'warn');
  });

  const startRecording = async () => {
    add('🎤 请求麦克风权限...');
    try {
      const perm = await requestRecordingPermissionsAsync();
      add(`   权限结果: granted=${perm.granted}, status=${perm.status}`);
      if (!perm.granted) {
        add('❌ 麦克风权限被拒绝', 'error');
        Alert.alert('权限', '需要麦克风权限才能录音');
        return;
      }

      add('🔧 设置音频模式...');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      add('🔴 准备录音 (HIGH_QUALITY)...');
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordState('recording');
      setFileUri(null);
      setUploadResult(null);
      add('✅ 录音已启动');
    } catch (err: any) {
      add(`❌ 录音启动异常: ${err.message}`, 'error');
      Alert.alert('错误', `录音启动失败: ${err.message}`);
    }
  };

  const stopRecordingAndUpload = async () => {
    add('⏹ 发起停止录音...');

    // 创建 Promise 等待原生层 isFinished=true 信号
    const stopPromise = new Promise<string>((resolve, reject) => {
      stopTimerRef.current = setTimeout(() => {
        stopResolveRef.current = null;
        reject(new Error('停止录音超时（5秒无 isFinished 信号，请杀后台重试）'));
      }, 5000);

      // 检查是不是已经 isFinished 了（极端情况：同步完成）
      const immediateStatus = recorder.getStatus();
      const immediateUrl = immediateStatus.url || (recorder as any).uri || '';
      if (!immediateStatus.isRecording && immediateUrl && immediateUrl.length > 0) {
        // 检查 RecordingStatus.url 是否已就绪
        clearTimeout(stopTimerRef.current!);
        resolve(immediateUrl);
        return;
      }

      stopResolveRef.current = (uri: string) => {
        clearTimeout(stopTimerRef.current!);
        if (!uri) {
          // fallback：从 getStatus 拿
          const s = recorder.getStatus();
          resolve(s.url || (recorder as any).uri || '');
          return;
        }
        resolve(uri);
      };
    });

    recorder.stop();

    let uri: string;
    try {
      uri = await stopPromise;
    } catch (err: any) {
      add(`❌ ${err.message}`, 'error');
      setRecordState('idle');
      return;
    }

    if (!uri || uri.length === 0) {
      add('❌ 录音文件 URI 为空', 'error');
      setRecordState('idle');
      return;
    }

    add(`✅ 录音停止，文件 URI: ${uri}`);
    setFileUri(uri);
    setRecordState('uploading');

    try {
      add(`📤 expo封装的原生上传方案 → ${UPLOAD_URL}`);
      const startTime = Date.now();
      const result = await uploadAsync(UPLOAD_URL, uri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'audio/m4a',
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (result.status >= 400) {
        add(`❌ 服务端 ${result.status}: ${result.body}`, 'error');
        setUploadResult(`HTTP ${result.status}: ${result.body}`);
        return;
      }

      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      add(`✅ 上传成功 (耗时 ${elapsed}s)`);
      add(`   响应: ${JSON.stringify(body)}`);
      setUploadResult(JSON.stringify(body));

      try {
        await deleteAsync(uri, { idempotent: true });
      } catch {} // 私有缓存可能无删权限
    } catch (err: any) {
      const detail = err.message || String(err);
      // isn't readable 场景：expo-audio 私有缓存 → JS 侧读取 → 写入公共目录 → 再调原生上传
      if (detail.includes("isn't readable") || detail.includes('not readable')) {
        add('⚠ 原生层无文件读权限，启动 JS 桥接策略...', 'warn');
        try {
          // JS fetch → arrayBuffer → 纯 JS base64（零 Blob 依赖）
          add('   fetch 读取私有文件...');
          const resp = await fetch(uri);
          const arrayBuffer = await resp.arrayBuffer();
          // 手动 ArrayBuffer → base64，不依赖 Blob 或 FileReader
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const publicUri = cacheDirectory + `bridge_${Date.now()}.m4a`;
          add('   base64 写入公共缓存...');
          await writeAsStringAsync(publicUri, base64, { encoding: EncodingType.Base64 });

          add('   原生上传公共缓存文件...');
          const result = await uploadAsync(UPLOAD_URL, publicUri, {
            httpMethod: 'POST',
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            mimeType: 'audio/m4a',
          });

          const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
          add(`✅ 桥接上传成功`);
          add(`   响应: ${JSON.stringify(body)}`);
          setUploadResult(JSON.stringify(body));

          // 清理文件：仅删公共副本，私有缓存无删除权限（系统自动回收）
          await deleteAsync(publicUri, { idempotent: true });
          try { await deleteAsync(uri, { idempotent: true }); } catch {} // 私有缓存删不掉无所谓
        } catch (bridgeErr: any) {
          add(`❌ 桥接上传也失败: ${bridgeErr.message}`, 'error');
          add('   💡 请彻底杀掉 Expo Go 后台重新扫码', 'warn');
          setUploadResult(`上传失败: ${bridgeErr.message}`);
        }
      } else {
        add(`❌ 上传失败: ${detail}`, 'error');
        if (detail.includes('Network request failed')) {
          add('   💡 检查: 1)后端启动 2)IP正确 3)同局域网', 'warn');
        }
        setUploadResult(`上传失败: ${detail}`);
      }
    } finally {
      setRecordState('idle');
    }
  };

  const handlePress = () => {
    if (recordState === 'recording') stopRecordingAndUpload();
    else if (recordState === 'idle') startRecording();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>录音上传闭环演示</Text>
      <Text style={styles.subtitle}>expo-audio + isFinished + uploadAsync 原生上传</Text>

      <View style={styles.statusCard}>
        {recordState === 'recording' && (
          <>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>正在录音...</Text>
          </>
        )}
        {recordState === 'uploading' && (
          <>
            <ActivityIndicator size="small" color="#6c63ff" />
            <Text style={styles.uploadingText}>正在上传...</Text>
          </>
        )}
        {recordState === 'idle' && (
          <Text style={styles.idleText}>{fileUri ? '上一次录音已就绪' : '点击按钮开始录音'}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, recordState === 'recording' && styles.buttonRecording]}
        onPress={handlePress}
        disabled={recordState === 'uploading'}
      >
        <Text style={styles.buttonText}>
          {recordState === 'recording' ? '停止并上传' : recordState === 'uploading' ? '上传中...' : '开始录音'}
        </Text>
      </TouchableOpacity>

      {uploadResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>服务端响应:</Text>
          <Text style={styles.resultBody}>{uploadResult}</Text>
        </View>
      )}

      <Text style={styles.logTitle}>运行日志 ({logs.length})</Text>
      <ScrollView style={styles.logPanel} contentContainerStyle={styles.logContent}>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>等待操作...</Text>
        ) : (
          logs.map((entry, i) => (
            <Text key={i} style={[styles.logLine, logColors[entry.level]]}>{entry.ts} {entry.msg}</Text>
          ))
        )}
      </ScrollView>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>竞态防护策略</Text>
        <Text>1. 不轮询 isRecording，等原生 isFinished 信号确保落盘</Text>
        <Text>2. uploadAsync 原生层直传 + isn't readable 自动 fallback JS 桥接</Text>
        <Text>3. expo-audio 模块名 ExpoAudio，非老版 ExponentAV</Text>
      </View>
    </SafeAreaView>
  );
}

const logColors: Record<string, any> = {
  info: { color: '#333' },
  warn: { color: '#f59e0b' },
  error: { color: '#ef4444' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6c63ff', textAlign: 'center', marginBottom: 14 },
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 14, elevation: 2 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 },
  recordingText: { fontSize: 15, color: '#ef4444', fontWeight: '600' },
  uploadingText: { fontSize: 15, color: '#6c63ff', fontWeight: '600', marginLeft: 8 },
  idleText: { fontSize: 13, color: '#666' },
  button: { backgroundColor: '#6c63ff', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  buttonRecording: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultCard: { backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginBottom: 10 },
  resultTitle: { fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 2 },
  resultBody: { fontSize: 12, color: '#555', fontFamily: 'monospace' },
  logTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 4 },
  logPanel: { flex: 1, backgroundColor: '#1e1e2e', borderRadius: 8, marginBottom: 8 },
  logContent: { padding: 8 },
  logEmpty: { color: '#666', fontSize: 12 },
  logLine: { fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  note: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 10 },
  noteTitle: { fontSize: 13, fontWeight: '700', color: '#856404', marginBottom: 4 },
});
