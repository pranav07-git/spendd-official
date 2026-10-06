package com.spendd.receipts

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.spendd.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * On-device OCR (ML Kit, bundled model) tuned for payment screens of any app.
 *
 * Coloured cards, gradients and white-on-colour text (PhonePe, FamPay, super.money…) are what OCR
 * reads worst, and the amount — the biggest, boldest text — is the line it most often drops. So
 * every screenshot is read four ways and the readings are combined line by line:
 *
 *  1. as it is;
 *  2. greyscale with the contrast stretched to the full range (colour no longer matters);
 *  3. that, inverted (light text on a dark or coloured card becomes dark on light);
 *  4. an "ink map": every pixel that differs clearly from its surroundings becomes black and the
 *     rest white, so text of any colour on any background ends up as black text on white.
 *
 * Where passes read the same spot, the reading ML Kit is most confident about wins. Differing
 * readings of an amount are all kept, so the parser can spot a "₹" misread as a digit. If there's
 * still no amount, a downscaled pass is the last resort (huge glyphs read better smaller).
 */
object ReceiptOcr {

    private class Pass(val name: String, val scale: Float, val render: (Bitmap) -> Bitmap)

    private val PASSES = listOf(
        Pass("original", 1f) { it },
        Pass("greyscale", 1f) { grey(it, invert = false) },
        Pass("inverted", 1f) { grey(it, invert = true) },
        Pass("ink", 1f) { inkMap(it) },
    )
    private val LAST_RESORT = Pass("half-size", 0.5f) { Bitmap.createScaledBitmap(it, it.width / 2, it.height / 2, true) }

    /**
     * One recognizer for the life of the process: ML Kit recommends reusing it, and creating and
     * closing clients back to back can leave a later request that never completes.
     */
    private val recognizer: TextRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private const val PASS_TIMEOUT_MS = 20_000L

    private const val MISREAD_RUPEE_CONFIDENCE = 0.35f
    private const val MIN_CONFIDENCE = 0.4f
    private const val MAX_HEIGHT = 2800
    /** 200 megapixels: far beyond any screenshot, and refused before decoding. */
    private const val MAX_PIXELS = 200_000_000L
    private const val TAG = "receipt-ocr"

    suspend fun recognize(file: File): Pair<List<OcrLine>, Int> {
        return recognize(fit(decodeSampled(file)))
    }

    suspend fun recognize(bitmap: Bitmap): Pair<List<OcrLine>, Int> {
        val passes = readPasses(bitmap, includeLastResort = false)
        var lines = combine(passes.values.toList())
        if (ReceiptParser.parse(lines, bitmap.height).amount == null) {
            lines = combine(passes.values.toList() + listOf(read(LAST_RESORT.render(bitmap), LAST_RESORT.scale)))
        }
        if (BuildConfig.DEBUG) {
            Log.i(TAG, "combined:\n" + lines.joinToString("\n") { "  ${it.top}:h${it.height} ${it.text}" })
        }
        return lines to bitmap.height
    }

    /** Every pass's raw ML Kit lines, by pass name. For diagnostics (see ReceiptOcrDumpTest). */
    suspend fun readPasses(bitmap: Bitmap, includeLastResort: Boolean = true): LinkedHashMap<String, List<OcrLine>> {
        val out = LinkedHashMap<String, List<OcrLine>>()
        for (pass in PASSES + if (includeLastResort) listOf(LAST_RESORT) else emptyList()) {
            val started = System.currentTimeMillis()
            if (BuildConfig.DEBUG) Log.i(TAG, "${pass.name}: rendering")
            val image = pass.render(bitmap)
            if (BuildConfig.DEBUG) Log.i(TAG, "${pass.name}: reading (${System.currentTimeMillis() - started} ms to render)")
            out[pass.name] = read(image, pass.scale)
            if (BuildConfig.DEBUG) {
                Log.i(TAG, "${pass.name}: ${out.getValue(pass.name).size} lines in ${System.currentTimeMillis() - started} ms")
            }
        }
        return out
    }

