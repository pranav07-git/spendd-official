package com.spendd.receipts

import java.util.Calendar
import kotlin.math.abs

/** One line of OCR output. `height` stands in for font size; `confidence` is ML Kit's (0–1). */
data class OcrLine(
    val text: String,
    val top: Int,
    val height: Int,
    val left: Int = 0,
    val width: Int = 0,
    val confidence: Float = 1f,
)

enum class Direction { DEBIT, CREDIT }

data class ParsedDate(val year: Int, val month: Int, val day: Int, val hour: Int?, val minute: Int?)

data class ParsedReceipt(
    val amount: Double?,
    val direction: Direction,
    val counterparty: String?,
    val handle: String?,
    val date: ParsedDate?,
    val txnRef: String?,
    val bank: String?,
    val provider: String?,
    /** Whether the text reads like a payment at all (used when no amount was found). */
    val looksLikePayment: Boolean,
)

/**
 * Pulls payment details out of the OCR text of any UPI / bank "payment done" screen.
 *
 * Nothing here is specific to one app. Payment confirmations share a structure: the amount is
 * the most prominent figure (or sits next to an "Amount" label), the other party follows "to" /
 * "from" or a "Payee"-style label (or is the name printed closest to the amount), and the date
 * and time are printed together. Every field is chosen by scoring candidates against that
 * structure rather than by matching a particular layout.
 *
 * OCR rarely reads "₹": it is dropped or read as R, F, Z, 7, ? and so on, so amounts are also
 * recognised without it.
 */
object ReceiptParser {

    private val IC = setOf(RegexOption.IGNORE_CASE)

    // ---- vocabulary ---------------------------------------------------------------------------

    private const val MONTH =
        "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?"
    private val MONTHS = listOf("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")

    private const val MONEY = "([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{1,9})(?:\\.([0-9]{1,2}))?"
    /** Characters OCR produces in place of the rupee sign. */
    private const val RUPEE_LOOKALIKE = "[₹?%*&=€£fFzZrRE]"

    private val MARKED_AMOUNT = Regex("(?:₹|\\brs\\.?|\\binr)\\s*$MONEY", IC)
    private val BARE_AMOUNT = Regex("^[+\\-]?\\s*(?:($RUPEE_LOOKALIKE|rs\\.?|inr)\\s*)?$MONEY(?:\\s*/-)?(?:\\s+\\S)?$", IC)
    private val AMOUNT_LABEL = Regex("\\b(amount|amt|total|debited|credited|paid|sent|received|value)\\b", IC)
    private val AMOUNT_LABEL_ONLY = Regex("^(?:total\\s+|txn\\s+|transaction\\s+|payment\\s+)?(?:amount|amt)(?:\\s+paid|\\s+sent|\\s+received)?\\s*:?$", IC)
    private val PROMO = Regex("\\b(starting|cashback|upto|up to|off|offer|offers|balance|reward|rewards|emi|save|win|won|worth|coupon|scratch)\\b|\\*", IC)

    private val CREDIT_HINT = Regex(
        "\\b(received from|you received|money received|payment received|received successfully|credited|refund(ed)?)\\b",
        IC,
    )
    private val PAYMENT_HINT = Regex(
        "\\b(paid|payment|pay|transaction|txn|upi|debited|credited|received|sent|transfer(red)?|successful|utr|ref)\\b",
        IC,
    )

    private val INLINE_TO = Regex("(?:^|\\b(?:paid|sent|transferred|paying|payment|transfer|money|debited)\\b.*?)\\bto\\s*:?\\s+(.+)$", IC)
    private val INLINE_FROM = Regex("(?:^|\\b(?:received|credited|money|payment)\\b.*?)\\bfrom\\s*:?\\s+(.+)$", IC)
    private val DEBIT_LABEL = Regex(
        "^(?:paid to|sent to|transferred to|to|payee(?:\\s+name)?|beneficiary(?:\\s+name)?|merchant(?:\\s+name)?|recipient(?:\\s+name)?|receiver(?:\\s+name)?|paying)\\b\\s*:?\\s*(.*)$",
        IC,
    )
    private val CREDIT_LABEL = Regex(
        "^(?:received from|from|sender(?:\\s+name)?|payer(?:\\s+name)?|remitter(?:\\s+name)?)\\b\\s*:?\\s*(.*)$",
        IC,
    )
    private val NAME_TAIL = Regex("\\s+(?:on|ref|upi|via|using|at|for|txn|utr)\\b.*$|\\s*[(\\[].*$", IC)
    private val NAME_PREFIX = Regex("^(?:vpa|a/c|ac|account|mr\\.?|ms\\.?|mrs\\.?)\\s+", IC)

