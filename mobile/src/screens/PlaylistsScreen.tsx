import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { pickDirectory } from '@react-native-documents/picker';
import { State, useProgress } from 'react-native-track-player';
import { colors } from '../theme';
import { newId } from '../id';
import { loadPlaylists, savePlaylists } from '../storage';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SeekBar } from '../components/SeekBar';
import { listAudioFiles } from '../nativeFolderPlaylist';
import { clearScreenBackHandler, setScreenBackHandler } from '../screenBackHandler';
import { useHeaderAction, useHeaderTitle } from '../contexts/HeaderActionContext';
import {
  getRestoredPlaybackState,
  loadAndPlay,
  pausePlaylist,
  resumePlaylist,
  seekByOffset,
  seekToPosition,
  skipToNext,
  skipToPrevious,
  stopPlaylist,
  subscribeToActiveTrackChanged,
  subscribeToPlaylistPlaybackErrors,
  subscribeToPlaylistState,
  switchPlayMode,
  type PlaylistPlayMode,
} from '../playlistPlayer';
import type { AudioTrack, Playlist } from '../types';

const MODE_ORDER: PlaylistPlayMode[] = ['current', 'all', 'loopOne'];
const MODE_ICON: Record<PlaylistPlayMode, string> = {
  current: '1️⃣',
  all: '🔁',
  loopOne: '🔂',
};
const MODE_LABEL: Record<PlaylistPlayMode, string> = {
  current: 'Playing current track only',
  all: 'Playing all tracks',
  loopOne: 'Looping current track',
};