    // ---- combining passes ---------------------------------------------------------------------

    private fun digits(s: String) = s.filter { it.isDigit() }

    /** Two readings of the same printed line: they overlap vertically and horizontally. */
    private fun samePlace(a: OcrLine, b: OcrLine): Boolean {
        val vertical = min(a.top + a.height, b.top + b.height) - max(a.top, b.top)
        if (vertical < min(a.height, b.height) * 0.5) return false
        if (a.width == 0 || b.width == 0) return abs(a.top - b.top) < max(a.height, b.height) * 0.5
        val horizontal = min(a.left + a.width, b.left + b.width) - max(a.left, b.left)
        return horizontal > min(a.width, b.width) * 0.3
    }

    /**
     * One line per printed line, taking the most confident reading. An amount read differently by
     * two passes is kept both ways so ReceiptParser can tell a misread "₹" from a real digit.
     */
    fun combine(passes: List<List<OcrLine>>): List<OcrLine> {
        val kept = mutableListOf<OcrLine>()
        passes.flatten()
            // Below this ML Kit is usually reading an icon, a logo or noise ("Jo" for an avatar).
            .filter { it.text.isNotBlank() && it.confidence >= MIN_CONFIDENCE }
            .sortedByDescending { it.confidence }
            .forEach { line ->
                val clash = kept.firstOrNull { samePlace(it, line) }
                val keep = when {
                    clash == null -> true
                    // Different numbers in the same spot: keep both readings of the amount.
                    ReceiptParser.isAmountLike(line.text) && ReceiptParser.isAmountLike(clash.text) ->
                        digits(line.text) != digits(clash.text) && kept.none { samePlace(it, line) && digits(it.text) == digits(line.text) }
                    // A pass that found an amount where the best reading found none (e.g. the amount
                    // glyphs were dropped from a line) adds it.
                    ReceiptParser.isAmountLike(line.text) -> kept.none { samePlace(it, line) && ReceiptParser.isAmountLike(it.text) }
                    else -> false
                }
                if (keep) kept += line
            }
        return kept.sortedWith(compareBy<OcrLine> { it.top }.thenBy { it.left })
    }

    // ---- ML Kit -------------------------------------------------------------------------------

