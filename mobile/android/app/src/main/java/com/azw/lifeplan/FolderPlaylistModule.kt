package com.azw.lifeplan

import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

class FolderPlaylistModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FolderPlaylistModule"

  @ReactMethod
  fun listAudioFiles(treeUri: String, promise: Promise) {
    try {
      val dir = DocumentFile.fromTreeUri(reactApplicationContext, Uri.parse(treeUri))
      if (dir == null || !dir.exists()) {
        promise.reject("folder_not_found", "Folder no longer accessible")
        return
      }
      val files: WritableArray = Arguments.createArray()
      dir.listFiles()
        .filter {
          it.isFile &&
            !isTrashed(it.name) &&
            (it.type?.startsWith("audio/") == true || hasAudioExtension(it.name))
        }
        .sortedBy { it.name?.lowercase() }
        .forEach { file ->
          val map = Arguments.createMap().apply {
            putString("uri", file.uri.toString())
            putString("name", file.name ?: "Untitled")
            putDouble("lastModified", file.lastModified().toDouble())
          }
          files.pushMap(map)
        }
      val result = Arguments.createMap().apply {
        putString("folderName", dir.name ?: "Playlist")
        putArray("files", files)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("list_audio_files_error", e.message, e)
    }
  }

  private fun hasAudioExtension(name: String?): Boolean {
    val lower = name?.lowercase() ?: return false
    return listOf(".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac", ".wma", ".opus").any { lower.endsWith(it) }
  }

  // Android's Recycle Bin (API 30+) soft-deletes by renaming the file with a
  // ".trashed-<timestamp>-" prefix in place, rather than removing it - exclude
  // those rather than showing deleted files as still playable.
  private fun isTrashed(name: String?): Boolean {
    return name?.startsWith(".trashed-") == true
  }
}
