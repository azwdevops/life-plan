import { NativeModules } from 'react-native';
import type { AudioSchedule } from './types';
import { nextOccurrenceEpochMillis } from './time';

const { AudioScheduleModule } = NativeModules;

export type AlarmAction = 'START' | 'STOP';

export { nextOccurrenceEpochMillis };

export async function scheduleAlarm(
  scheduleId: string,
  epochMillis: number,
  action: AlarmAction
): Promise<void> {
  await AudioScheduleModule.scheduleAlarm(scheduleId, epochMillis, action);
}

export async function cancelAlarm(scheduleId: string, action: AlarmAction): Promise<void> {
  await AudioScheduleModule.cancelAlarm(scheduleId, action);
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  return AudioScheduleModule.canScheduleExactAlarms();
}

export async function openExactAlarmSettings(): Promise<void> {
  await AudioScheduleModule.openExactAlarmSettings();
}

export async function syncScheduleAlarms(schedule: AudioSchedule): Promise<void> {
  if (schedule.enabled && schedule.tracks.length > 0) {
    await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.startTime), 'START');
    await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.endTime), 'STOP');
  } else {
    await cancelAlarm(schedule.id, 'START');
    await cancelAlarm(schedule.id, 'STOP');
  }
}

export async function cancelScheduleAlarms(scheduleId: string): Promise<void> {
  await cancelAlarm(scheduleId, 'START');
  await cancelAlarm(scheduleId, 'STOP');
}
