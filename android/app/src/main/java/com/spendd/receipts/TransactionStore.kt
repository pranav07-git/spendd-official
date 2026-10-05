package com.spendd.receipts

import android.content.Context
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.io.IOException
import kotlin.math.abs

/**
 * App-private, encrypted JSON log of transactions. Written by the background receipt worker and
 * read by the JS UI through [SpenddTransactionsModule], so every access goes through one
 * process-wide lock.
 *
 * A log that can never be read again is moved aside (the newest [KEEP_QUARANTINED] are kept)
 * instead of being overwritten. Temporary failures (e.g. the Keystore being busy) throw and leave
 * the file untouched. A plaintext log from an older version is encrypted on first read.
 */
class TransactionStore(private val file: File, private val codec: LogCodec) {

    constructor(context: Context) : this(File(context.filesDir, FILE_NAME), KeystoreLogCodec)

    fun readAll(): JSONArray = synchronized(LOCK) { read() }

    fun add(transaction: JSONObject) = synchronized(LOCK) {
        val all = read()
        all.put(transaction)
        write(all)
    }

    /**
     * Adds [transaction] unless it duplicates a logged one, in one step so two workers logging the
     * same payment can't both add it. Returns the existing duplicate, or null once added.
     */
    fun addUnlessDuplicate(transaction: JSONObject): JSONObject? = synchronized(LOCK) {
        val all = read()
        findDuplicateIn(
            all,
            transaction.stringOrNull("txnRef"),
            if (transaction.isNull("amount")) null else transaction.optDouble("amount"),
            transaction.stringOrNull("counterparty"),
            transaction.optLong("occurredAt"),
            transaction.optBoolean("dateFromReceipt"),
        )?.let { return@synchronized it }
        all.put(transaction)
        write(all)
        null
    }

    fun remove(id: String): Boolean = synchronized(LOCK) {
        val all = read()
        val kept = JSONArray()
        var removed = false
        for (i in 0 until all.length()) {
            val tx = all.getJSONObject(i)
            if (tx.optString("id") == id) removed = true else kept.put(tx)
        }
        if (removed) write(kept)
        removed
    }

    /** Merges [patch] into the transaction with [id]; returns the updated transaction. */
    fun update(id: String, patch: JSONObject): JSONObject? = synchronized(LOCK) {
        val all = read()
        for (i in 0 until all.length()) {
            val tx = all.getJSONObject(i)
            if (tx.optString("id") == id) {
                patch.keys().forEach { key -> tx.put(key, patch.get(key)) }
                write(all)
                return@synchronized tx
            }
        }
        null
    }

    /** Deletes the log, any half-written copy and every quarantined copy. */
    fun clear(): Boolean = synchronized(LOCK) {
        listOf(file, tmpFile()).plus(quarantined()).map { !it.exists() || it.delete() }.all { it }
    }

    /** Same UPI reference, or same amount + payee within a minute of a receipt-dated entry. */
    fun findDuplicate(txnRef: String?, amount: Double?, counterparty: String?, occurredAt: Long, dateFromReceipt: Boolean): JSONObject? =
        synchronized(LOCK) { findDuplicateIn(read(), txnRef, amount, counterparty, occurredAt, dateFromReceipt) }

    private fun findDuplicateIn(
        all: JSONArray,
        txnRef: String?,
        amount: Double?,
        counterparty: String?,
        occurredAt: Long,
        dateFromReceipt: Boolean,
    ): JSONObject? {
        for (i in 0 until all.length()) {
            val tx = all.getJSONObject(i)
            if (txnRef != null && tx.stringOrNull("txnRef") == txnRef) return tx
            if (amount != null &&
                dateFromReceipt &&
                tx.optBoolean("dateFromReceipt") &&
                !tx.isNull("amount") && tx.optDouble("amount") == amount &&
                samePayee(tx.stringOrNull("counterparty"), counterparty) &&
                abs(tx.optLong("occurredAt") - occurredAt) < 60_000
            ) {
                return tx
            }
        }
        return null
    }

    private fun samePayee(a: String?, b: String?): Boolean =
        if (a == null || b == null) a == b else a.equals(b, ignoreCase = true)

    private fun read(): JSONArray {
        if (!file.exists()) return JSONArray()
        val bytes = file.readBytes()
        if (bytes.isEmpty()) return JSONArray()
        val legacy = !codec.isEncrypted(bytes)
        val text = try {
            if (legacy) bytes.toString(Charsets.UTF_8) else codec.decrypt(bytes).toString(Charsets.UTF_8)
        } catch (e: CorruptLogException) {
            quarantine()
            return JSONArray()
        }
        val all = try {
            JSONArray(text)
        } catch (e: JSONException) {
            quarantine()
            return JSONArray()
        }
        if (legacy) write(all) // migrate a plaintext log from an older version
        return all
    }

    private fun write(all: JSONArray) {
        val bytes = codec.encrypt(all.toString().toByteArray(Charsets.UTF_8))
        val tmp = tmpFile()
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(file)) {
            file.writeBytes(bytes)
            tmp.delete()
        }
    }

    /** Moves the unreadable log aside so nothing overwrites it; keeps the newest few. */
    private fun quarantine() {
        val aside = File(file.parentFile, "$QUARANTINE_PREFIX${System.currentTimeMillis()}.bin")
        if (!file.renameTo(aside)) {
            // Never fall through to a write that would replace the only copy.
            throw IOException("Couldn’t move the unreadable transaction log aside")
        }
        quarantined().sortedByDescending { it.name }.drop(KEEP_QUARANTINED).forEach { it.delete() }
    }

    private fun quarantined(): List<File> =
        file.parentFile?.listFiles { f -> f.name.startsWith(QUARANTINE_PREFIX) }?.toList().orEmpty()

    private fun tmpFile() = File(file.parentFile, "${file.name}.tmp")

    companion object {
        private const val FILE_NAME = "transactions.json"
        private const val QUARANTINE_PREFIX = "transactions.unreadable-"
        const val KEEP_QUARANTINED = 3
        private val LOCK = Any()
    }
}

/**
 * The string at [key], or null when it is missing or JSON null. Android's org.json turns a JSON
 * null into the text "null" in optString(), so null-ness is checked explicitly.
 */
internal fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else optString(key)