    /** Generic UI words that are never the other party's name. */
    private val NOT_A_NAME = Regex(
        "\\b(success|successful|successfully|completed|complete|payment|paid|split|details|share|receipt|done|" +
            "upi|txn|transaction|again|via|secure|securely|seconds|reward|rewards|unbox|help|view|debited|" +
            "credited|ref|status|total|amount|balance|today|yesterday|expense|cashback|offer|ad|home|close|back|" +
            "download|support|report|invoice|check|add|favourite|favorite|contact|bill|history)\\b",
        IC,
    )

    private val HANDLE = Regex("[a-z0-9._\\-]{2,}@[a-z]{2,}", IC)
    private val MASKED_ACCOUNT = Regex("(?:[x*•]{2,}\\s?)\\d{3,4}\\b", IC)
    private val TXN_REF = Regex(
        "\\b(?:txn|transaction|utr|rrn|ref(?:erence)?|order)\\s*(?:id|no\\.?|number|#)?\\s*[:#.]?\\s*(?=[a-z\\-]*\\d)([a-z0-9][a-z0-9\\-]{5,})",
        IC,
    )
    private val TXN_REF_LABEL_ONLY = Regex("^(?:upi\\s+)?(?:txn|transaction|utr|rrn|ref(?:erence)?|order)\\s*(?:id|no\\.?|number)?\\s*:?$", IC)
    private val ID_VALUE = Regex("^(?=[a-z\\-]*\\d)[a-z0-9][a-z0-9\\-]{5,}$", IC)
    private val BANK = Regex("([A-Z][A-Za-z&.]*(?: +[A-Z][A-Za-z&.]*)* +Bank(?: +of +[A-Z][a-z]+)?)")
    private val VIA = Regex("\\bvia\\s+([A-Za-z][\\w.]*)", IC)

    private val D_MON_Y = Regex("\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/,]*$MONTH[\\s\\-/,']*(\\d{4}|\\d{2})\\b", IC)
    private val MON_D_Y = Regex("\\b$MONTH\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*'?(\\d{4})\\b", IC)
    private val NUMERIC_DATE = Regex("\\b(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{4}|\\d{2})\\b")
    private val ISO_DATE = Regex("\\b(\\d{4})-(\\d{2})-(\\d{2})\\b")
    private val D_MON = Regex("\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-]*$MONTH(?![a-z])", IC)
    private val MON_D = Regex("\\b$MONTH\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*[:.]\\d)", IC)
    private val TODAY = Regex("\\btoday\\b", IC)
    private val YESTERDAY = Regex("\\byesterday\\b", IC)
    private val TIME_12H = Regex("\\b(\\d{1,2})[:.](\\d{2})(?::\\d{2})?\\s*([ap])\\.?\\s*m\\b\\.?", IC)
    private val TIME_24H = Regex("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?::[0-5]\\d)?\\b")

    /** Text that contains digits but is never an amount. */
    private val NOT_MONEY = listOf(
        TIME_12H, TIME_24H, D_MON_Y, MON_D_Y, NUMERIC_DATE, ISO_DATE, HANDLE, MASKED_ACCOUNT,
        Regex("\\d+(\\.\\d+)?\\s*%"), Regex("\\b\\d{8,}\\b"), Regex("\\d+(\\.\\d+)?\\s*(s|sec|secs|seconds|ms|min|mins|x)\\b", IC),
    )

    // ---- entry points -------------------------------------------------------------------------

    fun parse(rawLines: List<OcrLine>, imageHeight: Int, today: ParsedDate = today()): ParsedReceipt {
        val lines = normalise(rawLines)
        val allText = lines.joinToString("\n") { it.text }
        val direction = if (lines.any { CREDIT_HINT.containsMatchIn(it.text) }) Direction.CREDIT else Direction.DEBIT
        val amount = findAmount(lines)
        val counterparty = findCounterparty(lines, direction, amount, imageHeight)
        val date = findDate(lines, imageHeight, today)
        val txnRef = findTxnRef(lines)
        val handle = HANDLE.find(allText)?.value ?: MASKED_ACCOUNT.find(allText)?.value

        return ParsedReceipt(
            amount = amount?.value,
            direction = direction,
            counterparty = counterparty,
            handle = handle,
            date = date,
            txnRef = txnRef,
            bank = BANK.find(allText)?.groupValues?.get(1)?.trim(),
            provider = VIA.find(allText)?.groupValues?.get(1)?.takeUnless { it.equals("upi", ignoreCase = true) },
            looksLikePayment = amount != null || txnRef != null || handle != null ||
                (date != null && lines.count { PAYMENT_HINT.containsMatchIn(it.text) } > 0),
        )
    }

