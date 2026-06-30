import { View, Text, StyleSheet, useColorScheme, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function App() {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Flexbox 布局演示</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.muted }]}>暗黑模式</Text>
          <Switch value={isDark} onValueChange={setIsDark} trackColor={{ false: '#ccc', true: '#6c63ff' }} />
        </View>
      </View>

      {/* 主轴 justifyContent 演示 */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>justifyContent: space-around</Text>
      <View style={[styles.row, { justifyContent: 'space-around', backgroundColor: theme.card }]}>
        <View style={[styles.box, { backgroundColor: '#ff6b6b' }]} />
        <View style={[styles.box, { backgroundColor: '#4ecdc4' }]} />
        <View style={[styles.box, { backgroundColor: '#45b7d1' }]} />
      </View>

      {/* 交叉轴 alignItems 演示 */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>alignItems: center + 不同高度</Text>
      <View style={[styles.row, { alignItems: 'center', backgroundColor: theme.card }]}>
        <View style={[styles.boxSm, { backgroundColor: '#ff6b6b' }]} />
        <View style={[styles.boxMd, { backgroundColor: '#4ecdc4' }]} />
        <View style={[styles.boxSm, { backgroundColor: '#45b7d1' }]} />
      </View>

      {/* flexWrap 演示 */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>flexWrap: wrap</Text>
      <View style={[styles.row, { flexWrap: 'wrap', backgroundColor: theme.card }]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.box, { backgroundColor: `hsl(${i * 60}, 70%, 60%)`, margin: 6 }]} />
        ))}
      </View>

      {/* flex 比例演示 */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>flex 比例 (1:2:1)</Text>
      <View style={[styles.row, { backgroundColor: theme.card }]}>
        <View style={[styles.flexBox, { flex: 1, backgroundColor: '#ff6b6b' }]}><Text style={styles.flexText}>1</Text></View>
        <View style={[styles.flexBox, { flex: 2, backgroundColor: '#4ecdc4' }]}><Text style={styles.flexText}>2</Text></View>
        <View style={[styles.flexBox, { flex: 1, backgroundColor: '#45b7d1' }]}><Text style={styles.flexText}>1</Text></View>
      </View>
    </SafeAreaView>
  );
}

const lightTheme = { bg: '#f5f5f5', text: '#1a1a2e', muted: '#666', card: '#fff' };
const darkTheme = { bg: '#1a1a2e', text: '#eee', muted: '#aaa', card: '#2a2a4e' };

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', borderRadius: 12, padding: 12, minHeight: 80 },
  box: { width: 40, height: 40, borderRadius: 8 },
  boxSm: { width: 30, height: 30, borderRadius: 6 },
  boxMd: { width: 40, height: 60, borderRadius: 8 },
  flexBox: { justifyContent: 'center', alignItems: 'center', borderRadius: 6, margin: 2 },
  flexText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
