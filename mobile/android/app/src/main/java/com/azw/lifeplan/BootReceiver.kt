package com.azw.lifeplan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    HeadlessJsTaskService.acquireWakeLockNow(context)
    val audioIntent = Intent(context, AudioScheduleTaskService::class.java).apply {
      putExtra("action", "RESCHEDULE_ALL")
    }
    ContextCompat.startForegroundService(context, audioIntent)

    val taskIntent = Intent(context, TaskReminderTaskService::class.java).apply {
      putExtra("action", "RESCHEDULE_ALL")
    }
    ContextCompat.startForegroundService(context, taskIntent)

    SoundRecorderScheduler.rescheduleIfEnabled(context)
  }
}
