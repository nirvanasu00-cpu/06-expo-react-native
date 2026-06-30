import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const STORAGE_KEY = 'todos';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  // useEffect: 模拟从 AsyncStorage 加载数据
  useEffect(() => {
    const timer = setTimeout(() => {
      setTodos([
        { id: '1', text: '了解 useState 状态管理', done: true },
        { id: '2', text: '掌握 useEffect 生命周期', done: true },
        { id: '3', text: '学习 useCallback 性能优化', done: false },
        { id: '4', text: '实践自定义 Hooks', done: false },
      ]);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // useEffect: 监听 todos 变化
  useEffect(() => {
    if (!loading) {
      console.log(`[Hooks Demo] Todos 已更新，共 ${todos.length} 项`);
    }
  }, [todos, loading]);

  const addTodo = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入待办事项');
      return;
    }
    setTodos(prev => [...prev, { id: Date.now().toString(), text: trimmed, done: false }]);
    setInput('');
  }, [input]);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={styles.loadingText}>加载中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>React Hooks 移动端实践</Text>
      <Text style={styles.subtitle}>useState / useEffect / useCallback</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="输入待办事项..."
          placeholderTextColor="#999"
          onSubmitEditing={addTodo}
        />
        <Button title="添加" onPress={addTodo} color="#6c63ff" />
      </View>

      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.todoItem, item.done && styles.todoDone]}>
            <Text
              style={[styles.todoText, item.done && styles.todoTextDone]}
              onPress={() => toggleTodo(item.id)}
            >
              {item.done ? '✓ ' : '○ '}{item.text}
            </Text>
          </View>
        )}
      />
      <Text style={styles.footer}>点击事项切换完成状态 | 共 {todos.length} 项</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6c63ff', textAlign: 'center', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, height: 44, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#fff' },
  list: { paddingBottom: 20 },
  todoItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#6c63ff' },
  todoDone: { borderLeftColor: '#4ecdc4', opacity: 0.7 },
  todoText: { fontSize: 16, color: '#333' },
  todoTextDone: { textDecorationLine: 'line-through', color: '#999' },
  footer: { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 8 },
});
