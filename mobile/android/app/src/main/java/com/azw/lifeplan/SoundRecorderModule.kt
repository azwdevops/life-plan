package com.azw.lifeplan

import android.content.Intent
import android.media.MediaMetadataRetriever
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class SoundRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    // Set on construction (one instance per live bridge) so the background
    // service - which has no ReactApplicationContext of its own - can notify
    // JS the moment a clip is saved or listening stops, instead of JS having
    // to poll for it.
    @Volatile private var instance: SoundRecorderModule? = null

    fun emitUpdate() {
      instance?.let { module ->
        module.reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("SoundRecorderUpdate", null)
      }
    }
  }

  init {
    instance = this
  }

  override fun getName(): String = "SoundRecorderModule"

  @ReactMethod
  fun startListening(maxClips: Int, promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, SoundRecorderService::class.java).apply {
        putExtra("maxClips", maxClips)
      }
      ContextCompat.startForegroundService(reactApplicationContext, intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("start_listening_error", e.message, e)
    }
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    try {
      reactApplicationContext.stopService(Intent(reactApplicationContext, SoundRecorderService::class.java))
      SoundRecorderService.resetStatus()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("stop_listening_error", e.message, e)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val map = Arguments.createMap().apply {
      putBoolean("isListening", SoundRecorderService.isListening)
      putInt("clipsRecorded", SoundRecorderService.clipsRecorded)
      putInt("maxClips", SoundRecorderService.maxClips)
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun listRecordings(promise: Promise) {
    try {
      val dir = SoundRecorderService.recordingsDir(reactApplicationContext)
      val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".m4a") } ?: emptyArray()
      val retriever = MediaMetadataRetriever()
      val result: WritableArray = Arguments.createArray()
      files.sortedByDescending { it.lastModified() }.forEach { file ->
        var durationSeconds = 0.0
        try {
          retriever.setDataSource(file.absolutePath)
          val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
          durationSeconds = (durationMs?.toLongOrNull() ?: 0L) / 1000.0
        } catch (e: Exception) {
          // leave duration at 0 if the file can't be probed
        }
        val map = Arguments.createMap().apply {
          putString("fileName", file.name)
          putString("path", file.absolutePath)
          putDouble("createdAtMillis", file.lastModified().toDouble())
          putDouble("durationSeconds", durationSeconds)
        }
        result.pushMap(map)
      }
      retriever.release()
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("list_recordings_error", e.message, e)
    }
  }

  @ReactMethod
  fun deleteRecording(fileName: String, promise: Promise) {
    try {
      val dir = SoundRecorderService.recordingsDir(reactApplicationContext)
      val file = File(dir, fileName)
      if (file.exists()) file.delete()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("delete_recording_error", e.message, e)
    }
  }

  @ReactMethod
  fun setAppAudioPlaying(isPlaying: Boolean, promise: Promise) {
    SoundRecorderService.setAppAudioSourceActive("track_player", isPlaying)
    promise.resolve(null)
  }

  @ReactMethod
  fun scheduleStart(epochMillis: Double, maxClips: Int, startTime: String, promise: Promise) {
    try {
      SoundRecorderScheduler.schedule(reactApplicationContext, epochMillis.toLong(), maxClips, startTime)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("schedule_start_error", e.message, e)
    }
  }

  @ReactMethod
  fun cancelScheduledStart(promise: Promise) {
    try {
      SoundRecorderScheduler.cancel(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("cancel_scheduled_start_error", e.message, e)
    }
  }

  @ReactMethod
  fun getScheduledStart(promise: Promise) {
    val config = SoundRecorderScheduler.loadPersistedConfig(reactApplicationContext)
    val map = Arguments.createMap().apply {
      putBoolean("enabled", config.enabled)
      putString("startTime", config.startTime)
      putInt("maxClips", config.maxClips)
    }
    promise.resolve(map)
  }
}
