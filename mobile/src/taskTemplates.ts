import { newId } from './id';
import { loadTaskTemplates, loadTasks, saveTasks } from './storage';
import { todayDateStr, todayDayOfWeek } from './time';
import type { Task } from './types';

/** For each recurring template due today (today's weekday is in its days[])
 * that doesn't already have a Task created for today, creates one. Returns
 * whether anything was created, so the caller knows to reload the task list. */
export async function materializeDueTemplates(): Promise<boolean> {
  const [templates, tasks] = await Promise.all([loadTaskTemplates(), loadTasks()]);
  if (templates.length === 0) return false;

  const today = todayDayOfWeek();
  const todayStr = todayDateStr();
  const created: Task[] = [];

  for (const template of templates) {
    if (!template.days.includes(today)) continue;
    const alreadyCreated = tasks.some(
      t => t.templateId === template.id && t.instanceDate === todayStr
    );
    if (alreadyCreated) continue;

    created.push({
      id: newId(),
      text: template.text,
      type: template.type,
      done: false,
      ignored: false,
      createdAt: new Date().toISOString(),
      templateId: template.id,
      instanceDate: todayStr,
      ...(template.type === 'automated'
        ? { startTime: template.startTime, repeatMinutes: template.repeatMinutes }
        : {}),
    });
  }

  if (created.length === 0) return false;
  await saveTasks([...created, ...tasks]);
  return true;
}
