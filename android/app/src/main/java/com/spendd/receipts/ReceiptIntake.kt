package com.spendd.receipts

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/** Queues shared or picked screenshots for background OCR. */
object ReceiptIntake {
    /** Images per share; more than this is not someone logging their payments. */
    const val MAX_IMAGES = 10
    /** A phone screenshot is well under this; anything bigger is refused rather than filling storage. */
    private const val MAX_BYTES = 15L * 1024 * 1024

    /** Copies at most [MAX_BYTES]; throws past that, so the partial file is discarded. */
    private fun copyCapped(input: InputStream, output: OutputStream) {
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) return
            total += read
            if (total > MAX_BYTES) throw IOException("Image larger than $MAX_BYTES bytes")
            output.write(buffer, 0, read)
        }
    }

    /**
     * Copies each image into app-private storage first: read access to a shared content:// URI
     * ends when the receiving activity finishes, long before the worker runs.
     * Returns how many images were queued.
     */
    fun submit(context: Context, uris: List<Uri>, sourceApp: String?): Int {
        val inbox = File(context.filesDir, "receipt-inbox").apply { mkdirs() }
        var queued = 0
        // Only content:// (what share sheets and pickers hand out). file:// could point Spendd at
        // its own private files, and anything else isn't an image from another app.
        for (uri in uris.filter { it.scheme == ContentResolver.SCHEME_CONTENT }.take(MAX_IMAGES)) {
            val file = File(inbox, "${UUID.randomUUID()}.img")
            val copied = runCatching {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    file.outputStream().use { copyCapped(input, it) }
                } != null
            }.getOrDefault(false)
            if (!copied) {
                file.delete()
                continue
            }

            val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt() + queued
            ReceiptNotifications.logging(context, notificationId)
            val request = OneTimeWorkRequestBuilder<ReceiptWorker>()
                .setInputData(
                    workDataOf(
                        ReceiptWorker.KEY_IMAGE_PATH to file.absolutePath,
                        ReceiptWorker.KEY_SOURCE_APP to sourceApp,
                        ReceiptWorker.KEY_NOTIFICATION_ID to notificationId,
                    ),
                )
                .addTag(ReceiptWorker.TAG)
                // User-triggered and short: expedited jobs start at once and are far less likely
                // to be stopped by battery management than regular background work.
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
            WorkManager.getInstance(context).enqueue(request)
            queued++
        }
        return queued
    }
}
