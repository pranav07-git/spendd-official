package com.spendd.receipts

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Share-target path minus the activity: intake copies the image, WorkManager runs the worker,
 * and the parsed transaction lands in the store. Entries created here are removed afterwards.
 */
@RunWith(AndroidJUnit4::class)
class ReceiptIntakeDeviceTest {

    @Test
    fun sharedScreenshotsAreLoggedInTheBackground() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val assets = instrumentation.context.assets
        val context = instrumentation.targetContext
        val names = listOf("phonepe_card.jpg", "navi_ticket.jpg", "supermoney.jpg").filter { it in assets.list("receipts").orEmpty() }
        assumeTrue("no real screenshots bundled", names.isNotEmpty())

        val store = TransactionStore(context)
        val before = ids(store)
        val uris = names.map { name ->
            val file = File(context.cacheDir, name)
            assets.open("receipts/$name").use { input -> file.outputStream().use { input.copyTo(it) } }
            Uri.fromFile(file)
        }
        assertEquals(names.size, ReceiptIntake.submit(context, uris, "Intake test"))

        val deadline = System.currentTimeMillis() + 60_000
        var added: List<JSONObject>
        do {
            Thread.sleep(500)
            added = all(store).filter { it.getString("id") !in before }
        } while (added.size < names.size && System.currentTimeMillis() < deadline)

        try {
            assertEquals("transactions logged: $added", names.size, added.size)
            val amounts = added.map { it.optDouble("amount") }.sorted()
            assertEquals(listOf(1.0, 1.0, 1000.0), amounts)
            added.forEach { assertEquals("Intake test", it.getString("source")) }
            assertEquals(true, File(context.filesDir, "receipt-inbox").listFiles().orEmpty().isEmpty())
        } finally {
            added.forEach { store.remove(it.getString("id")) }
            uris.forEach { File(it.path!!).delete() }
        }
    }

    private fun all(store: TransactionStore): List<JSONObject> =
        store.readAll().let { array -> (0 until array.length()).map { array.getJSONObject(it) } }

    private fun ids(store: TransactionStore) = all(store).map { it.getString("id") }.toSet()
}
