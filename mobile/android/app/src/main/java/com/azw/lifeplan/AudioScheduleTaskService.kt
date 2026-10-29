package com.azw.lifeplan

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AudioScheduleTaskService : HeadlessJsTaskService() {

  companion object {
    private const val CHANNEL_ID = "audio_schedule_trigger"
    private const val NOTIFICATION_ID = 7821
  }

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Scheduled audio",
        NotificationManager.IMPORTANCE_MIN
      )
      manager.createNotificationChannel(channel)
    }
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Starting scheduled audio")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .build()
    startForeground(NOTIFICATION_ID, notification)
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val scheduleId = intent?.getStringExtra("scheduleId")
    val action = intent?.getStringExtra("action") ?: return null
    val data = Arguments.createMap().apply {
      putString("scheduleId", scheduleId)
      putString("action", action)
    }
    return HeadlessJsTaskConfig("AudioScheduleTrigger", data, 20000L, true)
  }

  override fun onHeadlessJsTaskFinish(taskId: Int) {
    super.onHeadlessJsTaskFinish(taskId)
    stopForeground(STOP_FOREGROUND_REMOVE)
  }
}
