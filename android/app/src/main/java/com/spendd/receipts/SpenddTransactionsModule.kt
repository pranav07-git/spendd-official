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
        if (name == NativeSpenddTransactionsSpec.NAME) SpenddTransactionsModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            NativeSpenddTransactionsSpec.NAME to ReactModuleInfo(
                name = NativeSpenddTransactionsSpec.NAME,
                className = NativeSpenddTransactionsSpec.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            ),
        )
    }
}
