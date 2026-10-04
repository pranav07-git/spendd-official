package com.spendd.receipts

import android.content.Context
import android.net.Uri
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.io.File
import java.util.UUID

/** Queues shared or picked screenshots for background OCR. */
object ReceiptIntake {

    /**
     * Copies each image into app-private storage first: read access to a shared content:// URI
     * ends when the receiving activity finishes, long before the worker runs.
     * Returns how many images were queued.
     */
    fun submit(context: Context, uris: List<Uri>, sourceApp: String?): Int {
        val inbox = File(context.filesDir, "receipt-inbox").apply { mkdirs() }
        var queued = 0
        for (uri in uris) {
            val file = File(inbox, "${UUID.randomUUID()}.img")
            val copied = runCatching {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    file.outputStream().use { input.copyTo(it) }
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
                .build()
            WorkManager.getInstance(context).enqueue(request)
            queued++
        }
        return queued
    }
}
