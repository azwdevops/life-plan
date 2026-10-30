import TrackPlayer, { Capability, Event, State } from 'react-native-track-player';
import { notifyAppAudioPlaying } from './nativeSoundRecorder';

// TrackPlayer's native player is a single app-wide instance, so setup must
// happen exactly once no matter how many features (audio schedules,
// recording-clip previews, folder playlists) end up using it.
let setupDone = false;

export async function ensureTrackPlayerSetup(): Promise<void> {
  if (setupDone) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
  });
  // Lets the sound recorder ignore our own TrackPlayer-driven playback
  // (audio schedules, recording-clip previews, folder playlists) instead of
  // treating it as detected sound, regardless of which feature started it.
  TrackPlayer.addEventListener(Event.PlaybackState, e => {
    void notifyAppAudioPlaying(e.state === State.Playing);
  });
  setupDone = true;
}

export function isTrackPlayerSetUp(): boolean {
  return setupDone;
}
