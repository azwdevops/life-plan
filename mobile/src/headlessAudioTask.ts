import { loadAudioSchedules } from './storage';
import { playTracksLooped, stopPlayback } from './audioPlayer';
import { scheduleAlarm, nextOccurrenceEpochMillis } from './nativeAudioAlarm';

interface AudioScheduleTriggerData {
  scheduleId?: string;
  action: 'START' | 'STOP' | 'SNOOZE' | 'RESCHEDULE_ALL';
}

const SNOOZE_MINUTES = 5;

export default async function headlessAudioTask(data: AudioScheduleTriggerData): Promise<void> {
  const schedules = await loadAudioSchedules();

  if (data.action === 'RESCHEDULE_ALL') {
    for (const schedule of schedules) {
      if (schedule.enabled && schedule.tracks.length > 0) {
        await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.startTime), 'START');
        await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.endTime), 'STOP');
      }
    }
    return;
  }

  const schedule = schedules.find(s => s.id === data.scheduleId);
  if (!schedule) return;

  if (data.action === 'START') {
    if (schedule.enabled && schedule.tracks.length > 0) {
      await playTracksLooped(schedule.tracks, schedule.label);
    }
    await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.startTime), 'START');
  } else if (data.action === 'STOP') {
    await stopPlayback();
    await scheduleAlarm(schedule.id, nextOccurrenceEpochMillis(schedule.endTime), 'STOP');
  } else if (data.action === 'SNOOZE') {
    await stopPlayback();
    await scheduleAlarm(schedule.id, Date.now() + SNOOZE_MINUTES * 60_000, 'START');
  }
}
