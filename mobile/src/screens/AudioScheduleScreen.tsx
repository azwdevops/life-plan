import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import { colors } from '../theme';
import { newId } from '../id';
import { loadAudioSchedules, saveAudioSchedules } from '../storage';
import { TimeField } from '../components/TimeField';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { formatTimeHHMMSS, isWithinWindow } from '../time';
import { playTracksLooped, stopPlayback, subscribeToPlaybackErrors } from '../audioPlayer';
import {
  canScheduleExactAlarms,
  cancelScheduleAlarms,
  openExactAlarmSettings,
  syncScheduleAlarms,
} from '../nativeAudioAlarm';
import { clearScreenBackHandler, setScreenBackHandler } from '../screenBackHandler';
import type { AudioSchedule, AudioTrack } from '../types';

const FILE_ROW_HEIGHT = 44;

// Drag handle uses its own PanResponder (not a library - this codebase hand-
// rolls gesture UI, e.g. SeekBar's PanResponder-based seeking, rather than
// pulling in react-native-gesture-handler/reanimated for one feature).
// Sibling rows slide out of the way during the drag via a plain translateY
// computed from the dragged row's live offset, snapped to whole row heights.
function DraggableFileRow({
  track,
  index,
  isDragging,
  dragOffsetY,
  shiftY,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRemove,
  c,
}: {
  track: AudioTrack;
  index: number;
  isDragging: boolean;
  dragOffsetY: number;
  shiftY: number;
  onDragStart: (index: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (index: number, dy: number) => void;
  onRemove: (index: number) => void;
  c: typeof colors.light;
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onDragStart(index),
      onPanResponderMove: (_, gesture) => onDragMove(gesture.dy),
      onPanResponderRelease: (_, gesture) => onDragEnd(index, gesture.dy),
      onPanResponderTerminate: (_, gesture) => onDragEnd(index, gesture.dy),
    })
  ).current;

  const styles = makeFileRowStyles(c);
  const translateY = isDragging ? dragOffsetY : shiftY;

  return (
    <View
      style={[
        styles.fileRow,
        (isDragging || shiftY !== 0) && { transform: [{ translateY }] },
        isDragging && styles.fileRowDragging,
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandle} hitSlop={10}>
        <Text style={styles.dragHandleText}>⠿</Text>
      </View>
      <Text style={styles.fileName} numberOfLines={1}>
        {track.fileName}
      </Text>
      <Pressable onPress={() => onRemove(index)} hitSlop={10} accessibilityLabel="Remove file">
        <Text style={styles.removeIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

export function AudioScheduleScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;

  const [schedules, setSchedules] = useState<AudioSchedule[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [startTime, setStartTime] = useState('01:00:00');
  const [startInSeconds, setStartInSeconds] = useState('');
  const [endTime, setEndTime] = useState('06:00:00');
  const [tick, setTick] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [exactAlarmsAllowed, setExactAlarmsAllowed] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const schedulesRef = useRef<AudioSchedule[]>([]);

  const syncAllAlarms = useCallback(async () => {
    const allowed = await canScheduleExactAlarms();
    setExactAlarmsAllowed(allowed);
    if (!allowed) return;
    for (const schedule of schedulesRef.current) {
      await syncScheduleAlarms(schedule).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadAudioSchedules().then(loaded => {
      setSchedules(loaded);
      schedulesRef.current = loaded;
      void syncAllAlarms();
    });
  }, [syncAllAlarms]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void syncAllAlarms();
    });
    return () => sub.remove();
  }, [syncAllAlarms]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return subscribeToPlaybackErrors(message => {
      setPlayingId(null);
      setPlayError(message);
    });
  }, []);

  const persist = useCallback((next: AudioSchedule[]) => {
    setSchedules(next);
    schedulesRef.current = next;
    void saveAudioSchedules(next);
  }, []);

  const pickFiles = async () => {
    setPickError(null);
    try {
      const results = await pick({
        mode: 'open',
        requestLongTermAccess: true,
        allowMultiSelection: true,
        type: [types.audio],
      });
      const picked: AudioTrack[] = results.map(r => ({
        uri: r.uri,
        fileName: r.name ?? 'Untitled',
      }));
      setTracks(prev => {
        const existingUris = new Set(prev.map(t => t.uri));
        return [...prev, ...picked.filter(t => !existingUris.has(t.uri))];
      });
      if (!label.trim() && picked[0]) setLabel(picked[0].fileName);
    } catch (e) {
      setPickError(e instanceof Error ? e.message : 'Could not pick files');
    }
  };

  const removeTrack = (index: number) => {
    setTracks(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileDragStart = (index: number) => {
    setDragIndex(index);
    setDragOffsetY(0);
  };

  const handleFileDragMove = (dy: number) => {
    setDragOffsetY(dy);
  };

  const handleFileDragEnd = (index: number, dy: number) => {
    const target = Math.min(Math.max(0, index + Math.round(dy / FILE_ROW_HEIGHT)), tracks.length - 1);
    if (target !== index) {
      setTracks(prev => {
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        return next;
      });
    }
    setDragIndex(null);
    setDragOffsetY(0);
  };

  const fileShiftFor = (index: number): number => {
    if (dragIndex == null || index === dragIndex) return 0;
    const dragTo = Math.min(Math.max(0, dragIndex + Math.round(dragOffsetY / FILE_ROW_HEIGHT)), tracks.length - 1);
    if (dragIndex < dragTo && index > dragIndex && index <= dragTo) return -FILE_ROW_HEIGHT;
    if (dragIndex > dragTo && index >= dragTo && index < dragIndex) return FILE_ROW_HEIGHT;
    return 0;
  };

  const openAddForm = () => {
    setEditingId(null);
    setLabel('');
    setTracks([]);
    setStartTime('01:00:00');
    setStartInSeconds('');
    setEndTime('06:00:00');
    setPickError(null);
    setDragIndex(null);
    setFormOpen(true);
  };

  const openEditForm = (schedule: AudioSchedule) => {
    setEditingId(schedule.id);
    setLabel(schedule.label);
    setTracks(schedule.tracks);
    setStartTime(schedule.startTime);
    setStartInSeconds('');
    setEndTime(schedule.endTime);
    setPickError(null);
    setDragIndex(null);
    setFormOpen(true);
  };

  const handleStartInSecondsChange = (text: string) => {
    setStartInSeconds(text);
    const seconds = Number(text);
    if (text.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
      setStartTime(formatTimeHHMMSS(new Date(Date.now() + seconds * 1000)));
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  useEffect(() => {
    if (!formOpen) return;
    const handler = () => {
      closeForm();
      return true;
    };
    setScreenBackHandler(handler);
    return () => clearScreenBackHandler(handler);
  }, [formOpen]);

  const saveSchedule = () => {
    const trimmed = label.trim();
    if (!trimmed || tracks.length === 0) return;

    if (editingId) {
      if (playingId === editingId) {
        void stopPlayback();
        setPlayingId(null);
      }
      const updated = schedules.map(s =>
        s.id === editingId ? { ...s, label: trimmed, tracks, startTime, endTime } : s
      );
      persist(updated);
      const saved = updated.find(s => s.id === editingId);
      if (saved) void syncScheduleAlarms(saved);
    } else {
      const schedule: AudioSchedule = {
        id: newId(),
        label: trimmed,
        tracks,
        startTime,
        endTime,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      persist([schedule, ...schedules]);
      void syncScheduleAlarms(schedule);
    }
    closeForm();
  };

  const toggleEnabled = (id: string) => {
    const updated = schedules.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    persist(updated);
    const saved = updated.find(s => s.id === id);
    if (saved) void syncScheduleAlarms(saved);
  };

  const deleteSchedule = (schedule: AudioSchedule) => {
    Alert.alert('Delete schedule?', `"${schedule.label}" will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (playingId === schedule.id) {
            void stopPlayback();
            setPlayingId(null);
          }
          persist(schedules.filter(s => s.id !== schedule.id));
          void cancelScheduleAlarms(schedule.id);
        },
      },
    ]);
  };

  const togglePlay = async (schedule: AudioSchedule) => {
    setPlayError(null);
    try {
      if (playingId === schedule.id) {
        await stopPlayback();
        setPlayingId(null);
        return;
      }
      await playTracksLooped(schedule.tracks, schedule.label);
      setPlayingId(schedule.id);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not play audio');
    }
  };

  const styles = makeStyles(c);

  return (
    <KeyboardAvoidingView style={styles.container} behavior="height">
      {!exactAlarmsAllowed ? (
        <View style={styles.playErrorBanner}>
          <Text style={styles.playErrorText}>
            Exact alarms are off, so schedules won't trigger reliably in the background.
          </Text>
          <Pressable
            onPress={() => void openExactAlarmSettings()}
            style={styles.permissionButton}
          >
            <Text style={styles.permissionButtonText}>Open settings</Text>
          </Pressable>
        </View>
      ) : null}
      {playError ? (
        <View style={styles.playErrorBanner}>
          <Text style={styles.playErrorText}>{playError}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.list}>
        {schedules.length === 0 ? (
          <Text style={styles.empty}>No schedules yet.</Text>
        ) : (
          schedules.map(schedule => {
            const active = schedule.enabled && isWithinWindow(schedule.startTime, schedule.endTime);
            const isPlaying = playingId === schedule.id;
            return (
            <View key={schedule.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={[styles.rowText, !schedule.enabled && styles.rowTextDisabled]}>
                  {schedule.label}
                </Text>
                <Text style={styles.rowMeta}>
                  {schedule.startTime} – {schedule.endTime}, {schedule.tracks.length}{' '}
                  {schedule.tracks.length === 1 ? 'track' : 'tracks'}, looped
                  {active ? ' · active now' : ''}
                </Text>
              </View>
              {active ? <View style={styles.activeDot} /> : null}
              <Pressable
                onPress={() => void togglePlay(schedule)}
                disabled={schedule.tracks.length === 0}
                hitSlop={8}
                accessibilityLabel={isPlaying ? 'Stop' : 'Play now'}
              >
                <Text style={isPlaying ? styles.stopIcon : styles.playIcon}>
                  {isPlaying ? '⏹' : '▶'}
                </Text>
              </Pressable>
              <Switch value={schedule.enabled} onValueChange={() => toggleEnabled(schedule.id)} />
              <RowActionsMenu
                c={c}
                items={[
                  { label: 'Edit', onPress: () => openEditForm(schedule) },
                  { label: 'Delete', onPress: () => deleteSchedule(schedule), danger: true },
                ]}
              />
            </View>
            );
          })
        )}
      </ScrollView>

      {formOpen ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit schedule' : 'New schedule'}</Text>
          <Pressable onPress={() => void pickFiles()} style={styles.pickButton}>
            <Text style={styles.pickButtonText}>
              {tracks.length === 0 ? 'Choose audio files…' : 'Add more files…'}
            </Text>
          </Pressable>
          {tracks.length > 0 ? (
            <View style={styles.fileListWrap}>
              <ScrollView style={styles.fileList} nestedScrollEnabled>
                {tracks.map((track, index) => (
                  <DraggableFileRow
                    key={track.uri}
                    track={track}
                    index={index}
                    isDragging={dragIndex === index}
                    dragOffsetY={dragOffsetY}
                    shiftY={fileShiftFor(index)}
                    onDragStart={handleFileDragStart}
                    onDragMove={handleFileDragMove}
                    onDragEnd={handleFileDragEnd}
                    onRemove={removeTrack}
                    c={c}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {pickError ? <Text style={styles.pickErrorText}>{pickError}</Text> : null}
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Song or playlist name"
            placeholderTextColor={c.textMuted}
            style={styles.input}
          />
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
          <View style={styles.timeGroup}>
            <Text style={styles.inputLabel}>End time</Text>
            <TimeField value={endTime} onChange={setEndTime} c={c} />
          </View>
          <View style={styles.formActions}>
            <Pressable onPress={closeForm} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={saveSchedule}
              disabled={tracks.length === 0 || !label.trim()}
              style={[styles.addButton, (tracks.length === 0 || !label.trim()) && styles.addButtonDisabled]}
            >
              <Text style={styles.addButtonText}>{editingId ? 'Save changes' : 'Add'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={openAddForm} style={styles.fab} accessibilityLabel="Add schedule">
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
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
    rowTextDisabled: { color: c.textMuted },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.secondary },
    playIcon: { color: c.accent, fontSize: 18 },
    stopIcon: { color: c.danger, fontSize: 18 },
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
    inputLabel: { color: c.textMuted, fontSize: 12 },
    pickButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    pickButtonText: { color: c.accent, fontWeight: '600', fontSize: 13 },
    fileListWrap: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    fileList: { maxHeight: FILE_ROW_HEIGHT * 4.5 },
    pickErrorText: { color: c.danger, fontSize: 12 },
    playErrorBanner: {
      margin: 16,
      marginBottom: 0,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    playErrorText: { color: c.danger, fontSize: 13 },
    permissionButton: { marginTop: 8, alignSelf: 'flex-start' },
    permissionButtonText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    timeGroup: { gap: 4 },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
    cancelButton: { paddingVertical: 8, paddingHorizontal: 12 },
    cancelButtonText: { color: c.textMuted },
    addButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    addButtonDisabled: { opacity: 0.4 },
    addButtonText: { color: '#ffffff', fontWeight: '600' },
  });
}

function makeFileRowStyles(c: typeof colors.light) {
  return StyleSheet.create({
    fileRow: {
      height: FILE_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    fileRowDragging: {
      zIndex: 10,
      elevation: 4,
      opacity: 0.95,
      backgroundColor: c.background,
    },
    dragHandle: { paddingVertical: 6, paddingHorizontal: 2 },
    dragHandleText: { color: c.textMuted, fontSize: 16 },
    fileName: { flex: 1, color: c.text, fontSize: 13 },
    removeIcon: { color: c.danger, fontSize: 15, paddingHorizontal: 4 },
  });
}
