package com.azw.lifeplan

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File

/**
 * Encodes one clip's worth of 16-bit mono PCM into AAC and muxes it into an
 * .m4a file, fed incrementally via writePcm() as audio arrives from the
 * continuous AudioRecord tap (so sound-triggered start/stop stays sample-
 * accurate - only the encoding+muxing step is different from raw PCM).
 */
class AacClipRecorder(
  outputFile: File,
  private val sampleRate: Int,
  private val channelCount: Int = 1,
  bitRate: Int = 64000,
) {
  private val codec: MediaCodec
  private val muxer: MediaMuxer
  private var trackIndex = -1
  private var muxerStarted = false
  private var presentationTimeUs = 0L
  private val bufferInfo = MediaCodec.BufferInfo()
  private val bytesPerSample = 2 * channelCount

  init {
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 8192)
    }
    codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
  }

  fun writePcm(pcm: ByteArray, len: Int) {
    var offset = 0
    while (offset < len) {
      val inputIndex = codec.dequeueInputBuffer(10_000)
      if (inputIndex < 0) {
        drainEncoder(false)
        continue
      }
      val inputBuffer = codec.getInputBuffer(inputIndex) ?: break
      inputBuffer.clear()
      val chunkSize = minOf(inputBuffer.capacity(), len - offset)
      inputBuffer.put(pcm, offset, chunkSize)
      val durationUs = (chunkSize.toLong() * 1_000_000L) / (sampleRate.toLong() * bytesPerSample)
      codec.queueInputBuffer(inputIndex, 0, chunkSize, presentationTimeUs, 0)
      presentationTimeUs += durationUs
      offset += chunkSize
      drainEncoder(false)
    }
  }

  private fun drainEncoder(endOfStream: Boolean) {
    if (endOfStream) {
      val inputIndex = codec.dequeueInputBuffer(10_000)
      if (inputIndex >= 0) {
        codec.queueInputBuffer(inputIndex, 0, 0, presentationTimeUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      }
    }
    while (true) {
      val outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000)
      when {
        outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) return
        }
        outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          trackIndex = muxer.addTrack(codec.outputFormat)
          muxer.start()
          muxerStarted = true
        }
        outputIndex >= 0 -> {
          val outputBuffer = codec.getOutputBuffer(outputIndex)
          if (outputBuffer != null && bufferInfo.size > 0 && muxerStarted) {
            outputBuffer.position(bufferInfo.offset)
            outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
            muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo)
          }
          codec.releaseOutputBuffer(outputIndex, false)
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  /** Finalizes and closes the output file. */
  fun finish() {
    drainEncoder(true)
    try {
      if (muxerStarted) muxer.stop()
    } finally {
      muxer.release()
      codec.stop()
      codec.release()
    }
  }

  /** Aborts without producing a usable file - used for clips too short to keep. */
  fun discard(outputFile: File) {
    try {
      codec.stop()
    } catch (e: Exception) {
      // already stopped
    }
    codec.release()
    try {
      muxer.release()
    } catch (e: Exception) {
      // never started
    }
    outputFile.delete()
  }
}
