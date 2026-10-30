package com.azw.lifeplan

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class SoundRecorderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val maxClips = intent.getIntExtra("maxClips", 0)
    val startTime = intent.getStringExtra("startTime") ?: return

    val serviceIntent = Intent(context, SoundRecorderService::class.java).apply {
      putExtra("maxClips", maxClips)
    }
    ContextCompat.startForegroundService(context, serviceIntent)

    // Entirely native re-arm for tomorrow's occurrence of the same time - this
    // is a daily recurring schedule, no JS/headless task needed to repeat it.
    val nextTrigger = TimeUtils.nextOccurrenceEpochMillis(startTime, System.currentTimeMillis() + 1000)
    SoundRecorderScheduler.schedule(context, nextTrigger, maxClips, startTime)
  }
}
