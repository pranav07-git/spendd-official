package com.spendd.receipts

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs

/** The file isn't a readable image; retrying won't help. */
class NotAnImageException(message: String) : IllegalArgumentException(message)

/**
 * On-device OCR (ML Kit, bundled model) tuned for payment screens.
 *
 * The amount is usually the largest, boldest text on the screen, which is exactly what OCR is
 * worst at: it skips it, or reads "₹" as a digit ("₹5,000" → "75,000"). So every image is also
 * read inverted, and if there is still no amount, contrast-boosted and then downscaled (big glyphs
 * read better smaller). Amount-like lines from those passes are merged in, and the parser uses
 * the disagreements between passes to spot a misread "₹".
 */
object ReceiptOcr {

    private class Variant(val scale: Float, val render: (Bitmap) -> Bitmap)

    private val FALLBACKS = listOf(
        Variant(1f) { filtered(it, grayscale().apply { postConcat(invert()) }) },
        Variant(1f) { filtered(it, grayscale().apply { postConcat(contrast(1.8f)) }) },
        Variant(0.5f) { Bitmap.createScaledBitmap(it, it.width / 2, it.height / 2, true) },
    )

    /** Images are decoded at most this many pixels (a long scrolling screenshot fits). */
    private const val MAX_PIXELS = 16_000_000L

    suspend fun recognize(file: File): Pair<List<OcrLine>, Int> {
        val bitmap = decodeBounded(file)
        try {
            return recognize(bitmap)
        } finally {
            bitmap.recycle()
        }
    }

    suspend fun recognize(bitmap: Bitmap): Pair<List<OcrLine>, Int> {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try {
            var lines = read(recognizer, bitmap, 1f)
            for ((i, variant) in FALLBACKS.withIndex()) {
                // The inverted pass always runs: it is the cross-check for a misread "₹".
                if (i > 0 && ReceiptParser.parse(lines, bitmap.height).amount != null) continue
                val rendered = variant.render(bitmap)
                try {
                    lines = merge(lines, read(recognizer, rendered, variant.scale))
                } finally {
                    // Each pass makes a full-size copy; free it before the next one.
                    if (rendered !== bitmap) rendered.recycle()
                }
            }
            return lines to bitmap.height
        } finally {
            recognizer.close()
        }
    }

    /** Decodes [file], downsampled by powers of two until it is at most [MAX_PIXELS]. */
    private fun decodeBounded(file: File): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw NotAnImageException("Not an image")
        var sample = 1
        while (bounds.outWidth.toLong() * bounds.outHeight / (sample.toLong() * sample) > MAX_PIXELS) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeFile(file.absolutePath, options) ?: throw NotAnImageException("Not an image")
    }

    /** Adds amount-like lines from [extra] that the base pass did not already read. */
    private fun merge(base: List<OcrLine>, extra: List<OcrLine>): List<OcrLine> {
        val digits = { s: String -> s.filter { it.isDigit() } }
        val added = extra.filter { line ->
            ReceiptParser.isAmountLike(line.text) &&
                base.none { abs(it.top - line.top) < maxOf(it.height, line.height) && digits(it.text) == digits(line.text) }
        }
        return base + added
    }

    private suspend fun read(recognizer: TextRecognizer, bitmap: Bitmap, scale: Float): List<OcrLine> {
        val text: Text = suspendCancellableCoroutine { cont ->
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { cont.resume(it) }
                .addOnFailureListener { cont.resumeWithException(it) }
        }
        return text.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
                line.boundingBox?.let { box ->
                    OcrLine(line.elements.joinToString(" ", transform = ::withoutMisreadRupee), (box.top / scale).toInt(), (box.height() / scale).toInt())
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

    private const val MISREAD_RUPEE_CONFIDENCE = 0.35f

    private fun filtered(src: Bitmap, matrix: ColorMatrix): Bitmap {
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        Canvas(out).drawBitmap(src, 0f, 0f, Paint().apply { colorFilter = ColorMatrixColorFilter(matrix) })
        return out
    }

    private fun grayscale() = ColorMatrix().apply { setSaturation(0f) }

    private fun invert() = ColorMatrix(
        floatArrayOf(-1f, 0f, 0f, 0f, 255f, 0f, -1f, 0f, 0f, 255f, 0f, 0f, -1f, 0f, 255f, 0f, 0f, 0f, 1f, 0f),
    )

    private fun contrast(k: Float): ColorMatrix {
        val t = 128f * (1 - k)
        return ColorMatrix(floatArrayOf(k, 0f, 0f, 0f, t, 0f, k, 0f, 0f, t, 0f, 0f, k, 0f, t, 0f, 0f, 0f, 1f, 0f))
    }
}
