import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { SoundRecorderModule } = NativeModules;

export interface SoundRecorderStatus {
  isListening: boolean;
  clipsRecorded: number;
  maxClips: number;
}

export interface Recording {
  fileName: string;
  path: string;
  createdAtMillis: number;
  durationSeconds: number;
}

export interface ScheduledStart {
  enabled: boolean;
  startTime: string; // HH:MM:SS, daily
  maxClips: number; // 0 = infinite
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function startListening(maxClips: number): Promise<void> {
  await SoundRecorderModule.startListening(maxClips);
}

export async function stopListening(): Promise<void> {
  await SoundRecorderModule.stopListening();
}

export async function getRecorderStatus(): Promise<SoundRecorderStatus> {
  return SoundRecorderModule.getStatus();
}

export async function listRecordings(): Promise<Recording[]> {
  return SoundRecorderModule.listRecordings();
}

export async function deleteRecording(fileName: string): Promise<void> {
  await SoundRecorderModule.deleteRecording(fileName);
}

// Lets the sound-recorder's capture loop know this app (not an external
// source) is currently playing audio, so it can ignore those chunks rather
// than treating our own playback as detected sound.
export async function notifyAppAudioPlaying(isPlaying: boolean): Promise<void> {
  await SoundRecorderModule.setAppAudioPlaying(isPlaying);
}

// Fires the instant the native service saves a clip or stops listening, so
// the UI can refresh immediately instead of waiting for the session to end.
export function subscribeToRecorderUpdates(onUpdate: () => void): () => void {
  const sub = DeviceEventEmitter.addListener('SoundRecorderUpdate', onUpdate);
  return () => sub.remove();
}

export async function scheduleListeningStart(
  epochMillis: number,
  maxClips: number,
  startTime: string
): Promise<void> {
  await SoundRecorderModule.scheduleStart(epochMillis, maxClips, startTime);
}

export async function cancelScheduledStart(): Promise<void> {
  await SoundRecorderModule.cancelScheduledStart();
}

export async function getScheduledStart(): Promise<ScheduledStart> {
  return SoundRecorderModule.getScheduledStart();
}