function PlaylistDetail({
  playlist,
  c,
}: {
  playlist: Playlist;
  c: typeof colors.light;
}) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [mode, setMode] = useState<PlaylistPlayMode>('current');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [modeToastVisible, setModeToastVisible] = useState(false);
  const progress = useProgress(500);
  const modeToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (modeToastTimeoutRef.current) clearTimeout(modeToastTimeoutRef.current);
    };
  }, []);

  useHeaderTitle(playlist.name);

  const refreshTracks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const contents = await listAudioFiles(playlist.folderUri);
      setTracks(contents.files);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not read folder');
    } finally {
      setLoading(false);
    }
  }, [playlist.folderUri]);

  useEffect(() => {
    void refreshTracks();
  }, [refreshTracks]);

  useHeaderAction('refresh', '⟳', 'Refresh folder', refreshTracks);

  // Playback keeps running when you navigate away from this screen, so on
  // (re)mount, recover what's actually playing from TrackPlayer itself
  // instead of starting blank - but only if it's one of THIS playlist's
  // tracks (you may have started a different playlist since leaving).
  useEffect(() => {
    if (tracks.length === 0) return;
    let cancelled = false;
    void (async () => {
      const restored = await getRestoredPlaybackState(tracks);
      if (cancelled || !restored) return;
      setCurrentIndex(restored.index);
      setMode(restored.mode);
      setLoaded(true);
      setIsPlaying(restored.isPlaying);
    })();
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  useEffect(() => {
    return subscribeToPlaylistState(state => setIsPlaying(state === State.Playing));
  }, []);

  useEffect(() => {
    return subscribeToActiveTrackChanged(index => {
      if (mode === 'all') setCurrentIndex(index);
    });
  }, [mode]);

  useEffect(() => {
    return subscribeToPlaylistPlaybackErrors(message => {
      setPlayError(message);
    });
  }, []);

  const playTrack = async (index: number) => {
    setPlayError(null);
    try {
      setCurrentIndex(index);
      await loadAndPlay(tracks, index, mode);
      setLoaded(true);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not play track');
    }
  };

  const togglePlayPause = async () => {
    setPlayError(null);
    try {
      if (!loaded) {
        await playTrack(currentIndex);
        return;
      }
      if (isPlaying) {
        await pausePlaylist();
      } else {
        await resumePlaylist();
      }
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not play track');
    }
  };

  const stop = async () => {
    await stopPlaylist();
    setLoaded(false);
  };

  const goNext = async () => {
    setPlayError(null);
    try {
      const nextIndex = await skipToNext(tracks, currentIndex, mode);
      if (mode !== 'all') setCurrentIndex(nextIndex);
      setLoaded(true);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not skip track');
    }
  };

  const goPrevious = async () => {
    setPlayError(null);
    try {
      const prevIndex = await skipToPrevious(tracks, currentIndex, mode);
      if (mode !== 'all') setCurrentIndex(prevIndex);
      setLoaded(true);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not skip track');
    }
  };

  const skipBack5 = async () => {
    setPlayError(null);
    try {
      await seekByOffset(-5);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not seek');
    }
  };

  const skipForward5 = async () => {
    setPlayError(null);
    try {
      await seekByOffset(5);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Could not seek');
    }
  };

  const changeMode = useCallback(
    async (next: PlaylistPlayMode) => {
      const previousMode = mode;
      setMode(next);
      if (loaded) {
        try {
          await switchPlayMode(tracks, currentIndex, previousMode, next);
        } catch (e) {
          setPlayError(e instanceof Error ? e.message : 'Could not switch mode');
        }
      }
    },
    [mode, loaded, tracks, currentIndex]
  );

  const cycleMode = useCallback(() => {
    const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
    void changeMode(nextMode);
    setModeToastVisible(true);
    if (modeToastTimeoutRef.current) clearTimeout(modeToastTimeoutRef.current);
    modeToastTimeoutRef.current = setTimeout(() => setModeToastVisible(false), 5000);
  }, [mode, changeMode]);

  useHeaderAction('mode', MODE_ICON[mode], MODE_LABEL[mode], cycleMode);

  const styles = makeDetailStyles(c);
  const currentTrack = tracks[currentIndex];

  return (
    <View style={styles.container}>
      {modeToastVisible && (
        <View style={styles.modeToast}>
          <Text style={styles.modeToastText}>
            {MODE_ICON[mode]} {MODE_LABEL[mode]}
          </Text>
        </View>
      )}

      {playError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{playError}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[styles.list, loaded && styles.listWithPlayer]}>
        {loading ? (
          <Text style={styles.empty}>Loading tracks…</Text>
        ) : loadError ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : tracks.length === 0 ? (
          <Text style={styles.empty}>No audio files found in this folder.</Text>
        ) : (
          tracks.map((track, index) => {
            const active = loaded && index === currentIndex;
            return (
              <Pressable
                key={track.uri}
                onPress={() => void playTrack(index)}
                style={[styles.trackRow, active && styles.trackRowActive]}
              >
                <Text style={[styles.trackText, active && styles.trackTextActive]} numberOfLines={1}>
                  {active && isPlaying ? '▶ ' : ''}
                  {track.fileName}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {loaded && currentTrack ? (
        <View style={styles.nowPlayingBar}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
            {currentTrack.fileName}
          </Text>
          <SeekBar
            position={progress.position}
            duration={progress.duration}
            onSeek={seconds => void seekToPosition(seconds)}
            c={c}
          />
          <View style={styles.transportRow}>
            <Pressable onPress={() => void skipBack5()} hitSlop={8} accessibilityLabel="Back 5 seconds">
              <Text style={styles.transportIconSmall}>⟲5</Text>
            </Pressable>
            <Pressable onPress={() => void goPrevious()} hitSlop={8} accessibilityLabel="Previous">
              <Text style={styles.transportIcon}>⏮</Text>
            </Pressable>
            <Pressable
              onPress={() => void togglePlayPause()}
              hitSlop={8}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              <Text style={styles.transportIconLarge}>{isPlaying ? '⏸' : '▶'}</Text>
            </Pressable>
            <Pressable onPress={() => void stop()} hitSlop={8} accessibilityLabel="Stop">
              <Text style={styles.transportIcon}>⏹</Text>
            </Pressable>
            <Pressable onPress={() => void goNext()} hitSlop={8} accessibilityLabel="Next">
              <Text style={styles.transportIcon}>⏭</Text>
            </Pressable>
            <Pressable onPress={() => void skipForward5()} hitSlop={8} accessibilityLabel="Forward 5 seconds">
              <Text style={styles.transportIconSmall}>5⟳</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function PlaylistsScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setPlaylists(await loadPlaylists());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    const handler = () => {
      setSelectedId(null);
      return true;
    };
    setScreenBackHandler(handler);
    return () => clearScreenBackHandler(handler);
  }, [selectedId]);

  const addFolder = async () => {
    setPickError(null);
    try {
      const result = await pickDirectory({ requestLongTermAccess: true });
      const contents = await listAudioFiles(result.uri);
      const playlist: Playlist = {
        id: newId(),
        name: contents.folderName,
        folderUri: result.uri,
        createdAt: new Date().toISOString(),
      };
      const next = [playlist, ...playlists];
      setPlaylists(next);
      void savePlaylists(next);
    } catch (e) {
      setPickError(e instanceof Error ? e.message : 'Could not load folder');
    }
  };

  const removePlaylist = (playlist: Playlist) => {
    Alert.alert('Remove playlist?', `"${playlist.name}" will be removed. The files themselves are not deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const next = playlists.filter(p => p.id !== playlist.id);
          setPlaylists(next);
          void savePlaylists(next);
        },
      },
    ]);
  };

  const styles = makeStyles(c);

  if (selectedId) {
    const playlist = playlists.find(p => p.id === selectedId);
    if (playlist) {
      return <PlaylistDetail playlist={playlist} c={c} />;
    }
  }

  return (
    <View style={styles.container}>
      {pickError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{pickError}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.list}>
        {playlists.length === 0 ? (
          <Text style={styles.empty}>No playlists yet. Load a folder to create one.</Text>
        ) : (
          playlists.map(playlist => (
            <Pressable key={playlist.id} onPress={() => setSelectedId(playlist.id)} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowText}>{playlist.name}</Text>
              </View>
              <RowActionsMenu
                c={c}
                items={[{ label: 'Remove', onPress: () => removePlaylist(playlist), danger: true }]}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable onPress={() => void addFolder()} style={styles.fab} accessibilityLabel="Load folder">
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
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
    errorBanner: {
      margin: 16,
      marginBottom: 0,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    errorText: { color: c.danger, fontSize: 13 },
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
  });
}

function makeDetailStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    modeToast: {
      position: 'absolute',
      top: 10,
      left: 16,
      right: 16,
      zIndex: 10,
      alignItems: 'center',
    },
    modeToastText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600',
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
      overflow: 'hidden',
    },
    errorBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.danger,
      backgroundColor: c.surface,
    },
    errorText: { color: c.danger, fontSize: 13 },
    list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
    listWithPlayer: { paddingBottom: 180 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 32 },
    trackRow: {
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    trackRowActive: { borderColor: c.accent, backgroundColor: `${c.accent}1f` },
    trackText: { color: c.text, fontSize: 14 },
    trackTextActive: { color: c.accent, fontWeight: '600' },
    nowPlayingBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 10,
      paddingBottom: 6,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    nowPlayingTitle: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 16,
      marginBottom: 2,
    },
    transportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      paddingVertical: 10,
    },
    transportIcon: { color: c.text, fontSize: 24 },
    transportIconSmall: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    transportIconLarge: { color: c.accent, fontSize: 36 },
  });
}
