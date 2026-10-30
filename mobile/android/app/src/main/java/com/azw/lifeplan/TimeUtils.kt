package com.azw.lifeplan

import java.util.Calendar

object TimeUtils {
  /** Next epoch (ms) at which the given "HH:MM:SS" time of day occurs, rolling to tomorrow if already passed. */
  fun nextOccurrenceEpochMillis(hhmmss: String, fromMillis: Long = System.currentTimeMillis()): Long {
    val parts = hhmmss.split(":").map { it.toIntOrNull() ?: 0 }
    val h = parts.getOrElse(0) { 0 }
    val m = parts.getOrElse(1) { 0 }
    val s = parts.getOrElse(2) { 0 }

    val target = Calendar.getInstance()
    target.timeInMillis = fromMillis
    target.set(Calendar.HOUR_OF_DAY, h)
    target.set(Calendar.MINUTE, m)
    target.set(Calendar.SECOND, s)
    target.set(Calendar.MILLISECOND, 0)

    if (target.timeInMillis <= fromMillis) {
      target.add(Calendar.DAY_OF_MONTH, 1)
    }
    return target.timeInMillis
  }
}
