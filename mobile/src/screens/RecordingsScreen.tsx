import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
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
import { RowActionsMenu } from '../components/RowActionsMenu';
import { TimeField } from '../components/TimeField';
import { formatTimeHHMMSS, nextOccurrenceEpochMillis } from '../time';
import { playClip, stopPlayback, subscribeToPlaybackErrors } from '../audioPlayer';
import {
  cancelScheduledStart,
  deleteRecording,
  getRecorderStatus,
  getScheduledStart,
  listRecordings,
  requestMicrophonePermission,
  scheduleListeningStart,
  startListening,
  stopListening,
  subscribeToRecorderUpdates,
  type Recording,
  type ScheduledStart,
  type SoundRecorderStatus,
} from '../nativeSoundRecorder';

type Mode = 'count' | 'infinite';

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface RecordingGroup {
  key: string;
  label: string;
  items: Recording[];
}

// `recordings` from the native side is already newest-first, so a single
// pass clusters same-day items correctly without needing to re-sort.
function groupByDate(recordings: Recording[]): RecordingGroup[] {
  const groups: RecordingGroup[] = [];
  for (const recording of recordings) {
    const key = dateKey(recording.createdAtMillis);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(recording);
    } else {
      groups.push({ key, label: formatDateHeader(recording.createdAtMillis), items: [recording] });
    }
  }
  return groups;
}

