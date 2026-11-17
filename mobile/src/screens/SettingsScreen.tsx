import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { colors } from '../theme';
import { loadSettings, saveSettings } from '../storage';
import { useAuth } from '../contexts/AuthContext';
import type { AppSettings } from '../types';

export function SettingsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const auth = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [taskSnoozeSeconds, setTaskSnoozeSeconds] = useState('300');
  const [backendUrl, setBackendUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(loaded => {
      setSettings(loaded);
      setTaskSnoozeSeconds(String(loaded.taskSnoozeSeconds));
      setBackendUrl(loaded.backendUrl);
    });
  }, []);

  const normalizeBackendUrl = (value: string): string => {
    let url = value.trim().replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url;
  };

  const save = () => {
    if (!settings) return;
    const next: AppSettings = {
      ...settings,
      taskSnoozeSeconds: Number(taskSnoozeSeconds) || 1,
      backendUrl: normalizeBackendUrl(backendUrl),
    };
    setSettings(next);
    setBackendUrl(next.backendUrl);
    void saveSettings(next);
    auth.setBackendUrl(next.backendUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need to log in again to use features that connect to the backend.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: auth.logout },
    ]);
  };

  const styles = makeStyles(c);

  if (!settings) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="height">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Task reminders</Text>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Snooze time (seconds)</Text>
          <TextInput
            value={taskSnoozeSeconds}
            onChangeText={setTaskSnoozeSeconds}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend</Text>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Server URL</Text>
          <TextInput
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.1.50:8000"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.section}>
        <Pressable onPress={save} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
      {auth.token ? (
        <View style={styles.section}>
          <Pressable onPress={confirmLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Log out</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    section: { padding: 16, gap: 10 },
    sectionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    field: { gap: 4 },
    inputLabel: { color: c.textMuted, fontSize: 12 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surface,
    },
    saveButton: {
      marginTop: 4,
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    saveButtonText: { color: '#ffffff', fontWeight: '600' },
    logoutButton: {
      alignSelf: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    logoutButtonText: { color: c.danger, fontWeight: '600' },
  });
}
