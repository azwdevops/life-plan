import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import { TasksScreen } from './src/screens/TasksScreen';
import { AudioScheduleScreen } from './src/screens/AudioScheduleScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LeftSidebar } from './src/components/LeftSidebar';

type Route = 'tasks' | 'alarms' | 'settings';
type Tab = 'tasks' | 'alarms';

const TABS: { key: Tab; label: string; icon: string; color: keyof typeof colors.light }[] = [
  { key: 'tasks', label: 'Tasks', icon: '☑', color: 'accent' },
  { key: 'alarms', label: 'Alarms', icon: '⏰', color: 'secondary' },
];

const SIDEBAR_ITEMS: { key: Route; label: string; icon: string; color: keyof typeof colors.light }[] = [
  ...TABS,
  { key: 'settings', label: 'Settings', icon: '⚙', color: 'textMuted' },
];

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route>('tasks');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const styles = makeStyles(c, insets.top, insets.bottom);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Pressable onPress={() => setSidebarOpen(true)} hitSlop={10} style={styles.menuButton} accessibilityLabel="Open menu">
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Life Plan</Text>
      </View>

      <View style={styles.content}>
        {route === 'tasks' ? <TasksScreen /> : route === 'alarms' ? <AudioScheduleScreen /> : <SettingsScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => {
          const active = route === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setRoute(t.key)}
              style={styles.tabButton}
              accessibilityLabel={t.label}
            >
              <View
                style={[
                  styles.tabIconWrap,
                  active && { backgroundColor: `${c[t.color]}1f` },
                ]}
              >
                <Text style={styles.tabIcon}>{t.icon}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <LeftSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={SIDEBAR_ITEMS}
        activeKey={route}
        onSelect={key => setRoute(key as Route)}
        c={c}
      />
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function makeStyles(c: typeof colors.light, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: topInset + 10,
      paddingBottom: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    menuButton: { padding: 4 },
    menuIcon: { fontSize: 20, color: c.text },
    headerTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    content: { flex: 1 },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.background,
      paddingBottom: bottomInset,
    },
    tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    tabIconWrap: {
      width: 44,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabIcon: { fontSize: 20 },
  });
}

export default App;
