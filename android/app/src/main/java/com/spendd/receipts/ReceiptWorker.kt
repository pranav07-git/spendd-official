package com.spendd.receipts

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.File
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** OCRs one queued screenshot on-device, parses it and logs the transaction. */
class ReceiptWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val path = inputData.getString(KEY_IMAGE_PATH) ?: return Result.failure()
        val sourceApp = inputData.getString(KEY_SOURCE_APP)
        val notificationId = inputData.getInt(KEY_NOTIFICATION_ID, 0)
        val image = File(path)
        if (!image.exists()) {
            ReceiptNotifications.failed(applicationContext, notificationId, "Couldn’t read that image. Try sharing it again.")
            return Result.success()
        }

        try {
            if (runAttemptCount >= MAX_ATTEMPTS) throw IllegalStateException("Stopped by the system $runAttemptCount times")
            logReceipt(image, sourceApp, notificationId)
        } catch (e: CancellationException) {
            // The system stopped this job (battery saver, app update…). Keep the screenshot:
            // WorkManager runs the job again and it is read then.
            throw e
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to read receipt", e)
            logUnreadable(sourceApp, notificationId)
        }
        // The screenshot is only needed for OCR; don't keep financial images around.
        image.delete()
        return Result.success()
    }

    /** Expedited work shows the "Logging transaction…" notification while it runs. */
    override suspend fun getForegroundInfo(): ForegroundInfo {
        val id = inputData.getInt(KEY_NOTIFICATION_ID, 0)
        val notification = ReceiptNotifications.loggingNotification(applicationContext)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(id, notification)
        }
    }

    private suspend fun logReceipt(image: File, sourceApp: String?, notificationId: Int) {
        run {
            val (lines, imageHeight) = ReceiptOcr.recognize(image)
            val parsed = ReceiptParser.parse(lines, imageHeight)
            val amount = parsed.amount
            if (amount == null && !parsed.looksLikePayment) {
                ReceiptNotifications.failed(
                    applicationContext,
                    notificationId,
                    "That image doesn’t look like a payment. Share the final “payment successful” screen.",
                )
                return
            }

            val dateFromReceipt = parsed.date != null
            val occurredAt = parsed.date?.let(::toEpochMillis) ?: System.currentTimeMillis()
            val store = TransactionStore(applicationContext)
            if (amount != null && store.findDuplicate(parsed.txnRef, amount, parsed.counterparty, occurredAt, dateFromReceipt) != null) {
                ReceiptNotifications.logged(
                    applicationContext,
                    notificationId,
                    "Already logged",
                    "${formatRupees(amount)} ${describe(parsed)} is in your transactions.",
                )
                return
            }

            val (category, kind) = Categories.classify(parsed.counterparty, parsed.handle)
            store.add(
                JSONObject().apply {
                    put("id", UUID.randomUUID().toString())
                    put("amount", amount ?: JSONObject.NULL)
                    put("currency", "INR")
                    put("direction", if (parsed.direction == Direction.CREDIT) "credit" else "debit")
                    put("counterparty", parsed.counterparty ?: JSONObject.NULL)
                    put("handle", parsed.handle ?: JSONObject.NULL)
                    put("txnRef", parsed.txnRef ?: JSONObject.NULL)
                    put("bank", parsed.bank ?: JSONObject.NULL)
                    put("source", sourceApp ?: parsed.provider ?: JSONObject.NULL)
                    put("category", category)
                    put("kind", kind)
                    put("occurredAt", occurredAt)
                    put("hasTime", parsed.date?.hour != null || !dateFromReceipt)
                    put("dateFromReceipt", dateFromReceipt)
                    // Logged even when the amount couldn't be read, so no shared payment is lost.
                    put("needsReview", amount == null || parsed.counterparty == null)
                    put("createdAt", System.currentTimeMillis())
                    put("rawText", lines.joinToString("\n") { it.text })
                },
            )
            if (amount != null) {
                ReceiptNotifications.logged(applicationContext, notificationId, "Transaction logged", "${formatRupees(amount)} ${describe(parsed)}")
            } else {
                ReceiptNotifications.logged(
                    applicationContext,
                    notificationId,
                    "Transaction logged · needs review",
                    "Couldn’t read the amount${parsed.counterparty?.let { " paid to $it" } ?: ""}. Open Spendd to add it.",
                )
            }
            return
        }
    }

    /** Never drop a shared payment: log it for the user to complete by hand. */
    private fun logUnreadable(sourceApp: String?, notificationId: Int) {
        val logged = runCatching {
                TransactionStore(applicationContext).add(
                    JSONObject().apply {
                        put("id", UUID.randomUUID().toString())
                        put("amount", JSONObject.NULL)
                        put("currency", "INR")
                        put("direction", "debit")
                        put("counterparty", JSONObject.NULL)
                        put("handle", JSONObject.NULL)
                        put("txnRef", JSONObject.NULL)
                        put("bank", JSONObject.NULL)
                        put("source", sourceApp ?: JSONObject.NULL)
                        put("category", "Personal")
                        put("kind", "personal")
                        put("occurredAt", System.currentTimeMillis())
                        put("hasTime", true)
                        put("dateFromReceipt", false)
                        put("needsReview", true)
                        put("createdAt", System.currentTimeMillis())
                        put("rawText", "")
                    },
                )
            }.isSuccess
        if (logged) {
            ReceiptNotifications.logged(
                applicationContext,
                notificationId,
                "Transaction logged · needs review",
                "Couldn’t read the screenshot. Open Spendd to add the amount and payee.",
            )
        } else {
            ReceiptNotifications.failed(applicationContext, notificationId, "Couldn’t read that image. Try sharing it again.")
        }
    }

    private fun describe(parsed: ParsedReceipt): String {
        val who = parsed.counterparty ?: return if (parsed.direction == Direction.CREDIT) "received" else "paid"
        return if (parsed.direction == Direction.CREDIT) "from $who" else "to $who"
    }

    private fun formatRupees(amount: Double): String =
        NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
            maximumFractionDigits = if (amount % 1.0 == 0.0) 0 else 2
        }.format(amount)

    private fun toEpochMillis(date: ParsedDate): Long =
        Calendar.getInstance().apply {
            clear()
            set(date.year, date.month - 1, date.day, date.hour ?: 12, date.minute ?: 0)
        }.timeInMillis

    companion object {
        const val TAG = "receipt"
        private const val MAX_ATTEMPTS = 5
        const val KEY_IMAGE_PATH = "imagePath"
        const val KEY_SOURCE_APP = "sourceApp"
        const val KEY_NOTIFICATION_ID = "notificationId"
    }
}
