import { NativeModules } from 'react-native';
import { loadTasks, loadSettings, saveTasks } from './storage';
import { scheduleTaskAlarm, cancelTaskAlarm, cancelReminderNotification, isReminderPending } from './nativeTaskReminder';
import { nextOccurrenceEpochMillis } from './time';

const { TaskReminderModule } = NativeModules;

interface TaskReminderTriggerData {
  taskId?: string;
  action: 'FIRE' | 'SNOOZE' | 'DONE' | 'RESCHEDULE_ALL';
}

export default async function taskReminderTask(data: TaskReminderTriggerData): Promise<void> {
  const tasks = await loadTasks();

  if (data.action === 'RESCHEDULE_ALL') {
    for (const task of tasks) {
      if (isReminderPending(task)) {
        await scheduleTaskAlarm(task.id, nextOccurrenceEpochMillis(task.startTime!));
      }
    }
    return;
  }

  const task = tasks.find(t => t.id === data.taskId);
  if (!task) return;

  if (data.action === 'SNOOZE') {
    if (task.done || task.ignored) return;
    const settings = await loadSettings();
    await scheduleTaskAlarm(task.id, Date.now() + settings.taskSnoozeSeconds * 1000);
    return;
  }

  if (data.action === 'DONE') {
    const updated = tasks.map(t => (t.id === task.id ? { ...t, done: true } : t));
    await saveTasks(updated);
    await cancelTaskAlarm(task.id);
    await cancelReminderNotification(task.id);
    return;
  }

  if (task.done || task.ignored) return;

  await TaskReminderModule.showReminderNotification(task.id, task.text);

  const repeatMinutes = task.repeatMinutes && task.repeatMinutes > 0 ? task.repeatMinutes : 1;
  await scheduleTaskAlarm(task.id, Date.now() + repeatMinutes * 60_000);
}
