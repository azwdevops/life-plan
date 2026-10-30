export type TaskType = 'manual' | 'automated';

export interface Task {
  id: string;
  text: string;
  type: TaskType;
  done: boolean;
  ignored: boolean;
  createdAt: string;
  /** automated only: time of day (HH:MM:SS) the first reminder fires */
  startTime?: string;
  /** automated only: minutes between repeat reminders until done/ignored */
  repeatMinutes?: number;
}

export interface AudioTrack {
  uri: string;
  fileName: string;
}

export interface AudioSchedule {
  id: string;
  label: string;
  tracks: AudioTrack[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  createdAt: string;
}

export interface AppSettings {
  taskSnoozeSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  taskSnoozeSeconds: 300,
};

/** A picked folder, treated as a playlist - its tracks are re-read from the
 * folder each time it's opened rather than cached, so it always reflects
 * what's actually in the folder. */
export interface Playlist {
  id: string;
  name: string;
  folderUri: string;
  createdAt: string;
}