    /** True for text that could be a payment amount; used to merge extra OCR passes. */
    fun isAmountLike(text: String): Boolean {
        val t = text.trim()
        return BARE_AMOUNT.matches(t) || MARKED_AMOUNT.containsMatchIn(stripNonMoney(t))
    }

    private val SPLIT_AT = Regex("(?<=[a-z0-9._\\-])\\s*@\\s*(?=[a-z])", IC)
    private val SPLIT_BEFORE_HANDLE = Regex("([a-z0-9._\\-]*\\d[a-z0-9._\\-]*) ([a-z0-9._\\-]{1,3}@[a-z]{2,})", IC)

    /** OCR breaks UPI handles apart: "987654321 0@ybl", "rohit @ okaxis". */
    private fun repairHandles(text: String): String =
        text.replace(SPLIT_AT, "@").replace(SPLIT_BEFORE_HANDLE, "$1$2")

    private fun normalise(rawLines: List<OcrLine>): List<OcrLine> =
        rawLines
            .map { it.copy(text = repairHandles(it.text.replace(Regex("\\s+"), " ").trim())) }
            .filter { it.text.isNotEmpty() }
            .sortedWith(compareBy<OcrLine> { it.top }.thenBy { it.text })

    private fun today(): ParsedDate = Calendar.getInstance().let {
        ParsedDate(it.get(Calendar.YEAR), it.get(Calendar.MONTH) + 1, it.get(Calendar.DAY_OF_MONTH), null, null)
    }

    // ---- amount -------------------------------------------------------------------------------

    private data class AmountCandidate(val value: Double, val line: OcrLine, val score: Double) {
        val digits: String get() = line.text.filter { it.isDigit() }
    }

    /**
     * Two OCR passes read the same printed amount differently, one with an extra leading digit:
     * that digit is the "₹" sign misread (it looks like a 7, 2 or Z), so the shorter reading wins.
     */
    private fun isRupeeMisread(longer: AmountCandidate, shorter: AmountCandidate): Boolean {
        val sameRow = abs(longer.line.top - shorter.line.top) < maxOf(longer.line.height, shorter.line.height) * 0.8
        return sameRow &&
            longer.digits.length == shorter.digits.length + 1 &&
            longer.digits.endsWith(shorter.digits) &&
            longer.digits.first() in "72"
    }

    private fun toAmount(whole: String, fraction: String): Double? =
        "${whole.replace(",", "")}${if (fraction.isNotEmpty()) ".$fraction" else ""}"
            .toDoubleOrNull()?.takeIf { it > 0 && it < 100_000_000 }

    private fun stripNonMoney(text: String): String = NOT_MONEY.fold(text) { acc, regex -> regex.replace(acc, " ") }

    private fun findAmount(lines: List<OcrLine>): AmountCandidate? {
        if (lines.isEmpty()) return null
        val median = lines.map { it.height }.sorted()[lines.size / 2].coerceAtLeast(1).toDouble()
        val candidates = mutableListOf<AmountCandidate>()

        lines.forEachIndexed { i, line ->
            if (PROMO.containsMatchIn(line.text)) return@forEachIndexed
            val size = line.height / median
            val labelledAbove = lines.getOrNull(i - 1)?.let { AMOUNT_LABEL_ONLY.matches(it.text) } == true

            BARE_AMOUNT.matchEntire(line.text)?.let { m ->
                val value = toAmount(m.groupValues[2], m.groupValues[3]) ?: return@let
                val marked = m.groupValues[1].isNotEmpty()
                // A lone unmarked number only counts when it is printed larger than the text around it.
                if (!marked && !labelledAbove && size < 1.2) return@let
                candidates += AmountCandidate(value, line, 2 * size + (if (marked) 1.5 else 0.0) + (if (labelledAbove) 2.5 else 0.0))
                return@forEachIndexed
            }

            val text = stripNonMoney(line.text)
            MARKED_AMOUNT.find(text)?.let { m ->
                val value = toAmount(m.groupValues[1], m.groupValues[2]) ?: return@let
                val labelled = labelledAbove || AMOUNT_LABEL.containsMatchIn(line.text)
                candidates += AmountCandidate(value, line, 2 * size + 1.5 + (if (labelled) 2.5 else 0.0))
                return@forEachIndexed
            }
            // "Amount: 500.00" without any currency mark.
            if (AMOUNT_LABEL.containsMatchIn(line.text)) {
                Regex("(?:amount|amt|total)\\s*:?\\s*$MONEY", IC).find(text)?.let { m ->
                    val value = toAmount(m.groupValues[1], m.groupValues[2]) ?: return@let
                    candidates += AmountCandidate(value, line, 2 * size + 2.5)
                }
            }
        }
        return candidates
            .filterNot { a -> candidates.any { b -> b !== a && isRupeeMisread(a, b) } }
            .maxWithOrNull(compareBy<AmountCandidate> { it.score }.thenByDescending { it.line.top })
    }

