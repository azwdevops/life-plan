package com.azw.lifeplan

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class TaskReminderActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val taskId = intent.getStringExtra("taskId")
    val action = intent.getStringExtra("action") ?: return

    context.getSystemService(NotificationManager::class.java)?.cancel(taskId.hashCode())
    TaskReminderModule.stopReminderSound()

    HeadlessJsTaskService.acquireWakeLockNow(context)
    val serviceIntent = Intent(context, TaskReminderTaskService::class.java).apply {
      putExtra("taskId", taskId)
      putExtra("action", action)
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }
}
