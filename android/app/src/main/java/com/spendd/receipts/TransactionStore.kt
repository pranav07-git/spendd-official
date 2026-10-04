package com.spendd.receipts

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs

/**
 * App-private JSON log of transactions. Written by the background receipt worker and read by
 * the JS UI through [SpenddTransactionsModule], so every access goes through one process-wide lock.
 */
class TransactionStore(context: Context) {

    private val file = File(context.filesDir, "transactions.json")

    fun readAll(): JSONArray = synchronized(LOCK) { read() }

    fun add(transaction: JSONObject) = synchronized(LOCK) {
        val all = read()
        all.put(transaction)
        write(all)
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

    fun clear() = synchronized(LOCK) { file.delete() }

    /** Same UPI reference, or same amount + payee within a minute of a receipt-dated entry. */
    fun findDuplicate(txnRef: String?, amount: Double, counterparty: String?, occurredAt: Long, dateFromReceipt: Boolean): JSONObject? =
        synchronized(LOCK) {
            val all = read()
            for (i in 0 until all.length()) {
                val tx = all.getJSONObject(i)
                if (txnRef != null && !tx.isNull("txnRef") && tx.optString("txnRef") == txnRef) return@synchronized tx
                if (dateFromReceipt &&
                    tx.optBoolean("dateFromReceipt") &&
                    !tx.isNull("amount") && tx.optDouble("amount") == amount &&
                    tx.optString("counterparty").equals(counterparty ?: "", ignoreCase = true) &&
                    abs(tx.optLong("occurredAt") - occurredAt) < 60_000
                ) {
                    return@synchronized tx
                }
            }
            null
        }

    private fun read(): JSONArray =
        if (file.exists()) runCatching { JSONArray(file.readText()) }.getOrElse { JSONArray() } else JSONArray()

    private fun write(all: JSONArray) {
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(all.toString())
        if (!tmp.renameTo(file)) {
            file.writeText(all.toString())
            tmp.delete()
        }
    }

    companion object {
        private val LOCK = Any()
    }
}
