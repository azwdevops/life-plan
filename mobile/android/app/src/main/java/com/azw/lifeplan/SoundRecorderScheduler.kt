package com.azw.lifeplan

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/**
 * Daily scheduled "turn listening on" alarm, plus the config needed to
 * re-arm it after a reboot - kept in native SharedPreferences (not JS
 * AsyncStorage) so BootReceiver can reschedule it without any JS/headless
 * task involvement, the same way the alarm re-arms itself for the next day
 * when it fires (see SoundRecorderAlarmReceiver).
 */
object SoundRecorderScheduler {
  private const val REQUEST_CODE = 93101
  private const val PREFS_NAME = "sound_recorder_schedule"

  private fun pendingIntentFor(context: Context, maxClips: Int, startTime: String): PendingIntent {
    val intent = Intent(context, SoundRecorderAlarmReceiver::class.java).apply {
      putExtra("maxClips", maxClips)
      putExtra("startTime", startTime)
    }
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun showIntentFor(context: Context): PendingIntent {
    return PendingIntent.getActivity(
      context,
      REQUEST_CODE,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun schedule(context: Context, epochMillis: Long, maxClips: Int, startTime: String) {
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    alarmManager.setAlarmClock(
      AlarmManager.AlarmClockInfo(epochMillis, showIntentFor(context)),
      pendingIntentFor(context, maxClips, startTime)
    )
    savePersistedConfig(context, enabled = true, startTime = startTime, maxClips = maxClips)
  }

  fun cancel(context: Context) {
    val persisted = loadPersistedConfig(context)
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    alarmManager.cancel(pendingIntentFor(context, persisted.maxClips, persisted.startTime))
    savePersistedConfig(context, enabled = false, startTime = persisted.startTime, maxClips = persisted.maxClips)
  }

  data class Config(val enabled: Boolean, val startTime: String, val maxClips: Int)

  fun loadPersistedConfig(context: Context): Config {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return Config(
      enabled = prefs.getBoolean("enabled", false),
      startTime = prefs.getString("startTime", "08:00:00") ?: "08:00:00",
      maxClips = prefs.getInt("maxClips", 0)
    )
  }

  private fun savePersistedConfig(context: Context, enabled: Boolean, startTime: String, maxClips: Int) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putBoolean("enabled", enabled)
      .putString("startTime", startTime)
      .putInt("maxClips", maxClips)
      .apply()
  }

  /** Re-arms the alarm after a reboot, if it was left enabled. */
  fun rescheduleIfEnabled(context: Context) {
    val config = loadPersistedConfig(context)
    if (!config.enabled) return
    val nextTrigger = TimeUtils.nextOccurrenceEpochMillis(config.startTime)
    schedule(context, nextTrigger, config.maxClips, config.startTime)
  }
}
