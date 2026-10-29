package com.azw.lifeplan

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioScheduleModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AudioScheduleModule"

  private fun pendingIntentFor(scheduleId: String, action: String): PendingIntent {
    val intent = Intent(reactApplicationContext, AudioAlarmReceiver::class.java).apply {
      putExtra("scheduleId", scheduleId)
      putExtra("action", action)
    }
    val requestCode = (scheduleId + action).hashCode()
    return PendingIntent.getBroadcast(
      reactApplicationContext,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  @ReactMethod
  fun scheduleAlarm(scheduleId: String, epochMillis: Double, action: String, promise: Promise) {
    try {
      val alarmManager = reactApplicationContext.getSystemService(AlarmManager::class.java)
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        epochMillis.toLong(),
        pendingIntentFor(scheduleId, action)
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("schedule_alarm_error", e.message, e)
    }
  }

  @ReactMethod
  fun cancelAlarm(scheduleId: String, action: String, promise: Promise) {
    try {
      val alarmManager = reactApplicationContext.getSystemService(AlarmManager::class.java)
      alarmManager.cancel(pendingIntentFor(scheduleId, action))
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("cancel_alarm_error", e.message, e)
    }
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val alarmManager = reactApplicationContext.getSystemService(AlarmManager::class.java)
      promise.resolve(alarmManager.canScheduleExactAlarms())
    } else {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:" + reactApplicationContext.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("open_settings_error", e.message, e)
    }
  }
}
