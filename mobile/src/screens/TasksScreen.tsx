import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { colors } from '../theme';
import { newId } from '../id';
import { loadTasks, saveTasks } from '../storage';
import { TimeField } from '../components/TimeField';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { formatTimeHHMMSS } from '../time';
import { canScheduleExactAlarms, openExactAlarmSettings } from '../nativeAudioAlarm';
import { cancelTaskAlarm, syncTaskReminder } from '../nativeTaskReminder';
import type { Task, TaskType } from '../types';

export function TasksScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'pending' | 'done'>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState<TaskType>('manual');
  const [startTime, setStartTime] = useState('08:00:00');
  const [startInSeconds, setStartInSeconds] = useState('');
  const [repeatMinutes, setRepeatMinutes] = useState('30');
  const [exactAlarmsAllowed, setExactAlarmsAllowed] = useState(true);
  const tasksRef = useRef<Task[]>([]);

  const syncAllReminders = useCallback(async () => {
    const allowed = await canScheduleExactAlarms();
    setExactAlarmsAllowed(allowed);
    if (!allowed) return;
    for (const task of tasksRef.current) {
      await syncTaskReminder(task).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadTasks().then(loaded => {
      setTasks(loaded);
      tasksRef.current = loaded;
      void syncAllReminders();
    });
  }, [syncAllReminders]);

  const reloadTasks = useCallback(async () => {
    const loaded = await loadTasks();
    setTasks(loaded);
    tasksRef.current = loaded;
    await syncAllReminders();
  }, [syncAllReminders]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void reloadTasks();
    });
    return () => sub.remove();
  }, [reloadTasks]);

  const persist = useCallback((next: Task[]) => {
    setTasks(next);
    tasksRef.current = next;
    void saveTasks(next);
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setText('');
    setType('manual');
    setStartTime('08:00:00');
    setStartInSeconds('');
    setRepeatMinutes('30');
    setFormOpen(true);
  };

  const openEditForm = (task: Task) => {
    setEditingId(task.id);
    setText(task.text);
    setType(task.type);
    setStartTime(task.startTime ?? '08:00:00');
    setStartInSeconds('');
    setRepeatMinutes(task.repeatMinutes != null ? String(task.repeatMinutes) : '30');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const saveTask = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingId) {
      const updated = tasks.map(t =>
        t.id === editingId
          ? {
              ...t,
              text: trimmed,
              type,
              ...(type === 'automated'
                ? { startTime, repeatMinutes: Number(repeatMinutes) || 1 }
                : { startTime: undefined, repeatMinutes: undefined }),
            }
          : t
      );
      persist(updated);
      const saved = updated.find(t => t.id === editingId);
      if (saved) void syncTaskReminder(saved);
    } else {
      const task: Task = {
        id: newId(),
        text: trimmed,
        type,
        done: false,
        ignored: false,
        createdAt: new Date().toISOString(),
        ...(type === 'automated'
          ? { startTime, repeatMinutes: Number(repeatMinutes) || 1 }
          : {}),
      };
      persist([task, ...tasks]);
      void syncTaskReminder(task);
    }
    closeForm();
  };

  const handleStartInSecondsChange = (value: string) => {
    setStartInSeconds(value);
    const seconds = Number(value);
    if (value.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
      setStartTime(formatTimeHHMMSS(new Date(Date.now() + seconds * 1000)));
    }
  };

  const toggleDone = (id: string) => {
    const updated = tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    persist(updated);
    const saved = updated.find(t => t.id === id);
    if (saved) void syncTaskReminder(saved);
  };

  const ignoreTask = (id: string) => {
    const updated = tasks.map(t => (t.id === id ? { ...t, ignored: true } : t));
    persist(updated);
    const saved = updated.find(t => t.id === id);
    if (saved) void syncTaskReminder(saved);
  };

  const deleteTask = (task: Task) => {
    Alert.alert('Delete task?', `"${task.text}" will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          persist(tasks.filter(t => t.id !== task.id));
          void cancelTaskAlarm(task.id);
        },
      },
    ]);
  };

  const pendingCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.filter(t => t.done).length;
  const visibleTasks = tasks.filter(t => (filter === 'done' ? t.done : !t.done));

  const styles = makeStyles(c);

  return (
    <KeyboardAvoidingView style={styles.container} behavior="height">
      {!exactAlarmsAllowed ? (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            Exact alarms are off, so reminders won't trigger reliably in the background.
          </Text>
          <Pressable onPress={() => void openExactAlarmSettings()} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>Open settings</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('pending')}
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, filter === 'pending' && styles.filterButtonTextActive]}>
            ⏳ Pending ({pendingCount})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('done')}
          style={[styles.filterButton, filter === 'done' && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, filter === 'done' && styles.filterButtonTextActive]}>
            ✓ Done ({doneCount})
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {visibleTasks.length === 0 ? (
          <Text style={styles.empty}>
            {filter === 'done' ? 'No done tasks yet.' : 'No pending tasks.'}
          </Text>
        ) : (
          visibleTasks.map(task => (
            <View key={task.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text
                  style={[
                    styles.rowText,
                    (task.done || task.ignored) && styles.rowTextDone,
                  ]}
                >
                  {task.text}
                </Text>
                <Text style={styles.rowMeta}>
                  {task.type === 'manual'
                    ? 'Manual'
                    : `Reminder: ${task.startTime}, every ${task.repeatMinutes}m`}
                  {task.ignored ? ' · ignored' : ''}
                </Text>
              </View>
              {task.type === 'manual' ? (
                <Switch value={task.done} onValueChange={() => toggleDone(task.id)} />
              ) : null}
              <RowActionsMenu
                c={c}
                items={[
                  { label: 'Edit', onPress: () => openEditForm(task) },
                  ...(task.type === 'automated' && !task.ignored && !task.done
                    ? [{ label: 'Ignore', onPress: () => ignoreTask(task.id) }]
                    : []),
                  { label: 'Delete', onPress: () => deleteTask(task), danger: true },
                ]}
              />
            </View>
          ))
        )}
      </ScrollView>

      {formOpen ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit task' : 'New task'}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Task description"
            placeholderTextColor={c.textMuted}
            style={styles.input}
          />
          <View style={styles.typeRow}>
            <Pressable
              onPress={() => setType('manual')}
              style={[styles.typeButton, type === 'manual' && styles.typeButtonActive]}
            >
              <Text style={[styles.typeButtonText, type === 'manual' && styles.typeButtonTextActive]}>
                ☑ Manual
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType('automated')}
              style={[styles.typeButton, type === 'automated' && styles.typeButtonActive]}
            >
              <Text
                style={[styles.typeButtonText, type === 'automated' && styles.typeButtonTextActive]}
              >
                ⏰ Reminder
              </Text>
            </Pressable>
          </View>
          {type === 'automated' ? (
            <>
              <View style={styles.timeGroup}>
                <Text style={styles.inputLabel}>Start in (seconds from now)</Text>
                <TextInput
                  value={startInSeconds}
                  onChangeText={handleStartInSecondsChange}
                  keyboardType="number-pad"
                  placeholder="e.g. 20"
                  placeholderTextColor={c.textMuted}
                  style={styles.input}
                />
              </View>
              <View style={styles.timeGroup}>
                <Text style={styles.inputLabel}>Start time</Text>
                <TimeField value={startTime} onChange={setStartTime} c={c} />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Repeat every (min)</Text>
                <TextInput
                  value={repeatMinutes}
                  onChangeText={setRepeatMinutes}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
            </>
          ) : null}
          <View style={styles.formActions}>
            <Pressable onPress={closeForm} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveTask} style={styles.addButton}>
              <Text style={styles.addButtonText}>{editingId ? 'Save changes' : 'Add'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={openAddForm} style={styles.fab} accessibilityLabel="Add task">
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    permissionBanner: {
      margin: 16,
      marginBottom: 0,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    permissionText: { color: c.danger, fontSize: 13 },
    permissionButton: { marginTop: 8, alignSelf: 'flex-start' },
    permissionButtonText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    filterRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: c.surface,
    },
    filterButtonActive: { backgroundColor: c.accent },
    filterButtonText: { color: c.text, fontSize: 13, fontWeight: '500' },
    filterButtonTextActive: { color: '#ffffff', fontWeight: '700' },
    list: { padding: 16, paddingBottom: 96, gap: 10 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 32 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowMain: { flex: 1, gap: 2 },
    rowText: { color: c.text, fontSize: 15, fontWeight: '500' },
    rowTextDone: { color: c.textMuted, textDecorationLine: 'line-through' },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabIcon: { color: '#ffffff', fontSize: 28, fontWeight: '700', lineHeight: 30 },
    form: {
      margin: 16,
      padding: 14,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 10,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.background,
    },
    formTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    inputHalf: { flex: 1, gap: 4 },
    timeGroup: { gap: 4 },
    inputLabel: { color: c.textMuted, fontSize: 12 },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeButton: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    typeButtonActive: { backgroundColor: c.accent, borderColor: c.accent },
    typeButtonText: { color: c.text, fontSize: 13 },
    typeButtonTextActive: { color: '#ffffff', fontWeight: '600' },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
    cancelButton: { paddingVertical: 8, paddingHorizontal: 12 },
    cancelButtonText: { color: c.textMuted },
    addButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    addButtonText: { color: '#ffffff', fontWeight: '600' },
  });
}