    // ---- counterparty -------------------------------------------------------------------------

    private fun findCounterparty(lines: List<OcrLine>, direction: Direction, amount: AmountCandidate?, imageHeight: Int): String? {
        val credit = direction == Direction.CREDIT
        val inline = if (credit) INLINE_FROM else INLINE_TO
        val label = if (credit) CREDIT_LABEL else DEBIT_LABEL
        val amountTop = amount?.line?.top
        fun distance(line: OcrLine) = if (amountTop == null) 0 else abs(line.top - amountTop)

        // 1. A label with the value beside it or on the next lines: "Paid to" / "Rohit Joshi".
        // 2. Inline phrasing: "to ADITYA RAJ", "Paid ₹500 to Swiggy".
        val explicit = mutableListOf<Pair<String, OcrLine>>()
        lines.forEachIndexed { i, line ->
            label.matchEntire(line.text)?.let { m ->
                val beside = m.groupValues[1]
                if (beside.isNotBlank()) {
                    cleanName(beside)?.let { explicit += it to line }
                } else {
                    (1..2).asSequence()
                        .mapNotNull { lines.getOrNull(i + it) }
                        .firstNotNullOfOrNull { next -> cleanName(next.text)?.let { it to next } }
                        ?.let { explicit += it }
                }
                return@forEachIndexed
            }
            inline.find(line.text)?.let { m -> cleanName(m.groupValues[1])?.let { explicit += it to line } }
        }
        explicit.minByOrNull { distance(it.second) }?.let { return displayName(it.first) }

        // 3. No wording to go on: the name printed nearest the amount, preferring above it.
        if (amountTop != null) {
            return lines
                .filter { it !== amount.line && isNameLike(it.text, strict = true) }
                .map { line ->
                    val gap = line.top - amountTop
                    line to (if (gap < 0) -gap.toDouble() else gap * 1.5)
                }
                .filter { (_, gap) -> gap < imageHeight * 0.3 }
                .minByOrNull { it.second }
                ?.first?.text?.let(::displayName)
        }
        return null
    }

    /** "Rohit Joshi • 98377@ptyes" → "Rohit Joshi"; "VPA swiggy@icici on 12-07" → "swiggy@icici". */
    private fun cleanName(raw: String): String? {
        val name = raw
            .split(" • ", " · ", " | ", "•", " - ")
            .first()
            .replace(NAME_TAIL, "")
            .replace(NAME_PREFIX, "")
            .trim()
            .trim('.', ',', ':', '-', ' ')
        if (HANDLE.matches(name)) return name
        return name.takeIf { isNameLike(it, strict = false) }
    }

    private fun isNameLike(text: String, strict: Boolean): Boolean {
        if (text.length !in 2..48) return false
        val letters = text.count { it.isLetter() }
        if (letters < 2) return false
        if (Regex("\\d[.,]\\d").containsMatchIn(text)) return false
        val digits = text.count { it.isDigit() }
        if (strict) {
            if (digits > 0 || text.split(' ').size > 5) return false
            if (letters.toDouble() / text.count { !it.isWhitespace() } < 0.85) return false
        } else if (digits > 3) {
            return false
        }
        return !NOT_A_NAME.containsMatchIn(text)
    }

    /** OCR of all-caps or all-lowercase names reads better in title case. */
    private fun displayName(text: String): String {
        if (text.contains('@')) return text
        val letters = text.filter { it.isLetter() }
        if (letters != letters.uppercase() && letters != letters.lowercase()) return text
        return text.lowercase().split(' ').joinToString(" ") { word -> word.replaceFirstChar { it.titlecase() } }
    }

    // ---- reference ----------------------------------------------------------------------------

