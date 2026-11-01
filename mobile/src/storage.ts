import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, AudioSchedule, Playlist, Task, TaskTemplate } from './types';
import { DEFAULT_SETTINGS } from './types';

const TASKS_KEY = 'lifeplan:tasks';
const TASK_TEMPLATES_KEY = 'lifeplan:task_templates';
const AUDIO_SCHEDULES_KEY = 'lifeplan:audio_schedules';
const SETTINGS_KEY = 'lifeplan:settings';
const PLAYLISTS_KEY = 'lifeplan:playlists';

export async function loadTasks(): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(TASKS_KEY);
  return raw ? (JSON.parse(raw) as Task[]) : [];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function loadTaskTemplates(): Promise<TaskTemplate[]> {
  const raw = await AsyncStorage.getItem(TASK_TEMPLATES_KEY);
  return raw ? (JSON.parse(raw) as TaskTemplate[]) : [];
}

export async function saveTaskTemplates(templates: TaskTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TASK_TEMPLATES_KEY, JSON.stringify(templates));
}

export async function loadAudioSchedules(): Promise<AudioSchedule[]> {
  const raw = await AsyncStorage.getItem(AUDIO_SCHEDULES_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as AudioSchedule[];
  return parsed.map(s => ({ ...s, tracks: Array.isArray(s.tracks) ? s.tracks : [] }));
}

export async function saveAudioSchedules(schedules: AudioSchedule[]): Promise<void> {
  await AsyncStorage.setItem(AUDIO_SCHEDULES_KEY, JSON.stringify(schedules));
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadPlaylists(): Promise<Playlist[]> {
  const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
  return raw ? (JSON.parse(raw) as Playlist[]) : [];
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}