    /** One ML Kit read. A pass that doesn't answer in time counts as reading nothing. */
    private suspend fun read(bitmap: Bitmap, scale: Float): List<OcrLine> {
        val text: Text = withTimeoutOrNull(PASS_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
                    .addOnFailureListener { if (cont.isActive) cont.resumeWithException(it) }
            }
        } ?: run {
            Log.w(TAG, "OCR pass timed out")
            return emptyList()
        }
        return text.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
                line.boundingBox?.let { box ->
                    OcrLine(
                        text = line.elements.joinToString(" ", transform = ::withoutMisreadRupee),
                        top = (box.top / scale).toInt(),
                        height = (box.height() / scale).toInt(),
                        left = (box.left / scale).toInt(),
                        width = (box.width() / scale).toInt(),
                        confidence = line.confidence,
                    )
                }
            }
        }
    }

    /**
     * The model has no "₹", so it sometimes emits the sign as a leading "7" or "2" ("₹5,000" →
     * "75,000"), but with very low confidence for that one character (≈0.1–0.25, against ≈0.5+
     * for a real digit). Such a character is dropped.
     */
    private fun withoutMisreadRupee(element: Text.Element): String {
        val symbols = element.symbols
        val lead = if (symbols.firstOrNull()?.text in setOf("+", "-")) 1 else 0
        val suspect = symbols.getOrNull(lead) ?: return element.text
        val next = symbols.getOrNull(lead + 1) ?: return element.text
        val misread = suspect.text in setOf("7", "2") &&
            suspect.confidence < MISREAD_RUPEE_CONFIDENCE &&
            next.text.firstOrNull()?.isDigit() == true
        return if (misread) symbols.filterIndexed { i, _ -> i != lead }.joinToString("") { it.text } else element.text
    }

    // ---- image passes -------------------------------------------------------------------------

    /** Phone screenshots are ~2400px tall; anything far larger only slows OCR down. */
    /**
     * Decodes at most about twice [MAX_HEIGHT] tall: the header is read first, so an image that
     * declares huge dimensions (a decompression bomb) is downsampled or refused instead of
     * allocating gigabytes.
     */
    private fun decodeSampled(file: File): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        val (width, height) = bounds.outWidth to bounds.outHeight
        if (width <= 0 || height <= 0) throw IllegalArgumentException("Not an image")
        if (width.toLong() * height > MAX_PIXELS) throw IllegalArgumentException("Image too large")
        var sample = 1
        while (height / (sample * 2) >= MAX_HEIGHT) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeFile(file.absolutePath, options) ?: throw IllegalArgumentException("Not an image")
    }

    private fun fit(bitmap: Bitmap): Bitmap =
        if (bitmap.height > MAX_HEIGHT) {
            Bitmap.createScaledBitmap(bitmap, bitmap.width * MAX_HEIGHT / bitmap.height, MAX_HEIGHT, true)
        } else {
            bitmap
        }

    private fun luminance(bitmap: Bitmap): IntArray {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        for (i in pixels.indices) {
            val c = pixels[i]
            pixels[i] = (Color.red(c) * 299 + Color.green(c) * 587 + Color.blue(c) * 114) / 1000
        }
        return pixels
    }

    private fun toBitmap(values: IntArray, width: Int, height: Int): Bitmap {
        val pixels = IntArray(values.size) { i -> values[i].let { v -> Color.rgb(v, v, v) } }
        return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
    }

    /** Greyscale, stretched so the 2nd–98th percentile of brightness spans black to white. */
    private fun grey(bitmap: Bitmap, invert: Boolean): Bitmap {
        val lum = luminance(bitmap)
        val histogram = IntArray(256)
        lum.forEach { histogram[it]++ }
        fun percentile(p: Double): Int {
            val target = (lum.size * p).toLong()
            var seen = 0L
            for (v in 0..255) {
                seen += histogram[v]
                if (seen >= target) return v
            }
            return 255
        }
        val low = percentile(0.02)
        val high = max(percentile(0.98), low + 1)
        for (i in lum.indices) {
            val stretched = ((lum[i] - low) * 255 / (high - low)).coerceIn(0, 255)
            lum[i] = if (invert) 255 - stretched else stretched
        }
        return toBitmap(lum, bitmap.width, bitmap.height)
    }

    /**
     * Black wherever a pixel differs from the average of its neighbourhood by more than a little,
     * white elsewhere: text of any colour on any background becomes black on white. The window
     * scales with the image so large amount glyphs fill in rather than becoming outlines.
     */
    private fun inkMap(bitmap: Bitmap): Bitmap {
        val w = bitmap.width
        val h = bitmap.height
        val lum = luminance(bitmap)
        // Integral image (summed-area table) for O(1) window means.
        val integral = IntArray((w + 1) * (h + 1))
        for (y in 0 until h) {
            var rowSum = 0
            for (x in 0 until w) {
                rowSum += lum[y * w + x]
                integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum
            }
        }
        val r = max(15, h / 60)
        val threshold = 28
        val out = IntArray(w * h)
        for (y in 0 until h) {
            val y0 = max(0, y - r)
            val y1 = min(h, y + r + 1)
            for (x in 0 until w) {
                val x0 = max(0, x - r)
                val x1 = min(w, x + r + 1)
                val sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]
                val mean = sum / ((y1 - y0) * (x1 - x0))
                out[y * w + x] = if (abs(lum[y * w + x] - mean) > threshold) 0 else 255
            }
        }
        return toBitmap(out, w, h)
    }
}