    private fun findTxnRef(lines: List<OcrLine>): String? {
        lines.forEachIndexed { i, line ->
            if (TXN_REF_LABEL_ONLY.matches(line.text)) {
                lines.getOrNull(i + 1)?.text?.replace(" ", "")?.takeIf { ID_VALUE.matches(it) }?.let { return it }
            }
        }
        return lines.firstNotNullOfOrNull { line ->
            TXN_REF.find(line.text)?.groupValues?.get(1)
        }
    }

    // ---- date & time --------------------------------------------------------------------------

    private fun findDate(lines: List<OcrLine>, imageHeight: Int, today: ParsedDate): ParsedDate? {
        // Most specific first: a full date anywhere beats a yearless or relative one.
        val matchers: List<(String) -> ParsedDate?> = listOf(
            ::matchFullDate,
            { text -> matchYearlessDate(text, today) },
            { text -> matchRelativeDate(text, today) },
        )
        for (match in matchers) {
            lines.forEachIndexed { i, line ->
                val date = match(line.text) ?: return@forEachIndexed
                val time = matchTime12(line.text)
                    ?: lines.getOrNull(i + 1)?.let { matchTime12(it.text) }
                    ?: lines.getOrNull(i - 1)?.let { matchTime12(it.text) }
                    ?: matchTime24(line.text)
                    ?: lines.getOrNull(i + 1)?.let { matchTime24(it.text) }
                    ?: lines.firstNotNullOfOrNull { other ->
                        // Skip the phone's status-bar clock at the very top of the screenshot.
                        if (other.top < imageHeight * 0.06) null else matchTime12(other.text)
                    }
                return date.copy(hour = time?.first, minute = time?.second)
            }
        }
        return null
    }

    private fun monthIndex(name: String): Int = MONTHS.indexOf(name.lowercase().take(3)) + 1

    private fun fullYear(raw: String): Int = raw.toInt().let { if (raw.length == 2) 2000 + it else it }

    private fun validDate(year: Int, month: Int, day: Int): ParsedDate? =
        if (year in 2000..2100 && month in 1..12 && day in 1..31) ParsedDate(year, month, day, null, null) else null

    private fun matchFullDate(text: String): ParsedDate? {
        D_MON_Y.find(text)?.let { m ->
            val (day, month, year) = m.destructured
            validDate(fullYear(year), monthIndex(month), day.toInt())?.let { return it }
        }
        MON_D_Y.find(text)?.let { m ->
            val (month, day, year) = m.destructured
            validDate(year.toInt(), monthIndex(month), day.toInt())?.let { return it }
        }
        ISO_DATE.find(text)?.let { m ->
            val (year, month, day) = m.destructured
            validDate(year.toInt(), month.toInt(), day.toInt())?.let { return it }
        }
        // Indian receipts write numeric dates day-first.
        NUMERIC_DATE.find(text)?.let { m ->
            val (day, month, year) = m.destructured
            validDate(fullYear(year), month.toInt(), day.toInt())?.let { return it }
        }
        return null
    }

    /** "14 Jul, 11:30 PM" — assume the most recent such date that isn't in the future. */
    private fun matchYearlessDate(text: String, today: ParsedDate): ParsedDate? {
        val (day, month) = D_MON.find(text)?.let { it.groupValues[1].toInt() to monthIndex(it.groupValues[2]) }
            ?: MON_D.find(text)?.let { it.groupValues[2].toInt() to monthIndex(it.groupValues[1]) }
            ?: return null
        val inFuture = month > today.month || (month == today.month && day > today.day)
        return validDate(if (inFuture) today.year - 1 else today.year, month, day)
    }

    private fun matchRelativeDate(text: String, today: ParsedDate): ParsedDate? {
        val daysAgo = when {
            TODAY.containsMatchIn(text) -> 0
            YESTERDAY.containsMatchIn(text) -> 1
            else -> return null
        }
        val cal = Calendar.getInstance().apply {
            clear()
            set(today.year, today.month - 1, today.day)
            add(Calendar.DAY_OF_MONTH, -daysAgo)
        }
        return ParsedDate(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH), null, null)
    }

    private fun matchTime12(text: String): Pair<Int, Int>? {
        val m = TIME_12H.find(text) ?: return null
        val hour = m.groupValues[1].toInt()
        val minute = m.groupValues[2].toInt()
        if (hour !in 1..12 || minute !in 0..59) return null
        val pm = m.groupValues[3].equals("p", ignoreCase = true)
        return (hour % 12 + if (pm) 12 else 0) to minute
    }

    private fun matchTime24(text: String): Pair<Int, Int>? =
        TIME_24H.find(text)?.let { it.groupValues[1].toInt() to it.groupValues[2].toInt() }
}
