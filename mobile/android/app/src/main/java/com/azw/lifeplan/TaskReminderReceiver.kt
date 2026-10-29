package com.azw.lifeplan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class TaskReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val taskId = intent.getStringExtra("taskId")
    HeadlessJsTaskService.acquireWakeLockNow(context)
    val serviceIntent = Intent(context, TaskReminderTaskService::class.java).apply {
      putExtra("taskId", taskId)
      putExtra("action", "FIRE")
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }
}