export function RecordingsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;

  const [status, setStatus] = useState<SoundRecorderStatus | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [mode, setMode] = useState<Mode>('count');
  const [countText, setCountText] = useState('5');
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduledStart | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00:00');
  const [scheduleStartInSeconds, setScheduleStartInSeconds] = useState('');

  const refresh = useCallback(async () => {
    const [nextStatus, nextRecordings, nextSchedule] = await Promise.all([
      getRecorderStatus(),
      listRecordings(),
      getScheduledStart(),
    ]);
    setStatus(nextStatus);
    setRecordings(nextRecordings);
    setSchedule(nextSchedule);
    setScheduleStartTime(nextSchedule.startTime);
    setMode(nextSchedule.maxClips > 0 ? 'count' : 'infinite');
    if (nextSchedule.maxClips > 0) setCountText(String(nextSchedule.maxClips));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    return subscribeToRecorderUpdates(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    return subscribeToPlaybackErrors(message => {
      setPlayingFile(null);
      setPlayError(message);
    });
  }, []);

  const onToggle = async () => {
    if (status?.isListening) {
      await stopListening();
      await refresh();
      return;
    }
    const granted = await requestMicrophonePermission();
    if (!granted) {
      Alert.alert('Microphone permission required', 'Enable microphone access to record sound.');
      return;
    }
    const max = mode === 'infinite' ? 0 : Math.max(1, Number(countText) || 1);
    await startListening(max);
    await refresh();
  };

  const handleScheduleStartInSecondsChange = (value: string) => {
    setScheduleStartInSeconds(value);
    const seconds = Number(value);
    if (value.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
      setScheduleStartTime(formatTimeHHMMSS(new Date(Date.now() + seconds * 1000)));
    }
  };

  const onToggleSchedule = async () => {
    if (schedule?.enabled) {
      await cancelScheduledStart();
      await refresh();
      return;
    }
    const granted = await requestMicrophonePermission();
    if (!granted) {
      Alert.alert('Microphone permission required', 'Enable microphone access to record sound.');
      return;
    }
    const max = mode === 'infinite' ? 0 : Math.max(1, Number(countText) || 1);
    const epoch = nextOccurrenceEpochMillis(scheduleStartTime);
    await scheduleListeningStart(epoch, max, scheduleStartTime);
    await refresh();
  };

  const togglePlay = async (recording: Recording) => {
    setPlayError(null);
    try {
      if (playingFile === recording.fileName) {
        await stopPlayback();
        setPlayingFile(null);
        return;
      }
      await playClip(`file://${recording.path}`, recording.fileName);
      setPlayingFile(recording.fileName);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not play recording');
    }
  };

  const removeRecording = (recording: Recording) => {
    Alert.alert('Delete recording?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (playingFile === recording.fileName) {
            await stopPlayback();
            setPlayingFile(null);
          }
          await deleteRecording(recording.fileName);
          await refresh();
        },
      },
    ]);
  };

  const removeGroup = (group: RecordingGroup) => {
    const count = group.items.length;
    Alert.alert(
      `Delete all for ${group.label}?`,
      `${count} recording${count === 1 ? '' : 's'} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            if (group.items.some(r => r.fileName === playingFile)) {
              await stopPlayback();
              setPlayingFile(null);
            }
            await Promise.all(group.items.map(r => deleteRecording(r.fileName)));
            await refresh();
          },
        },
      ]
    );
  };

  const listening = status?.isListening ?? false;
  const recordingGroups = useMemo(() => groupByDate(recordings), [recordings]);
  const styles = makeStyles(c);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.controls}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelWrap}>
            <Text style={styles.toggleLabel}>{listening ? 'Listening…' : 'Off'}</Text>
            {listening && (
              <Text style={styles.toggleMeta}>
                {status?.clipsRecorded ?? 0}
                {status?.maxClips ? ` / ${status.maxClips}` : ''} clip
                {status?.clipsRecorded === 1 ? '' : 's'} recorded
              </Text>
            )}
          </View>
          <Switch value={listening} onValueChange={() => void onToggle()} />
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('count')}
            disabled={listening || schedule?.enabled}
            style={[styles.modeButton, mode === 'count' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'count' && styles.modeButtonTextActive]}>
              Count
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('infinite')}
            disabled={listening || schedule?.enabled}
            style={[styles.modeButton, mode === 'infinite' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'infinite' && styles.modeButtonTextActive]}>
              Infinite
            </Text>
          </Pressable>
        </View>

        {mode === 'count' && (
          <View style={styles.countGroup}>
            <Text style={styles.inputLabel}>Stop after this many clips</Text>
            <TextInput
              value={countText}
              onChangeText={setCountText}
              editable={!listening && !schedule?.enabled}
              keyboardType="number-pad"
              style={[styles.input, (listening || schedule?.enabled) && styles.inputDisabled]}
            />
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelWrap}>
            <Text style={styles.toggleLabel}>Scheduled daily start</Text>
            {schedule?.enabled && (
              <Text style={styles.toggleMeta}>Turns listening on at {schedule.startTime} every day</Text>
            )}
          </View>
          <Switch value={schedule?.enabled ?? false} onValueChange={() => void onToggleSchedule()} />
        </View>

        <View style={styles.timeGroup}>
          <Text style={styles.inputLabel}>Start in (seconds from now)</Text>
          <TextInput
            value={scheduleStartInSeconds}
            onChangeText={handleScheduleStartInSecondsChange}
            editable={!schedule?.enabled}
            keyboardType="number-pad"
            placeholder="e.g. 20"
            placeholderTextColor={c.textMuted}
            style={[styles.input, schedule?.enabled && styles.inputDisabled]}
          />
        </View>
        <View style={styles.timeGroup}>
          <Text style={styles.inputLabel}>Start time</Text>
          <TimeField value={scheduleStartTime} onChange={setScheduleStartTime} c={c} />
        </View>
      </View>

      {playError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{playError}</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {recordings.length === 0 ? (
          <Text style={styles.empty}>No recordings yet.</Text>
        ) : (
          recordingGroups.map(group => (
            <View key={group.key} style={styles.dateGroup}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.dateHeader}>{group.label}</Text>
                <Pressable onPress={() => removeGroup(group)} hitSlop={8}>
                  <Text style={styles.deleteAllText}>Delete all</Text>
                </Pressable>
              </View>
              {group.items.map(recording => {
                const isPlaying = playingFile === recording.fileName;
                return (
                  <View key={recording.fileName} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowText}>{formatTime(recording.createdAtMillis)}</Text>
                      <Text style={styles.rowMeta}>{formatDuration(recording.durationSeconds)}</Text>
                    </View>
                    <Pressable
                      onPress={() => void togglePlay(recording)}
                      hitSlop={8}
                      accessibilityLabel={isPlaying ? 'Stop' : 'Play'}
                    >
                      <Text style={isPlaying ? styles.stopIcon : styles.playIcon}>
                        {isPlaying ? '⏹' : '▶'}
                      </Text>
                    </Pressable>
                    <RowActionsMenu
                      c={c}
                      items={[{ label: 'Delete', onPress: () => removeRecording(recording), danger: true }]}
                    />
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { paddingBottom: 24 },
    controls: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 14,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 10,
    },
    timeGroup: { gap: 4 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleLabelWrap: { gap: 2 },
    toggleLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    toggleMeta: { color: c.textMuted, fontSize: 12 },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeButton: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    modeButtonActive: { backgroundColor: c.accent, borderColor: c.accent },
    modeButtonText: { color: c.text, fontSize: 13 },
    modeButtonTextActive: { color: '#ffffff', fontWeight: '600' },
    countGroup: { gap: 4 },
    inputLabel: { color: c.textMuted, fontSize: 12 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.background,
    },
    inputDisabled: { opacity: 0.5 },
    errorBanner: {
      margin: 16,
      marginTop: 12,
      marginBottom: 0,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    errorText: { color: c.danger, fontSize: 13 },
    list: { padding: 16, gap: 16 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 32 },
    dateGroup: { gap: 8 },
    dateHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateHeader: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    deleteAllText: { color: c.danger, fontSize: 12, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowMain: { flex: 1, gap: 2 },
    rowText: { color: c.text, fontSize: 14, fontWeight: '500' },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    playIcon: { color: c.accent, fontSize: 18 },
    stopIcon: { color: c.danger, fontSize: 18 },
  });
}
