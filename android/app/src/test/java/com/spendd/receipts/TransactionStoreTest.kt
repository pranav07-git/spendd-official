package com.spendd.receipts

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

class TransactionStoreTest {

    @get:Rule
    val folder = TemporaryFolder()

    /** The same AES-GCM format as the app, with a software key instead of the Android Keystore. */
    private val key: SecretKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    private val codec = AesGcmLogCodec { key }

    private fun logFile() = File(folder.root, "transactions.json")
    private fun store(codec: LogCodec = this.codec) = TransactionStore(logFile(), codec)
    private fun quarantined() = folder.root.listFiles().orEmpty().filter { it.name.startsWith("transactions.unreadable-") }

    private fun tx(id: String, amount: Double? = 500.0, counterparty: String? = "Swiggy", txnRef: String? = null, occurredAt: Long = 1_000_000L, dateFromReceipt: Boolean = true) =
        JSONObject().apply {
            put("id", id)
            put("amount", amount ?: JSONObject.NULL)
            put("counterparty", counterparty ?: JSONObject.NULL)
            put("txnRef", txnRef ?: JSONObject.NULL)
            put("occurredAt", occurredAt)
            put("dateFromReceipt", dateFromReceipt)
        }

    private fun ids(s: TransactionStore) = s.readAll().let { a -> (0 until a.length()).map { a.getJSONObject(it).getString("id") } }

    @Test
    fun storesTransactionsEncrypted() {
        store().add(tx("a", counterparty = "Rohit Joshi"))
        val bytes = logFile().readBytes()
        assertTrue(codec.isEncrypted(bytes))
        assertFalse(String(bytes, Charsets.ISO_8859_1).contains("Rohit"))
        assertEquals(listOf("a"), ids(store()))
    }

    @Test
    fun migratesAPlaintextLogOnFirstRead() {
        logFile().writeText(JSONArray().put(tx("old")).toString())
        assertEquals(listOf("old"), ids(store()))
        assertTrue(codec.isEncrypted(logFile().readBytes()))
        assertEquals(listOf("old"), ids(store()))
    }

    @Test
    fun movesAnUnreadableLogAsideInsteadOfOverwritingIt() {
        store().add(tx("a"))
        val original = logFile().readBytes()
        val otherKey = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()

        val s = store(AesGcmLogCodec { otherKey })
        assertEquals(0, s.readAll().length())
        assertEquals(1, quarantined().size)
        assertArrayEquals(original, quarantined().single().readBytes())

        s.add(tx("b"))
        assertArrayEquals(original, quarantined().single().readBytes())
    }

    @Test
    fun keepsOnlyTheNewestThreeUnreadableCopies() {
        repeat(5) { i ->
            logFile().writeText("not json $i")
            store().readAll()
            Thread.sleep(2) // distinct timestamps in the names
        }
        val kept = quarantined().map { it.readText() }.sorted()
        assertEquals(listOf("not json 2", "not json 3", "not json 4"), kept)
    }

    @Test
    fun aTemporaryKeystoreErrorLeavesTheFileUntouched() {
        store().add(tx("a"))
        val original = logFile().readBytes()
        val failing = object : LogCodec by codec {
            override fun decrypt(encrypted: ByteArray): ByteArray = throw java.security.ProviderException("Keystore busy")
        }
        try {
            store(failing).add(tx("b"))
            fail("expected the Keystore error to propagate")
        } catch (_: java.security.ProviderException) {
        }
        assertArrayEquals(original, logFile().readBytes())
        assertTrue(quarantined().isEmpty())
        assertEquals(listOf("a"), ids(store()))
    }

    @Test
    fun truncatedCiphertextIsTreatedAsCorrupt() {
        store().add(tx("a"))
        logFile().writeBytes(logFile().readBytes().copyOf(10))
        assertEquals(0, store().readAll().length())
        assertEquals(1, quarantined().size)
    }

    @Test
    fun addsOnlyTheFirstOfConcurrentDuplicates() {
        val s = store()
        val pool = Executors.newFixedThreadPool(8)
        val start = CountDownLatch(1)
        val results = (1..40).map { i ->
            pool.submit<JSONObject?> {
                start.await()
                s.addUnlessDuplicate(tx("t$i", txnRef = "UTR123456"))
            }
        }
        start.countDown()
        val added = results.count { it.get(10, TimeUnit.SECONDS) == null }
        pool.shutdown()
        assertEquals(1, added)
        assertEquals(1, s.readAll().length())
    }

    @Test
    fun matchesDuplicatesWithNoPayee() {
        val s = store()
        assertNull(s.addUnlessDuplicate(tx("a", counterparty = null)))
        assertNotNull(s.addUnlessDuplicate(tx("b", counterparty = null, occurredAt = 1_030_000L)))
        // A named payee is not the same as no payee.
        assertNull(s.addUnlessDuplicate(tx("c", counterparty = "Zomato", occurredAt = 1_030_000L)))
        assertEquals(listOf("a", "c"), ids(s))
    }

    @Test
    fun duplicateRulesMatchTheOriginalOnes() {
        val s = store()
        s.add(tx("a", counterparty = "Swiggy"))
        assertNotNull(s.findDuplicate(null, 500.0, "swiggy", 1_059_000L, true))
        assertNull(s.findDuplicate(null, 500.0, "Swiggy", 1_061_000L, true))
        assertNull(s.findDuplicate(null, 500.0, "Swiggy", 1_000_000L, false))
        assertNull(s.findDuplicate(null, 501.0, "Swiggy", 1_000_000L, true))
        s.add(tx("b", txnRef = "REF999", dateFromReceipt = false))
        assertNotNull(s.findDuplicate("REF999", null, null, 0L, false))
    }

    @Test
    fun clearDeletesTheLogAndQuarantinedCopies() {
        logFile().writeText("garbage")
        store().readAll()
        store().add(tx("a"))
        assertTrue(store().clear())
        assertFalse(logFile().exists())
        assertTrue(quarantined().isEmpty())
        assertEquals(0, store().readAll().length())
    }

    @Test
    fun stringOrNullTreatsJsonNullAsNull() {
        val o = JSONObject("""{"a":null,"b":"x"}""")
        assertNull(o.stringOrNull("a"))
        assertNull(o.stringOrNull("missing"))
        assertEquals("x", o.stringOrNull("b"))
    }
}
