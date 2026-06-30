import { View, Text, Image, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const logo = { uri: 'https://docs.expo.dev/static/images/tutorial/logo.png' };

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.card}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Expo 环境搭建与核心组件</Text>
        <Text style={styles.subtitle}>View / Text / Image / SafeAreaView</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>
          Expo 是一个基于 React Native 的跨平台开发框架，提供了从开发、构建到发布的一站式工具链。
          核心组件 View 等同于 div，Text 用于渲染文字，Image 加载图片，SafeAreaView 适配刘海屏。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginHorizontal: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  logo: { width: 120, height: 120, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', color: '#6c63ff', marginTop: 4 },
  divider: { width: 60, height: 3, backgroundColor: '#6c63ff', borderRadius: 2, marginVertical: 16 },
  body: { fontSize: 14, lineHeight: 22, color: '#444', textAlign: 'center' },
});
