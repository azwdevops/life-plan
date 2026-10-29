package com.azw.lifeplan

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TaskReminderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val CHANNEL_ID = "task_reminders_v3"
    private const val SOUND_DURATION_MS = 30_000L

    private var mediaPlayer: MediaPlayer? = null
    private val stopHandler = Handler(Looper.getMainLooper())
    private var stopRunnable: Runnable? = null

    fun playReminderSound(context: Context) {
      stopReminderSound()
      try {
        val player = MediaPlayer.create(context, R.raw.task_reminder_sound) ?: return
        player.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        player.setOnCompletionListener { stopReminderSound() }
        player.start()
        mediaPlayer = player

        val runnable = Runnable { stopReminderSound() }
        stopRunnable = runnable
        stopHandler.postDelayed(runnable, SOUND_DURATION_MS)
      } catch (e: Exception) {
        stopReminderSound()
      }
    }

    fun stopReminderSound() {
      stopRunnable?.let { stopHandler.removeCallbacks(it) }
      stopRunnable = null
      mediaPlayer?.let {
        try {
          if (it.isPlaying) it.stop()
          it.release()
        } catch (e: Exception) {
          // already released/stopped
        }
      }
      mediaPlayer = null
    }
  }

  override fun getName(): String = "TaskReminderModule"

  private fun showIntentFor(): PendingIntent {
    val intent = Intent(reactApplicationContext, MainActivity::class.java)
    return PendingIntent.getActivity(
      reactApplicationContext,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun pendingIntentFor(taskId: String): PendingIntent {
    val intent = Intent(reactApplicationContext, TaskReminderReceiver::class.java).apply {
      putExtra("taskId", taskId)
    }
    val requestCode = taskId.hashCode()
    return PendingIntent.getBroadcast(
      reactApplicationContext,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun actionPendingIntentFor(taskId: String, action: String): PendingIntent {
    val intent = Intent(reactApplicationContext, TaskReminderActionReceiver::class.java).apply {
      putExtra("taskId", taskId)
      putExtra("action", action)
    }
    val requestCode = (taskId + action).hashCode()
    return PendingIntent.getBroadcast(
      reactApplicationContext,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  @ReactMethod
  fun scheduleAlarm(taskId: String, epochMillis: Double, promise: Promise) {
    try {
      val alarmManager = reactApplicationContext.getSystemService(AlarmManager::class.java)
      alarmManager.setAlarmClock(
        AlarmManager.AlarmClockInfo(epochMillis.toLong(), showIntentFor()),
        pendingIntentFor(taskId)
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("schedule_task_alarm_error", e.message, e)
    }
  }

  @ReactMethod
  fun cancelAlarm(taskId: String, promise: Promise) {
    try {
      val alarmManager = reactApplicationContext.getSystemService(AlarmManager::class.java)
      alarmManager.cancel(pendingIntentFor(taskId))
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("cancel_task_alarm_error", e.message, e)
    }
  }

  @ReactMethod
  fun showReminderNotification(taskId: String, text: String, promise: Promise) {
    try {
      val manager = reactApplicationContext.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(CHANNEL_ID, "Task reminders", NotificationManager.IMPORTANCE_HIGH)
        channel.setSound(null, null)
        manager.createNotificationChannel(channel)
      }
      val notification = NotificationCompat.Builder(reactApplicationContext, CHANNEL_ID)
        .setContentTitle("Life Plan")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_popup_reminder)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setAutoCancel(false)
        .setOngoing(true)
        .addAction(
          android.R.drawable.ic_lock_idle_alarm,
          "Snooze",
          actionPendingIntentFor(taskId, "SNOOZE")
        )
        .addAction(
          android.R.drawable.checkbox_on_background,
          "Done",
          actionPendingIntentFor(taskId, "DONE")
        )
        .build()
      manager.notify(taskId.hashCode(), notification)
      playReminderSound(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("show_reminder_notification_error", e.message, e)
    }
  }

  @ReactMethod
  fun cancelReminderNotification(taskId: String, promise: Promise) {
    try {
      reactApplicationContext.getSystemService(NotificationManager::class.java)?.cancel(taskId.hashCode())
      stopReminderSound()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("cancel_reminder_notification_error", e.message, e)
    }
  }
}
