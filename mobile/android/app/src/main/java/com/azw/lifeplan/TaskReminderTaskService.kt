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

class TaskReminderTaskService : HeadlessJsTaskService() {

  companion object {
    private const val CHANNEL_ID = "task_reminder_trigger"
    private const val NOTIFICATION_ID = 7823
  }

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Task reminder sync",
        NotificationManager.IMPORTANCE_MIN
      )
      manager.createNotificationChannel(channel)
    }
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Checking task reminder")
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .build()
    startForeground(NOTIFICATION_ID, notification)
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val taskId = intent?.getStringExtra("taskId")
    val action = intent?.getStringExtra("action") ?: return null
    val data = Arguments.createMap().apply {
      putString("taskId", taskId)
      putString("action", action)
    }
    return HeadlessJsTaskConfig("TaskReminderTrigger", data, 20000L, true)
  }

  override fun onHeadlessJsTaskFinish(taskId: Int) {
    super.onHeadlessJsTaskFinish(taskId)
    stopForeground(STOP_FOREGROUND_REMOVE)
  }
}
