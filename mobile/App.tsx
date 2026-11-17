import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import { TasksScreen } from './src/screens/TasksScreen';
import { AudioScheduleScreen } from './src/screens/AudioScheduleScreen';
import { RecordingsScreen } from './src/screens/RecordingsScreen';
import { PlaylistsScreen } from './src/screens/PlaylistsScreen';
import { BookIdeasScreen } from './src/screens/BookIdeasScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LeftSidebar } from './src/components/LeftSidebar';
import { QuickDictateModal } from './src/components/QuickDictateModal';
import { runScreenBackHandler } from './src/screenBackHandler';
import { HeaderActionProvider, useHeaderActionContext } from './src/contexts/HeaderActionContext';
import { AuthProvider } from './src/contexts/AuthContext';

type Route = 'tasks' | 'alarms' | 'record' | 'playlists' | 'bookIdeas' | 'settings';

const SIDEBAR_ITEMS: { key: Route; label: string; icon: string; color: keyof typeof colors.light }[] = [
  { key: 'tasks', label: 'Tasks', icon: '☑', color: 'accent' },
  { key: 'alarms', label: 'Alarms', icon: '⏰', color: 'secondary' },
  { key: 'record', label: 'Record', icon: '🎙', color: 'accent' },
  { key: 'playlists', label: 'Playlists', icon: '🎵', color: 'secondary' },
  { key: 'bookIdeas', label: 'Book Ideas', icon: '📖', color: 'accent' },
  { key: 'settings', label: 'Settings', icon: '⚙', color: 'textMuted' },
];

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<Route>('tasks');
  const [history, setHistory] = useState<Route[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dictateOpen, setDictateOpen] = useState(false);
  const { headerTitle, headerActions, headerSearchBox } = useHeaderActionContext();
  const styles = makeStyles(c, insets.top, insets.bottom);

  const navigateTo = useCallback(
    (key: Route) => {
      setSidebarOpen(false);
      if (key === route) return;
      setHistory(h => [...h, route]);
      setRoute(key);
    },
    [route]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }
      if (runScreenBackHandler()) {
        return true;
      }
      if (history.length > 0) {
        setRoute(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sidebarOpen, history]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => setSidebarOpen(true)} hitSlop={10} style={styles.menuButton} accessibilityLabel="Open menu">
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          {headerSearchBox ? (
            <TextInput
              autoFocus
              value={headerSearchBox.value}
              onChangeText={headerSearchBox.onChangeText}
              placeholder={headerSearchBox.placeholder ?? 'Search'}
              placeholderTextColor={c.textMuted}
              style={styles.headerSearchInput}
            />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle ?? 'Life Plan'}
            </Text>
          )}
        </View>
        {headerActions.map(action => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            hitSlop={10}
            accessibilityLabel={action.label}
            style={styles.headerActionButton}
          >
            <Text style={styles.headerActionIcon}>{action.icon}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setDictateOpen(true)}
          hitSlop={10}
          accessibilityLabel="Dictate book idea"
          style={styles.headerActionButton}
        >
          <Text style={styles.headerActionIcon}>🎙</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {route === 'tasks' ? (
          <TasksScreen />
        ) : route === 'alarms' ? (
          <AudioScheduleScreen />
        ) : route === 'record' ? (
          <RecordingsScreen />
        ) : route === 'playlists' ? (
          <PlaylistsScreen />
        ) : route === 'bookIdeas' ? (
          <BookIdeasScreen />
        ) : (
          <SettingsScreen />
        )}
      </View>

      <LeftSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={SIDEBAR_ITEMS}
        activeKey={route}
        onSelect={key => navigateTo(key as Route)}
        c={c}
      />

      <QuickDictateModal visible={dictateOpen} onClose={() => setDictateOpen(false)} />
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HeaderActionProvider>
          <AppContent />
        </HeaderActionProvider>
      </AuthProvider>
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
    headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuButton: { padding: 4 },
    menuIcon: { fontSize: 20, color: c.text },
    headerTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    headerSearchInput: { flex: 1, color: c.text, fontSize: 15, padding: 0 },
    headerActionButton: { padding: 4 },
    headerActionIcon: { fontSize: 20, color: c.text },
    content: { flex: 1, paddingBottom: bottomInset },
  });
}

export default App;
