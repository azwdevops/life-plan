package com.azw.lifeplan

import android.app.KeyguardManager
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class AudioAlarmActivity : AppCompatActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
    }
    getSystemService(KeyguardManager::class.java)?.requestDismissKeyguard(this, null)

    val scheduleId = intent.getStringExtra("scheduleId")

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#18181b"))
      setPadding(48, 48, 48, 48)
    }

    val title = TextView(this).apply {
      text = "Life Plan"
      setTextColor(Color.WHITE)
      textSize = 28f
      gravity = Gravity.CENTER
    }

    val subtitle = TextView(this).apply {
      text = "Scheduled audio is playing"
      setTextColor(Color.parseColor("#a1a1aa"))
      textSize = 16f
      gravity = Gravity.CENTER
      setPadding(0, 16, 0, 64)
    }

    val snoozeButton = Button(this).apply {
      text = "Snooze 5 min"
      setOnClickListener {
        sendAction(scheduleId, "SNOOZE")
        finish()
      }
    }

    val silenceButton = Button(this).apply {
      text = "Silence"
      setPadding(0, 32, 0, 0)
      setOnClickListener {
        sendAction(scheduleId, "STOP")
        finish()
      }
    }

    root.addView(title)
    root.addView(subtitle)
    root.addView(snoozeButton)
    root.addView(silenceButton)
    setContentView(root)
  }

  private fun sendAction(scheduleId: String?, action: String) {
    val serviceIntent = Intent(this, AudioScheduleTaskService::class.java).apply {
      putExtra("scheduleId", scheduleId)
      putExtra("action", action)
    }
    ContextCompat.startForegroundService(this, serviceIntent)
  }
}
