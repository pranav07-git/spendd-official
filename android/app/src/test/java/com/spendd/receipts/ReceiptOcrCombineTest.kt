package com.spendd.receipts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Lines verbatim from the PhonePe sample's per-pass dump (ReceiptOcrDumpTest). */
class ReceiptOcrCombineTest {

    private fun l(text: String, top: Int, height: Int, left: Int, width: Int, c: Float) = OcrLine(text, top, height, left, width, c)

    private val original = listOf(
        l("Payment Successful", 306, 31, 190, 320, 0.90f),
        l("14 July 2026 at 11:30 PM", 354, 25, 180, 340, 0.88f),
        l("Rohi JoshT", 482, 31, 230, 210, 0.48f),
        l("XXXXXX8133", 535, 22, 230, 190, 0.85f),
        l("Split Expense", 603, 26, 470, 170, 0.89f),
        l("Starting F29,999\"", 1370, 20, 50, 160, 0.79f),
    )
    private val greyscale = listOf(
        l("Payment Successful", 303, 34, 190, 320, 0.89f),
        l("Jo", 482, 68, 68, 118, 0.36f), // the purple avatar
        l("RohiJosht", 483, 31, 230, 210, 0.39f),
        l("1", 598, 34, 232, 30, 0.68f), // the "₹1" the colour pass missed
        l("Split Expense", 604, 25, 470, 170, 0.87f),
    )
    private val ink = listOf(l("PenStecesu", 303, 36, 190, 320, 0.24f), l("1130", 31, 22, 40, 60, 0.32f))

    @Test
    fun combinesThePassesIntoOneCleanReading() {
        val lines = ReceiptOcr.combine(listOf(original, greyscale, ink))
        val texts = lines.map { it.text }
        assertTrue("amount recovered", "1" in texts)
        assertFalse("avatar dropped", "Jo" in texts)
        assertFalse("ink-map noise dropped", "PenStecesu" in texts || "1130" in texts)
        assertEquals("one reading per line", 1, texts.count { it.startsWith("Payment") })

        val parsed = ReceiptParser.parse(lines, 1600)
        assertEquals(1.0, parsed.amount!!, 0.0)
        assertEquals("Rohi JoshT", parsed.counterparty)
    }
}
