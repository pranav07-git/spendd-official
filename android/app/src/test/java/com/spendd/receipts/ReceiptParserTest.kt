package com.spendd.receipts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The first four fixtures are verbatim ML Kit output (text, top, height) from real payment
 * screenshots, captured on a phone by ReceiptOcrDumpTest. Note how OCR drops or mangles "₹".
 */
class ReceiptParserTest {

    private val today = ParsedDate(2026, 10, 4, null, null)

    private fun parse(height: Int, vararg rows: Triple<Int, Int, String>) =
        ReceiptParser.parse(rows.map { (top, h, text) -> OcrLine(text, top, h) }, height, today)

    /** Synthetic layouts: rows are spaced evenly; pass a height per row. */
    private fun parseRows(vararg rows: Pair<String, Int>) =
        ReceiptParser.parse(rows.mapIndexed { i, (text, h) -> OcrLine(text, 200 + i * 70, h) }, 1600, today)

    @Test
    fun googlePayDark() {
        val r = parse(
            1513,
            Triple(885, 79, "1.00"),
            Triple(1090, 29, "Paid to"),
            Triple(1130, 27, "merchant 0.95"), // annotation drawn on the sample image
            Triple(1159, 45, "Rohit Joshi"),
            Triple(1244, 36, "Paytm •9837738133@ptyes"),
            Triple(1322, 36, "13 July 2026, 3:38 pm"),
        )
        assertEquals(1.0, r.amount!!, 0.0)
        assertEquals("Rohit Joshi", r.counterparty)
        assertEquals("9837738133@ptyes", r.handle)
        assertEquals(ParsedDate(2026, 7, 13, 15, 38), r.date)
        assertEquals(Direction.DEBIT, r.direction)
    }

    @Test
    fun naviTicket() {
        val r = parse(
            1600,
            Triple(109, 32, "Paid securely on"),
            Triple(171, 51, "n navVII UPL"),
            Triple(280, 34, "4 IN 1.9 SECONDS"),
            Triple(479, 32, "Payment successful"),
            Triple(509, 44, "merchant 0.92"),
            Triple(551, 48, "to ADITYA RAJ"),
            Triple(629, 39, "adityaraj7612@oksbi"),
            Triple(772, 106, "1,000"),
            Triple(924, 35, "Paid via Navi UPI"),
            Triple(1156, 31, "14 Jul 2026, 7:14 PM"),
            Triple(1225, 41, "from Pranav Raj"),
            Triple(1296, 27, "State Bank of India - 1072"),
            Triple(1395, 27, "UPI txn ID:656116935626"),
        )
        assertEquals(1000.0, r.amount!!, 0.0)
        assertEquals("Aditya Raj", r.counterparty)
        assertEquals("adityaraj7612@oksbi", r.handle)
        assertEquals(ParsedDate(2026, 7, 14, 19, 14), r.date)
        assertEquals("656116935626", r.txnRef)
        assertEquals("State Bank of India", r.bank)
        assertEquals("Navi", r.provider)
        assertEquals(Direction.DEBIT, r.direction)
    }

    @Test
    fun superMoney() {
        val r = parse(
            1600,
            Triple(31, 21, "11:34 O MY"),
            Triple(45, 8, "NR"),
            Triple(111, 20, "X"),
            Triple(113, 21, "?"),
            Triple(240, 50, "1"),
            Triple(295, 26, "merchant 0.92"),
            Triple(323, 20, "to harshit saini"),
            Triple(593, 20, "Paid in 0.55 s"),
            Triple(672, 20, "14 Jul 2026 at 11:34 PM"),
            Triple(720, 19, "TXN ID: FMPIB6166482490"),
            Triple(796, 19, "View Details"),
            Triple(918, 27, "Pay Again"),
            Triple(962, 23, "Pay Again to harshit saini"),
            Triple(1466, 18, "Unbox Rewards"),
        )
        assertEquals(1.0, r.amount!!, 0.0)
        assertEquals("Harshit Saini", r.counterparty)
        assertEquals(ParsedDate(2026, 7, 14, 23, 34), r.date)
        assertEquals("FMPIB6166482490", r.txnRef)
    }

