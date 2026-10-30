import TrackPlayer, { Event, RepeatMode, State } from 'react-native-track-player';
import type { AudioTrack } from './types';
import { ensureTrackPlayerSetup, isTrackPlayerSetUp } from './trackPlayerSetup';

export type PlaylistPlayMode = 'current' | 'all' | 'loopOne';

function wrapIndex(i: number, len: number): number {
  if (len === 0) return 0;
  return ((i % len) + len) % len;
}

// 'all' loads the whole playlist so Next/Previous move through it natively;
// 'current'/'loopOne' load just the one track, so there's nothing to
// auto-advance into and Next/Previous instead reload a different single track.
export async function loadAndPlay(tracks: AudioTrack[], index: number, mode: PlaylistPlayMode): Promise<void> {
  if (tracks.length === 0) return;
  await ensureTrackPlayerSetup();
  await TrackPlayer.reset();

  if (mode === 'all') {
    await TrackPlayer.add(tracks.map(t => ({ id: t.uri, url: t.uri, title: t.fileName })));
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    if (index > 0) await TrackPlayer.skip(index);
  } else {
    const track = tracks[index];
    await TrackPlayer.add({ id: track.uri, url: track.uri, title: track.fileName });
    await TrackPlayer.setRepeatMode(mode === 'loopOne' ? RepeatMode.Track : RepeatMode.Off);
  }
  await TrackPlayer.play();
}

// Switches play mode without restarting the currently playing file.
// 'current' <-> 'loopOne' only differ by repeat mode on the same single-track
// queue, so that's a plain setRepeatMode with no interruption at all.
// Moving to/from 'all' changes the queue shape (one track vs the whole
// playlist), so position/playing-state are captured and restored afterward
// instead of letting the reload restart from 0.
export async function switchPlayMode(
  tracks: AudioTrack[],
  index: number,
  fromMode: PlaylistPlayMode,
  toMode: PlaylistPlayMode
): Promise<void> {
  if (!isTrackPlayerSetUp() || tracks.length === 0) return;

  if (fromMode !== 'all' && toMode !== 'all') {
    await TrackPlayer.setRepeatMode(toMode === 'loopOne' ? RepeatMode.Track : RepeatMode.Off);
    return;
  }

  const [playbackState, progress] = await Promise.all([
    TrackPlayer.getPlaybackState(),
    TrackPlayer.getProgress(),
  ]);
  const wasPlaying = playbackState.state === State.Playing;
  const position = progress.position;

  await TrackPlayer.reset();
  if (toMode === 'all') {
    await TrackPlayer.add(tracks.map(t => ({ id: t.uri, url: t.uri, title: t.fileName })));
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    if (index > 0) await TrackPlayer.skip(index);
  } else {
    const track = tracks[index];
    await TrackPlayer.add({ id: track.uri, url: track.uri, title: track.fileName });
    await TrackPlayer.setRepeatMode(toMode === 'loopOne' ? RepeatMode.Track : RepeatMode.Off);
  }
  if (position > 0) await TrackPlayer.seekTo(position);
  if (wasPlaying) await TrackPlayer.play();
}

export async function pausePlaylist(): Promise<void> {
  if (!isTrackPlayerSetUp()) return;
  await TrackPlayer.pause();
}

export async function resumePlaylist(): Promise<void> {
  await TrackPlayer.play();
}

export async function seekToPosition(seconds: number): Promise<void> {
  if (!isTrackPlayerSetUp()) return;
  await TrackPlayer.seekTo(seconds);
}

export async function seekByOffset(offsetSeconds: number): Promise<void> {
  if (!isTrackPlayerSetUp()) return;
  await TrackPlayer.seekBy(offsetSeconds);
}

export async function stopPlaylist(): Promise<void> {
  if (!isTrackPlayerSetUp()) return;
  await TrackPlayer.reset();
}

export async function skipToNext(tracks: AudioTrack[], index: number, mode: PlaylistPlayMode): Promise<number> {
  if (mode === 'all') {
    await TrackPlayer.skipToNext().catch(() => {});
    return wrapIndex(index + 1, tracks.length);
  }
  const nextIndex = wrapIndex(index + 1, tracks.length);
  await loadAndPlay(tracks, nextIndex, mode);
  return nextIndex;
}

export async function skipToPrevious(tracks: AudioTrack[], index: number, mode: PlaylistPlayMode): Promise<number> {
  if (mode === 'all') {
    await TrackPlayer.skipToPrevious().catch(() => {});
    return wrapIndex(index - 1, tracks.length);
  }
  const prevIndex = wrapIndex(index - 1, tracks.length);
  await loadAndPlay(tracks, prevIndex, mode);
  return prevIndex;
}

export function subscribeToPlaylistPlaybackErrors(onError: (message: string) => void): () => void {
  const sub1 = TrackPlayer.addEventListener(Event.PlaybackError, e => {
    onError(`Playback error (${e.code}): ${e.message}`);
  });
  const sub2 = TrackPlayer.addEventListener(Event.PlayerError, e => {
    onError(`Player error (${e.code}): ${e.message}`);
  });
  return () => {
    sub1.remove();
    sub2.remove();
  };
}

export function subscribeToPlaylistState(onState: (state: State) => void): () => void {
  const sub = TrackPlayer.addEventListener(Event.PlaybackState, e => onState(e.state));
  return () => sub.remove();
}

// Authoritative "which track is active" while mode === 'all' (TrackPlayer's
// own queue position); single-track modes don't need this since the queue
// only ever has one item.
export function subscribeToActiveTrackChanged(onChange: (index: number) => void): () => void {
  const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, e => {
    if (e.index != null) onChange(e.index);
  });
  return () => sub.remove();
}
