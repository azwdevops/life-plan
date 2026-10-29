import { NativeModules } from 'react-native';
import type { Task } from './types';
import { nextOccurrenceEpochMillis } from './time';

const { TaskReminderModule } = NativeModules;

export async function scheduleTaskAlarm(taskId: string, epochMillis: number): Promise<void> {
  await TaskReminderModule.scheduleAlarm(taskId, epochMillis);
}

export async function cancelTaskAlarm(taskId: string): Promise<void> {
  await TaskReminderModule.cancelAlarm(taskId);
}

export async function cancelReminderNotification(taskId: string): Promise<void> {
  await TaskReminderModule.cancelReminderNotification(taskId);
}

export function isReminderPending(task: Task): boolean {
  return task.type === 'automated' && !task.done && !task.ignored && !!task.startTime;
}

export async function syncTaskReminder(task: Task): Promise<void> {
  if (isReminderPending(task)) {
    await scheduleTaskAlarm(task.id, nextOccurrenceEpochMillis(task.startTime!));
  } else {
    await cancelTaskAlarm(task.id);
  }
}
