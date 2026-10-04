package com.spendd.receipts

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Runs the real on-device OCR over every image in androidTest/assets/receipts and writes what it
 * read (plus the parse) to <external files>/ocr-dump/<name>.json, so OCR output from real
 * screenshots can be turned into JVM parser fixtures.
 */
@RunWith(AndroidJUnit4::class)
class ReceiptOcrDumpTest {

    @Test
    fun dumpOcrForFixtures() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val assets = instrumentation.context.assets
        val target = instrumentation.targetContext
        val out = File(target.getExternalFilesDir(null), "ocr-dump").apply { deleteRecursively(); mkdirs() }

        for (name in assets.list("receipts").orEmpty()) {
            val image = File(target.cacheDir, name)
            assets.open("receipts/$name").use { input -> image.outputStream().use { input.copyTo(it) } }
            val (lines, height) = runBlocking { ReceiptOcr.recognize(image) }
            val parsed = ReceiptParser.parse(lines, height)
            val dump = JSONObject()
                .put("imageHeight", height)
                .put("lines", JSONArray(lines.map { JSONObject().put("text", it.text).put("top", it.top).put("height", it.height) }))
                .put("parsed", parsed.toString())
            File(out, "${name.substringBeforeLast('.')}.json").writeText(dump.toString(2))
            image.delete()
        }
    }
}
