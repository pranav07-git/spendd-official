package com.spendd.receipts

import android.net.Uri
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.spendd.specs.NativeSpenddTransactionsSpec
import org.json.JSONObject
import java.util.UUID

/** JS access to the transaction log. Spec: src/native/NativeSpenddTransactions.ts */
class SpenddTransactionsModule(reactContext: ReactApplicationContext) :
    NativeSpenddTransactionsSpec(reactContext) {

    private val store = TransactionStore(reactContext)

    override fun list(promise: Promise) {
        try {
            promise.resolve(store.readAll().toString())
        } catch (e: Exception) {
            promise.reject("E_READ", e)
        }
    }

    override fun add(transactionJson: String, promise: Promise) {
        try {
            val tx = JSONObject(transactionJson).apply {
                put("id", UUID.randomUUID().toString())
                put("createdAt", System.currentTimeMillis())
            }
            store.add(tx)
            promise.resolve(tx.toString())
        } catch (e: Exception) {
            promise.reject("E_ADD", e)
        }
    }

    override fun remove(id: String, promise: Promise) {
        promise.resolve(store.remove(id))
    }

    override fun update(id: String, patchJson: String, promise: Promise) {
        try {
            val updated = store.update(id, JSONObject(patchJson))
            promise.resolve(updated?.toString())
        } catch (e: Exception) {
            promise.reject("E_UPDATE", e)
        }
    }

    override fun clear(promise: Promise) {
        store.clear()
        promise.resolve(null)
    }

    override fun importScreenshot(uri: String, promise: Promise) {
        val queued = ReceiptIntake.submit(reactApplicationContext, listOf(Uri.parse(uri)), null)
        if (queued > 0) promise.resolve(null) else promise.reject("E_IMPORT", "Couldn’t open that image")
    }
}

class SpenddPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NativeSpenddTransactionsSpec.NAME -> SpenddTransactionsModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        listOf(NativeSpenddTransactionsSpec.NAME).associateWith { name ->
            ReactModuleInfo(
                name = name,
                className = name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            )
        }
    }
}
