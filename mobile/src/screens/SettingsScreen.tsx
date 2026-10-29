import { useEffect, useState } from 'react';
import {
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
import type { AppSettings } from '../types';

export function SettingsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [taskSnoozeSeconds, setTaskSnoozeSeconds] = useState('300');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(loaded => {
      setSettings(loaded);
      setTaskSnoozeSeconds(String(loaded.taskSnoozeSeconds));
    });
  }, []);

  const save = () => {
    if (!settings) return;
    const next: AppSettings = {
      ...settings,
      taskSnoozeSeconds: Number(taskSnoozeSeconds) || 1,
    };
    setSettings(next);
    void saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
        <Pressable onPress={save} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
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
  });
}
