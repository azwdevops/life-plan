import TrackPlayer, { Capability, Event, RepeatMode } from 'react-native-track-player';
import type { AudioTrack } from './types';

let setupDone = false;

async function ensureSetup(): Promise<void> {
  if (setupDone) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
  });
  setupDone = true;
}

export async function playTracksLooped(tracks: AudioTrack[], title: string): Promise<void> {
  if (tracks.length === 0) return;
  await ensureSetup();
  await TrackPlayer.reset();
  await TrackPlayer.add(
    tracks.map(t => ({ id: t.uri, url: t.uri, title: t.fileName, artist: title }))
  );
  await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  await TrackPlayer.play();
}

export async function stopPlayback(): Promise<void> {
  if (!setupDone) return;
  await TrackPlayer.reset();
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
