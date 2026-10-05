package com.spendd.receipts

import android.content.Context
import android.net.Uri
import androidx.core.app.NotificationManagerCompat
import androidx.work.BackoffPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit

/** What a share or import may hand to the logging pipeline. */
object IntakeRules {
    const val MAX_IMAGES = 10
    const val MAX_IMAGE_BYTES = 25L * 1024 * 1024

    /** Only content:// images: a file:// URI could point at the app's own private files. */
    fun acceptsUri(scheme: String?, mimeType: String?): Boolean =
        scheme.equals("content", ignoreCase = true) && mimeType?.lowercase()?.startsWith("image/") == true

    /** Copies at most [limit] bytes; returns false (output incomplete) when the input is larger. */
    fun copyBounded(input: InputStream, output: OutputStream, limit: Long = MAX_IMAGE_BYTES): Boolean {
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) return true
            total += read
            if (total > limit) return false
            output.write(buffer, 0, read)
        }
    }
}

/** Queues shared or picked screenshots for background OCR. */
object ReceiptIntake {

    private const val INBOX = "receipt-inbox"

    /**
     * Copies each image into app-private storage first: read access to a shared content:// URI
     * ends when the receiving activity finishes, long before the worker runs. Reads files, so call
     * it off the main thread. Takes at most [IntakeRules.MAX_IMAGES]; skips images over
     * [IntakeRules.MAX_IMAGE_BYTES]. Returns how many images were queued.
     */
    fun submit(context: Context, uris: List<Uri>, sourceApp: String?): Int {
        val inbox = File(context.filesDir, INBOX).apply { mkdirs() }
        var queued = 0
        for (uri in uris.take(IntakeRules.MAX_IMAGES)) {
            val file = File(inbox, "${UUID.randomUUID()}.img")
            val copied = runCatching {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    file.outputStream().use { IntakeRules.copyBounded(input, it) }
                } ?: false
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
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .addTag(ReceiptWorker.TAG)
                .build()
            WorkManager.getInstance(context).enqueue(request)
            queued++
        }
        return queued
    }

    /** Cancels pending logging jobs, deletes queued screenshots and clears their notifications. */
    fun clearPending(context: Context) {
        WorkManager.getInstance(context).cancelAllWorkByTag(ReceiptWorker.TAG).result.get(10, TimeUnit.SECONDS)
        val inbox = File(context.filesDir, INBOX)
        if (inbox.exists() && !inbox.deleteRecursively()) throw IOException("Couldn’t delete queued screenshots")
        NotificationManagerCompat.from(context).cancelAll()
    }
}
