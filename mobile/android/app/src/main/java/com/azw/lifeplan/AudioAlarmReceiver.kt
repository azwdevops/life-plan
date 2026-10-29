package com.azw.lifeplan

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class AudioAlarmReceiver : BroadcastReceiver() {

  companion object {
    private const val CHANNEL_ID = "audio_alarm_screen"
    private const val NOTIFICATION_ID = 7822
  }

  override fun onReceive(context: Context, intent: Intent) {
    val scheduleId = intent.getStringExtra("scheduleId")
    val action = intent.getStringExtra("action")

    HeadlessJsTaskService.acquireWakeLockNow(context)
    val serviceIntent = Intent(context, AudioScheduleTaskService::class.java).apply {
      putExtra("scheduleId", scheduleId)
      putExtra("action", action)
    }
    ContextCompat.startForegroundService(context, serviceIntent)

    if (action == "START") {
      try {
        showFullScreenAlarm(context, scheduleId)
      } catch (e: Exception) {
        Log.e("AudioAlarmReceiver", "Could not show full-screen alarm", e)
      }
    }
  }

  private fun showFullScreenAlarm(context: Context, scheduleId: String?) {
    val manager = context.getSystemService(NotificationManager::class.java)
      ?: run {
        Log.e("AudioAlarmReceiver", "NotificationManager unavailable")
        return
      }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Audio alarm",
        NotificationManager.IMPORTANCE_HIGH
      )
      manager.createNotificationChannel(channel)
    }

    val alarmScreenIntent = Intent(context, AudioAlarmActivity::class.java).apply {
      putExtra("scheduleId", scheduleId)
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
    }
    val fullScreenPendingIntent = PendingIntent.getActivity(
      context,
      (scheduleId ?: "").hashCode(),
      alarmScreenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification: Notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle("Life Plan")
      .setContentText("Scheduled audio is playing")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setFullScreenIntent(fullScreenPendingIntent, true)
      .setContentIntent(fullScreenPendingIntent)
      .setAutoCancel(true)
      .build()

    manager.notify(NOTIFICATION_ID, notification)
  }
}
