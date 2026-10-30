package com.azw.lifeplan

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

class SoundRecorderService : Service() {

  companion object {
    private const val CHANNEL_ID = "sound_recorder_listening"
    private const val NOTIFICATION_ID = 9931
    private const val SAMPLE_RATE = 16000

    // RMS threshold (16-bit PCM range, max 32767) above which incoming audio
    // counts as "sound" rather than ambient noise. May need tuning per device.
    private const val SOUND_THRESHOLD = 1200
    private const val SILENCE_STOP_MS = 3000L
    private const val READ_CHUNK_MS = 100L
    private const val MIN_CLIP_MS = 300L

    @Volatile var isListening: Boolean = false
    @Volatile var clipsRecorded: Int = 0
    @Volatile var maxClips: Int = 0 // 0 = infinite

    fun resetStatus() {
      isListening = false
      clipsRecorded = 0
      maxClips = 0
    }

    fun recordingsDir(context: Context): File {
      val dir = File(context.filesDir, "recordings")
      if (!dir.exists()) dir.mkdirs()
      return dir
    }

    // Tracks named sources of audio THIS APP is currently playing (the task
    // reminder's notification sound, TrackPlayer-driven audio schedules/clip
    // previews) so the capture loop can ignore those chunks entirely, rather
    // than letting our own playback trigger or feed into a recording. A set
    // (not a single boolean/counter) so overlapping or repeated start/stop
    // signals from independent sources can't desync each other.
    private val activeAppAudioSources = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
    val appAudioPlaying: Boolean
      get() = activeAppAudioSources.isNotEmpty()

    fun setAppAudioSourceActive(source: String, active: Boolean) {
      if (active) activeAppAudioSources.add(source) else activeAppAudioSources.remove(source)
    }
  }

  private val running = AtomicBoolean(false)
  private var captureThread: Thread? = null

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Sound recorder", NotificationManager.IMPORTANCE_LOW)
      manager.createNotificationChannel(channel)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    maxClips = intent?.getIntExtra("maxClips", 0) ?: 0
    clipsRecorded = 0
    isListening = true

    startForeground(NOTIFICATION_ID, buildNotification("Listening for sound…"))

    if (running.compareAndSet(false, true)) {
      val thread = Thread { runCaptureLoop() }
      captureThread = thread
      thread.start()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    running.set(false)
    isListening = false
    captureThread = null
  }

  override fun onBind(intent: Intent?) = null

  private fun buildNotification(text: String): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Life Plan")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(text: String) {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, buildNotification(text))
  }

  private fun runCaptureLoop() {
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
      != PackageManager.PERMISSION_GRANTED
    ) {
      running.set(false)
      isListening = false
      stopSelfSafely()
      return
    }

    val minBufSize = AudioRecord.getMinBufferSize(
      SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
    )
    val bufferSize = maxOf(minBufSize, SAMPLE_RATE * 2)
    val audioRecord = AudioRecord(
      MediaRecorder.AudioSource.MIC,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      bufferSize
    )

    val chunkSamples = (SAMPLE_RATE * READ_CHUNK_MS / 1000).toInt()
    val chunk = ShortArray(chunkSamples)
    val chunkBytes = ByteArray(chunkSamples * 2)

    var clipRecorder: AacClipRecorder? = null
    var clipFile: File? = null
    var clipDurationMs = 0L
    var silenceAccumMs = 0L

    try {
      audioRecord.startRecording()
      while (running.get()) {
        val read = audioRecord.read(chunk, 0, chunk.size)
        if (read <= 0) continue
        if (appAudioPlaying) continue // don't let our own app's playback trigger/feed a recording

        val rms = rmsOf(chunk, read)
        val loud = rms >= SOUND_THRESHOLD
        shortsToBytes(chunk, read, chunkBytes)

        if (clipRecorder == null) {
          if (loud) {
            val file = newClipFile()
            clipFile = file
            clipRecorder = AacClipRecorder(file, SAMPLE_RATE)
            clipRecorder.writePcm(chunkBytes, read * 2)
            clipDurationMs = READ_CHUNK_MS
            silenceAccumMs = 0
            updateNotification("Recording…")
          }
        } else {
          clipRecorder.writePcm(chunkBytes, read * 2)
          clipDurationMs += READ_CHUNK_MS
          if (loud) {
            silenceAccumMs = 0
          } else {
            silenceAccumMs += READ_CHUNK_MS
            if (silenceAccumMs >= SILENCE_STOP_MS) {
              finishClip(clipRecorder, clipFile!!, clipDurationMs)
              clipRecorder = null
              clipFile = null
              silenceAccumMs = 0

              if (maxClips > 0 && clipsRecorded >= maxClips) {
                updateNotification("Finished - $clipsRecorded clip(s) recorded")
                running.set(false)
              } else {
                updateNotification("Listening for sound…")
              }
            }
          }
        }
      }

      // Save (or discard, if too short) whatever was mid-recording when stopped.
      if (clipRecorder != null && clipFile != null) {
        finishClip(clipRecorder, clipFile, clipDurationMs)
      }
    } finally {
      audioRecord.stop()
      audioRecord.release()
      isListening = false
      SoundRecorderModule.emitUpdate()
      stopSelfSafely()
    }
  }

  private fun finishClip(recorder: AacClipRecorder, file: File, durationMs: Long) {
    if (durationMs < MIN_CLIP_MS) {
      recorder.discard(file)
      return
    }
    recorder.finish()
    clipsRecorded += 1
    SoundRecorderModule.emitUpdate()
  }

  private fun stopSelfSafely() {
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (e: Exception) {
      // ignore
    }
    stopSelf()
  }

  private fun rmsOf(chunk: ShortArray, len: Int): Double {
    var sum = 0.0
    for (i in 0 until len) {
      val v = chunk[i].toDouble()
      sum += v * v
    }
    return sqrt(sum / len)
  }

  private fun shortsToBytes(chunk: ShortArray, len: Int, out: ByteArray) {
    for (i in 0 until len) {
      val v = chunk[i].toInt()
      out[i * 2] = (v and 0xFF).toByte()
      out[i * 2 + 1] = ((v shr 8) and 0xFF).toByte()
    }
  }

  private fun newClipFile(): File {
    val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
    return File(recordingsDir(this), "rec_$timestamp.m4a")
  }
}
