package com.spendd.receipts

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import org.json.JSONObject
import java.io.File
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

/** OCRs one queued screenshot on-device, parses it and logs the transaction. */
class ReceiptWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val path = inputData.getString(KEY_IMAGE_PATH) ?: return Result.failure()
        val sourceApp = inputData.getString(KEY_SOURCE_APP)
        val notificationId = inputData.getInt(KEY_NOTIFICATION_ID, 0)
        val image = File(path)
        // Kept only while another attempt will need it.
        var keepImage = false

        try {
            if (!image.exists()) {
                // Removed by a reset (or already handled); nothing left to log.
                ReceiptNotifications.cancel(applicationContext, notificationId)
                return Result.failure()
            }
            log(image, sourceApp, notificationId)
            return Result.success()
        } catch (e: CancellationException) {
            // Stopped by WorkManager: it runs the job again later, which needs the screenshot.
            keepImage = true
            throw e
        } catch (e: OutOfMemoryError) {
            ReceiptNotifications.failed(
                applicationContext,
                notificationId,
                "That image is too large to read. Share a regular screenshot of the payment screen.",
            )
            return Result.failure()
        } catch (e: NotAnImageException) {
            ReceiptNotifications.failed(applicationContext, notificationId, "Couldn’t read that image. Try sharing it again.")
            return Result.failure()
        } catch (e: Exception) {
            // OCR, the Keystore or storage can fail for a moment; try again before giving up.
            if (runAttemptCount < MAX_RETRIES) {
                keepImage = true
                return Result.retry()
            }
            ReceiptNotifications.failed(applicationContext, notificationId, "Couldn’t read that image. Try sharing it again.")
            return Result.failure()
        } finally {
            // The screenshot is only needed for OCR; don't keep financial images around.
            if (!keepImage) image.delete()
        }
    }

    private suspend fun log(image: File, sourceApp: String?, notificationId: Int) {
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
        val (category, kind) = Categories.classify(parsed.counterparty, parsed.handle)
        val transaction = JSONObject().apply {
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
        }

        if (TransactionStore(applicationContext).addUnlessDuplicate(transaction) != null) {
            ReceiptNotifications.logged(
                applicationContext,
                notificationId,
                "Already logged",
                if (amount != null) "${formatRupees(amount)} ${describe(parsed)} is in your transactions." else "This payment is in your transactions.",
            )
            return
        }
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
        const val KEY_IMAGE_PATH = "imagePath"
        const val KEY_SOURCE_APP = "sourceApp"
        const val KEY_NOTIFICATION_ID = "notificationId"

        /** Attempts after the first before a failure is reported. */
        private const val MAX_RETRIES = 2
    }
}
