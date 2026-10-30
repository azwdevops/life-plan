import TrackPlayer, { Event, RepeatMode } from 'react-native-track-player';
import type { AudioTrack } from './types';
import { ensureTrackPlayerSetup, isTrackPlayerSetUp } from './trackPlayerSetup';

export async function playTracksLooped(tracks: AudioTrack[], title: string): Promise<void> {
  if (tracks.length === 0) return;
  await ensureTrackPlayerSetup();
  await TrackPlayer.reset();
  await TrackPlayer.add(
    tracks.map(t => ({ id: t.uri, url: t.uri, title: t.fileName, artist: title }))
  );
  await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  await TrackPlayer.play();
}

export async function stopPlayback(): Promise<void> {
  if (!isTrackPlayerSetUp()) return;
  await TrackPlayer.reset();
}

export async function playClip(uri: string, title: string): Promise<void> {
  await ensureTrackPlayerSetup();
  await TrackPlayer.reset();
  await TrackPlayer.add({ id: uri, url: uri, title });
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
  await TrackPlayer.play();
}

export function subscribeToPlaybackErrors(onError: (message: string) => void): () => void {
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