    private val phonePeFirstPass = arrayOf(
        Triple(28, 27, "ll WiEiO 86%"),
        Triple(32, 19, "11:30"),
        Triple(306, 31, "Payment Successful"),
        Triple(354, 25, "14 July 2026 at 11:30 PM"),
        Triple(454, 31, "merchant 0.94"),
        Triple(482, 31, "Rohi JoshT"),
        Triple(535, 22, "XXXXXX8133"),
        Triple(603, 26, "Split Expense"),
        Triple(761, 18, "View Details"),
        Triple(761, 23, "Share Receipt"),
        Triple(898, 12, "Flipkart"),
        Triple(992, 48, "Phone (4b)"),
        Triple(1041, 19, "Powered by Snapdragon"),
        Triple(1370, 20, "Starting F29,999\""),
        Triple(1447, 23, "Done"),
    )

    @Test
    fun phonePeFirstPassMissesTheAmountButStillLooksLikeAPayment() {
        val r = parse(1600, *phonePeFirstPass)
        assertNull(r.amount) // the ad's "₹29,999" must not be taken
        assertTrue(r.looksLikePayment)
        assertEquals(ParsedDate(2026, 7, 14, 23, 30), r.date)
    }

    @Test
    fun phonePeWithAmountRecoveredByInvertedPass() {
        val r = parse(1600, *phonePeFirstPass, Triple(598, 34, "1"))
        assertEquals(1.0, r.amount!!, 0.0)
        assertEquals("Rohi JoshT", r.counterparty) // OCR garbled by the annotation box on the sample
        assertEquals("XXXXXX8133", r.handle)
    }

    @Test
    fun bankAppLabelValueLayout() {
        val r = parseRows(
            "Transaction Successful" to 34,
            "Amount" to 22,
            "₹ 2,450.00" to 30,
            "Paid To" to 22,
            "Swiggy Limited" to 28,
            "UPI ID" to 22,
            "swiggy.stores@axb" to 26,
            "Date & Time" to 22,
            "12/07/2026 08:45 PM" to 26,
            "UPI Ref No." to 22,
            "418723901234" to 26,
            "Debited From" to 22,
            "HDFC Bank XX4321" to 26,
        )
        assertEquals(2450.0, r.amount!!, 0.0)
        assertEquals("Swiggy Limited", r.counterparty)
        assertEquals(ParsedDate(2026, 7, 12, 20, 45), r.date)
        assertEquals("418723901234", r.txnRef)
        assertEquals("HDFC Bank", r.bank)
    }

    @Test
    fun yearlessAndRelativeDates() {
        val relative = parseRows("349" to 90, "Paid to Zomato" to 28, "Today, 1:05 PM" to 24)
        assertEquals(349.0, relative.amount!!, 0.0)
        assertEquals("Zomato", relative.counterparty)
        assertEquals(ParsedDate(2026, 10, 4, 13, 5), relative.date)

        val yearless = parseRows("Z 1,250" to 80, "Sent to Ravi Kumar" to 28, "28 Dec, 9:41 AM" to 24)
        assertEquals(1250.0, yearless.amount!!, 0.0)
        assertEquals("Ravi Kumar", yearless.counterparty)
        // December is after "today" (October), so it must be last year's.
        assertEquals(ParsedDate(2025, 12, 28, 9, 41), yearless.date)
    }

    @Test
    fun moneyReceived() {
        val r = parseRows(
            "Received from" to 26,
            "Priya Sharma" to 34,
            "+ ₹5,000" to 80,
            "Credited to Kotak Mahindra Bank" to 24,
            "3 Aug 2026, 10:12 AM" to 24,
        )
        assertEquals(Direction.CREDIT, r.direction)
        assertEquals("Priya Sharma", r.counterparty)
        assertEquals(5000.0, r.amount!!, 0.0)
        assertEquals(ParsedDate(2026, 8, 3, 10, 12), r.date)
    }

    @Test
    fun bankSmsStyleSentence() {
        val r = parseRows("Rs.120.50 debited from A/c XX1234 on 09-07-26 to VPA swiggy@icici. UPI Ref 512345678901" to 24)
        assertEquals(120.5, r.amount!!, 0.0)
        assertEquals("swiggy@icici", r.counterparty)
        assertEquals(ParsedDate(2026, 7, 9, null, null), r.date)
        assertEquals("512345678901", r.txnRef)
    }

    @Test
    fun inlineAmountAndPayee() {
        val r = parseRows("Paid ₹1,299 to Myntra Designs" to 30, "on 21 Jun 2026 at 6:40 pm" to 22, "UTR: 617283940516" to 22)
        assertEquals(1299.0, r.amount!!, 0.0)
        assertEquals("Myntra Designs", r.counterparty)
        assertEquals(ParsedDate(2026, 6, 21, 18, 40), r.date)
        assertEquals("617283940516", r.txnRef)
    }

