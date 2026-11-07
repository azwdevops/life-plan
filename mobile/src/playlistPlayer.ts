import TrackPlayer, { Event, RepeatMode, State } from 'react-native-track-player';
import type { AudioTrack } from './types';
import { ensureTrackPlayerSetup, isTrackPlayerSetUp } from './trackPlayerSetup';

export type PlaylistPlayMode = 'current' | 'all' | 'loopOne';

export function wrapIndex(i: number, len: number): number {
  if (len === 0) return 0;
  return ((i % len) + len) % len;
}

// Set right before a manual (button-triggered) native skip in 'all' mode, so
// the PlaybackActiveTrackChanged it fires isn't mistaken by
// subscribeToTrackCompleted for a track reaching its natural end. Consumed
// (reset to false) by the first such event after being set.
let suppressNextTrackChangeCompletion = false;

// 'all' loads the whole playlist so Next/Previous move through it natively;
// 'current'/'loopOne' load just the one track, so there's nothing to
// auto-advance into and Next/Previous instead reload a different single track.
export async function loadAndPlay(
  tracks: AudioTrack[],
  index: number,
  mode: PlaylistPlayMode,
  startPositionSeconds: number = 0
): Promise<void> {
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
  if (startPositionSeconds > 0) await TrackPlayer.seekTo(startPositionSeconds);
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

export interface RestoredPlaybackState {
  index: number;
  mode: PlaylistPlayMode;
  isPlaying: boolean;
}

// Called when a playlist screen (re)mounts, to recover "what's actually
// playing" from TrackPlayer itself rather than resetting to blank - playback
// keeps running when you navigate away, so this is the real source of truth,
// not any state the screen held before it last unmounted. Returns null if
// nothing is loaded, or what's loaded isn't one of this playlist's tracks
// (e.g. you started a different playlist since leaving this one).
export async function getRestoredPlaybackState(tracks: AudioTrack[]): Promise<RestoredPlaybackState | null> {
  if (!isTrackPlayerSetUp() || tracks.length === 0) return null;
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack) return null;
    const index = tracks.findIndex(t => t.uri === activeTrack.id);
    if (index === -1) return null;

    const [queue, repeatMode, playbackState] = await Promise.all([
      TrackPlayer.getQueue(),
      TrackPlayer.getRepeatMode(),
      TrackPlayer.getPlaybackState(),
    ]);
    const mode: PlaylistPlayMode =
      queue.length > 1 ? 'all' : repeatMode === RepeatMode.Track ? 'loopOne' : 'current';

    return { index, mode, isPlaying: playbackState.state === State.Playing };
  } catch {
    return null;
  }
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

export async function skipToNext(
  tracks: AudioTrack[],
  index: number,
  mode: PlaylistPlayMode,
  resumeSeconds: number = 0
): Promise<number> {
  if (mode === 'all') {
    suppressNextTrackChangeCompletion = true;
    await TrackPlayer.skipToNext().catch(() => {
      suppressNextTrackChangeCompletion = false;
    });
    if (resumeSeconds > 0) await TrackPlayer.seekTo(resumeSeconds).catch(() => {});
    return wrapIndex(index + 1, tracks.length);
  }
  const nextIndex = wrapIndex(index + 1, tracks.length);
  await loadAndPlay(tracks, nextIndex, mode, resumeSeconds);
  return nextIndex;
}

export async function skipToPrevious(
  tracks: AudioTrack[],
  index: number,
  mode: PlaylistPlayMode,
  resumeSeconds: number = 0
): Promise<number> {
  if (mode === 'all') {
    suppressNextTrackChangeCompletion = true;
    await TrackPlayer.skipToPrevious().catch(() => {
      suppressNextTrackChangeCompletion = false;
    });
    if (resumeSeconds > 0) await TrackPlayer.seekTo(resumeSeconds).catch(() => {});
    return wrapIndex(index - 1, tracks.length);
  }
  const prevIndex = wrapIndex(index - 1, tracks.length);
  await loadAndPlay(tracks, prevIndex, mode, resumeSeconds);
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

// Fires exactly once per track that reaches its own natural end (not a
// manual pause/stop/skip) - i.e. a "complete play" for play-count purposes.
// Two native signals feed this:
//  - PlaybackActiveTrackChanged: in 'all' mode, the queue auto-advancing from
//    one track to the next mid-playlist. `lastIndex` is the sortedTracks
//    index of the track that just finished (the queue is loaded in
//    sortedTracks order). Guarded against the identical event a manual
//    Next/Previous button press produces via suppressNextTrackChangeCompletion.
//  - PlaybackQueueEnded: fires when the active track's queue has nothing left
//    to auto-advance to - true for 'current' (stops) and 'loopOne' (loops
//    the same track) every time that single track ends, and for 'all' mode's
//    very last track. In all of those cases the track that ended is still
//    whatever `currentIndex` was, so the caller's current value is used
//    directly rather than trusting the native queue index (which is always 0
//    for the single-track modes).
export function subscribeToTrackCompleted(
  mode: PlaylistPlayMode,
  currentIndex: number,
  onCompleted: (completedIndex: number) => void
): () => void {
  const sub1 = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, e => {
    if (mode !== 'all' || e.index == null || e.lastIndex == null) return;
    if (suppressNextTrackChangeCompletion) {
      suppressNextTrackChangeCompletion = false;
      return;
    }
    onCompleted(e.lastIndex);
  });
  const sub2 = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    onCompleted(currentIndex);
  });
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
