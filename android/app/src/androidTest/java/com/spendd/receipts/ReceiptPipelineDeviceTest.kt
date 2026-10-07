package com.spendd.receipts

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Calendar

/**
 * End to end on a real device: image → multi-pass ML Kit OCR → parser.
 *
 * Synthetic receipts are drawn here with different colours, sizes and layouts (no app-specific
 * styling) so the pipeline is exercised beyond the few real screenshots available.
 */
@RunWith(AndroidJUnit4::class)
class ReceiptPipelineDeviceTest {

    private data class Row(val text: String, val size: Float, val bold: Boolean = false)

    private fun render(background: Int, foreground: Int, vararg rows: Row): Bitmap {
        val bitmap = Bitmap.createBitmap(1080, 2160, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap).apply { drawColor(background) }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = foreground; textAlign = Paint.Align.CENTER }
        var y = 300f
        for (row in rows) {
            paint.textSize = row.size
            paint.typeface = if (row.bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            y += row.size
            canvas.drawText(row.text, 540f, y, paint)
            y += 36f
        }
        return bitmap
    }

    private var lastLines: List<OcrLine> = emptyList()

    private fun parse(bitmap: Bitmap): ParsedReceipt = runBlocking {
        val (lines, height) = ReceiptOcr.recognize(bitmap)
        lastLines = lines
        ReceiptParser.parse(lines, height)
    }

    private fun check(name: String, parsed: ParsedReceipt, amount: Double, counterparty: String) {
        val ocr = lastLines.joinToString(" | ") { "${it.top}:h${it.height} ${it.text}" }
        assertEquals("$name amount ($parsed) OCR: $ocr", amount, parsed.amount ?: -1.0, 0.001)
        assertEquals("$name counterparty ($parsed) OCR: $ocr", counterparty.lowercase(), parsed.counterparty?.lowercase())
        assertTrue("$name is logged as a payment", parsed.looksLikePayment)
    }

    @Test
    fun syntheticReceipts() {
        check(
            "light card, amount below payee",
            parse(
                render(
                    Color.WHITE, Color.BLACK,
                    Row("Payment Successful", 44f, true), Row("14 Jul 2026, 11:30 PM", 34f),
                    Row("Rohit Joshi", 46f, true), Row("XXXXXX8133", 34f), Row("₹1", 120f, true), Row("Split Expense", 34f),
                ),
            ),
            1.0, "Rohit Joshi",
        )
        check(
            "dark bank label/value",
            parse(
                render(
                    Color.rgb(18, 18, 18), Color.WHITE,
                    Row("Transaction Successful", 46f, true), Row("Amount", 30f), Row("₹ 2,450.00", 40f, true),
                    Row("Paid To", 30f), Row("Swiggy Limited", 38f), Row("Date & Time", 30f),
                    Row("12/07/2026 08:45 PM", 34f), Row("UPI Ref No.", 30f), Row("418723901234", 34f),
                ),
            ),
            2450.0, "Swiggy Limited",
        )
        check(
            "green, paid to a person",
            parse(
                render(
                    Color.rgb(27, 94, 32), Color.WHITE,
                    Row("Paid to", 36f), Row("Priya Sharma", 48f, true), Row("₹5,000", 130f, true),
                    Row("Debited from Kotak Mahindra Bank", 32f), Row("3 Aug 2026, 10:12 AM", 32f),
                ),
            ),
            5000.0, "Priya Sharma",
        )
        val relative = parse(
            render(
                Color.rgb(59, 10, 87), Color.WHITE,
                Row("₹349", 150f, true), Row("Paid to Zomato", 40f), Row("Today, 1:05 PM", 34f),
            ),
        )
        check("purple, relative date", relative, 349.0, "Zomato")
        assertEquals(Calendar.getInstance().get(Calendar.DAY_OF_MONTH), relative.date?.day)
        check(
            "grey, Rs. and VPA payee",
            parse(
                render(
                    Color.rgb(240, 240, 240), Color.rgb(33, 33, 33),
                    Row("Rs. 120.50", 100f, true), Row("Sent to 9876543210@ybl", 36f), Row("Jul 9, 2026 9:02 AM", 32f),
                ),
            ),
            120.5, "9876543210@ybl",
        )
        check(
            "huge amount, caps payee",
            parse(
                render(
                    Color.BLACK, Color.rgb(230, 230, 230),
                    Row("₹12,499", 190f, true), Row("to MAYANK JAIN", 40f, true),
                    Row("Paid via BHIM UPI", 32f), Row("5 Sep 2026 at 8:20 PM", 32f),
                ),
            ),
            12499.0, "Mayank Jain",
        )
    }

    /** Real screenshots live in androidTest/assets/receipts (git-ignored: they hold personal data). */
    @Test
    fun realScreenshots() {
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        val expected = mapOf(
            "gpay_dark.jpg" to (1.0 to "Rohit Joshi"),
            "navi_ticket.jpg" to (1000.0 to "Aditya Raj"),
            "supermoney.jpg" to (1.0 to "Harshit Saini"),
        )
        val available = assets.list("receipts").orEmpty().toSet()
        assumeTrue("no real screenshots bundled", available.isNotEmpty())
        for ((name, want) in expected) {
            if (name !in available) continue
            val bitmap = assets.open("receipts/$name").use { BitmapFactory.decodeStream(it) }
            check(name, parse(bitmap), want.first, want.second)
        }
        // The PhonePe sample's payee is covered by an annotation box, so only the amount is checked.
        if ("phonepe_card.jpg" in available) {
            val bitmap = assets.open("receipts/phonepe_card.jpg").use { BitmapFactory.decodeStream(it) }
            assertEquals(1.0, parse(bitmap).amount ?: -1.0, 0.001)
        }
    }
}