    @Test
    fun uiWordsAreNotNames() {
        val r = parseRows("₹250" to 90, "Today" to 22, "Total" to 22, "Back to Home" to 22)
        assertEquals(250.0, r.amount!!, 0.0)
        assertNull(r.counterparty)
    }

    @Test
    fun nonPaymentImage() {
        val r = parseRows("Hello there" to 30, "See you at 5" to 30)
        assertNull(r.amount)
        assertFalse(r.looksLikePayment)
    }

    @Test
    fun rupeeMisreadAsSevenIsResolvedAcrossPasses() {
        // First pass read "+₹5,000" as "+75,000"; the inverted pass read "+5,000" on the same row.
        val r = parse(
            1600,
            Triple(300, 36, "Received from"),
            Triple(380, 48, "Priya Sharma"),
            Triple(470, 120, "+75,000"),
            Triple(472, 118, "+5,000"),
            Triple(640, 32, "3 Aug 2026, 10:12 AM"),
        )
        assertEquals(5000.0, r.amount!!, 0.0)
    }

    @Test
    fun handlesSplitByOcrAreRejoined() {
        val r = parseRows("Rs. 120.50" to 73, "Sent to 987654321 0@ybl" to 34, "Jul 9, 2026 9:02 AM" to 31)
        assertEquals("9876543210@ybl", r.counterparty)
        assertEquals("9876543210@ybl", r.handle)
        assertEquals("rohit@okaxis", parseRows("₹10" to 80, "Paid to rohit @ okaxis" to 30).handle)
    }

    // ---- only payment confirmations are logged -------------------------------------------------

    @Test
    fun everyPaymentScreenAboveCountsAsAPayment() {
        listOf(
            parseRows("349" to 90, "Paid to Zomato" to 28, "Today, 1:05 PM" to 24),
            parseRows("Z 1,250" to 80, "Sent to Ravi Kumar" to 28, "28 Dec, 9:41 AM" to 24),
            parseRows("Paid ₹1,299 to Myntra Designs" to 30, "on 21 Jun 2026 at 6:40 pm" to 22),
            parseRows("Rs.120.50 debited from A/c XX1234 on 09-07-26 to VPA swiggy@icici. UPI Ref 512345678901" to 24),
            parseRows("Received from" to 26, "Priya Sharma" to 34, "+ ₹5,000" to 80, "3 Aug 2026, 10:12 AM" to 24),
            parseRows("Transaction Successful" to 34, "Amount" to 22, "₹ 2,450.00" to 30, "UPI Ref No." to 22, "418723901234" to 26),
        ).forEach { assertTrue(it.looksLikePayment) }
    }

    @Test
    fun aShoppingPageWithAPriceIsNotAPayment() {
        val r = parseRows("Nike Air Zoom" to 30, "₹1,299" to 80, "Add to cart" to 26, "Buy now" to 26, "Pay with UPI" to 22)
        assertEquals(1299.0, r.amount!!, 0.0)
        assertFalse(r.looksLikePayment)
    }

    @Test
    fun aChatMentioningMoneyIsNotAPayment() {
        val r = parseRows("Today" to 22, "I sent you ₹500 for dinner" to 26, "10:32 pm" to 20)
        assertFalse(r.looksLikePayment)
    }

    @Test
    fun aBillOrPaymentRequestIsNotAPayment() {
        assertFalse(parseRows("Electricity bill" to 30, "₹2,000" to 80, "Due 15 Oct 2026" to 22, "Pay to bescom@ybl" to 22).looksLikePayment)
        assertFalse(parseRows("Ravi requested" to 30, "₹300" to 80, "Pay now" to 26).looksLikePayment)
    }

    @Test
    fun aFailedPaymentIsNotLogged() {
        val r = parseRows("Payment failed" to 30, "₹500" to 80, "to Ravi Kumar" to 26, "UPI Ref 512345678901" to 22)
        assertFalse(r.looksLikePayment)
    }

    @Test
    fun anUnreadableAmountNeedsWordingAndAReference() {
        assertTrue(parseRows("Payment Successful" to 30, "Rohit Joshi" to 26, "XXXXXX8133" to 22).looksLikePayment)
        assertFalse(parseRows("UPI" to 30, "rohit@okaxis" to 26).looksLikePayment)
    }
}
