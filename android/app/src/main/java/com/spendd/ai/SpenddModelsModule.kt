package com.spendd.ai

import android.app.ActivityManager
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.spendd.specs.NativeSpenddModelsSpec
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Downloads and manages the optional on-device AI model. Files live in the app's external
 * files dir (no storage permission; removed on uninstall). DownloadManager does the transfer,
 * so it survives the app being backgrounded and resumes after network drops.
 * Spec: src/native/NativeSpenddModels.ts
 */
class SpenddModelsModule(reactContext: ReactApplicationContext) : NativeSpenddModelsSpec(reactContext) {

    private val downloads = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val prefs = reactContext.getSharedPreferences("spendd.models", Context.MODE_PRIVATE)

    /** getExternalFilesDir() is null while shared storage is unavailable; never fall back to a relative path. */
    private fun dir(): File {
        val root = reactApplicationContext.getExternalFilesDir(null)
            ?: throw IllegalStateException("Storage isn’t available right now")
        return File(root, DIR).apply { mkdirs() }
    }
    private fun modelFile(name: String) = File(dir(), name)
    private fun partFile(name: String) = File(dir(), "$name.part")

    override fun startDownload(url: String, fileName: String, title: String, promise: Promise) {
        try {
            if (prefs.contains(fileName)) {
                promise.resolve(null) // already queued
                return
            }
            partFile(fileName).delete()
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setDescription("On-device AI for Spendd")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(reactApplicationContext, null, "$DIR/$fileName.part")
                .setAllowedOverRoaming(false)
            prefs.edit().putLong(fileName, downloads.enqueue(request)).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_DOWNLOAD", e)
        }
    }

    override fun status(fileName: String, promise: Promise) {
        try {
            promise.resolve(readStatus(fileName).toString())
        } catch (e: Exception) {
            promise.reject("E_STATUS", e)
        }
    }

    private fun readStatus(fileName: String): JSONObject {
        val result = JSONObject().put("downloadedBytes", 0).put("totalBytes", 0).put("path", JSONObject.NULL)
        val model = modelFile(fileName)
        if (model.exists() && !prefs.contains(fileName)) {
            return result.put("state", "ready").put("downloadedBytes", model.length()).put("totalBytes", model.length())
                .put("path", model.absolutePath).put("modifiedAt", model.lastModified())
        }
        val id = prefs.getLong(fileName, -1L)
        if (id == -1L) return result.put("state", "none")

        downloads.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
            if (!cursor.moveToFirst()) {
                prefs.edit().remove(fileName).apply()
                return result.put("state", "failed").put("reason", "Download was cancelled")
            }
            val state = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            result.put("downloadedBytes", done).put("totalBytes", maxOf(total, 0))
            return when (state) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    val part = partFile(fileName)
                    model.delete()
                    if (!part.renameTo(model)) throw IllegalStateException("Couldn’t move the model into place")
                    prefs.edit().remove(fileName).apply()
                    result.put("state", "ready").put("path", model.absolutePath)
                        .put("downloadedBytes", model.length()).put("totalBytes", model.length())
                        .put("modifiedAt", model.lastModified())
                }
                DownloadManager.STATUS_FAILED -> {
                    downloads.remove(id)
                    prefs.edit().remove(fileName).apply()
                    partFile(fileName).delete()
                    val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                    result.put("state", "failed").put(
                        "reason",
                        if (reason == DownloadManager.ERROR_INSUFFICIENT_SPACE) "Not enough free space" else "Download failed",
                    )
                }
                DownloadManager.STATUS_PAUSED -> result.put("state", "paused")
                else -> result.put("state", "downloading")
            }
        }
    }

    override fun cancelDownload(fileName: String, promise: Promise) {
        try {
            val id = prefs.getLong(fileName, -1L)
            if (id != -1L) downloads.remove(id)
            prefs.edit().remove(fileName).apply()
            partFile(fileName).delete()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_CANCEL", e)
        }
    }

    override fun deleteModel(fileName: String, promise: Promise) {
        try {
            modelFile(fileName).delete()
            partFile(fileName).delete()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_DELETE", e)
        }
    }

    override fun verify(fileName: String, sha256: String, promise: Promise) {
        Thread {
            try {
                val digest = MessageDigest.getInstance("SHA-256")
                modelFile(fileName).inputStream().use { input ->
                    val buffer = ByteArray(1 shl 20)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        digest.update(buffer, 0, read)
                    }
                }
                val hex = digest.digest().joinToString("") { "%02x".format(it) }
                promise.resolve(hex.equals(sha256, ignoreCase = true))
            } catch (e: Exception) {
                promise.reject("E_VERIFY", e)
            }
        }.start()
    }

    override fun totalMemoryBytes(promise: Promise) {
        val info = ActivityManager.MemoryInfo()
        (reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
        promise.resolve(info.totalMem.toDouble())
    }

    companion object {
        private const val DIR = "models"
    }
}
