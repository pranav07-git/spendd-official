package com.spendd.receipts

import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Writes what ML Kit reads from every image in androidTest/assets/receipts — each pass's raw lines,
 * the combined lines, and the parse — to <external files>/ocr-dump/<name>.txt. Pull with
 * `adb pull /sdcard/Android/data/com.spendd/files/ocr-dump`.
 */
@RunWith(AndroidJUnit4::class)
class ReceiptOcrDumpTest {

    @Test
    fun dumpOcrForFixtures() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val assets = instrumentation.context.assets
        val out = File(instrumentation.targetContext.getExternalFilesDir(null), "ocr-dump").apply { deleteRecursively(); mkdirs() }

        for (name in assets.list("receipts").orEmpty()) {
            val bitmap = assets.open("receipts/$name").use { BitmapFactory.decodeStream(it) } ?: continue
            val report = StringBuilder("# $name (${bitmap.width}x${bitmap.height})\n")
            runBlocking {
                ReceiptOcr.readPasses(bitmap).forEach { (pass, lines) ->
                    report.append("\n## $pass\n")
                    lines.sortedBy { it.top }.forEach { report.append("${it.top}:h${it.height} c${"%.2f".format(it.confidence)}  ${it.text}\n") }
                }
                val (lines, height) = ReceiptOcr.recognize(bitmap)
                report.append("\n## combined\n")
                lines.forEach { report.append("${it.top}:h${it.height}  ${it.text}\n") }
                report.append("\n## parsed\n${ReceiptParser.parse(lines, height)}\n")
            }
            File(out, "${name.substringBeforeLast('.')}.txt").writeText(report.toString())
        }
    }
}
