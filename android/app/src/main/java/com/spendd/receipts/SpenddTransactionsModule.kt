package com.spendd.receipts

import android.net.Uri
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.spendd.ai.SpenddModelsModule
import com.spendd.specs.NativeSpenddModelsSpec
import com.spendd.specs.NativeSpenddTransactionsSpec
import org.json.JSONObject
import java.io.File
import java.io.IOException
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
        try {
            promise.resolve(store.remove(id))
        } catch (e: Exception) {
            promise.reject("E_REMOVE", e)
        }
    }

    override fun update(id: String, patchJson: String, promise: Promise) {
        try {
            val updated = store.update(id, JSONObject(patchJson))
            promise.resolve(updated?.toString())
        } catch (e: Exception) {
            promise.reject("E_UPDATE", e)
        }
    }

    /** Pending jobs first, so none of them logs into the log after it is deleted. Every step runs. */
    override fun clear(promise: Promise) {
        val errors = listOfNotNull(
            runCatching { ReceiptIntake.clearPending(reactApplicationContext) }.exceptionOrNull(),
            runCatching { if (!store.clear()) throw IOException("Couldn’t delete the transaction log") }.exceptionOrNull(),
        )
        if (errors.isEmpty()) promise.resolve(null) else promise.reject("E_CLEAR", errors.first())
    }

    /** Deletes a file:// path, but only inside the app's own storage. */
    override fun deleteLocalFile(uri: String, promise: Promise) {
        try {
            val parsed = Uri.parse(uri)
            val path = (if (parsed.scheme == null) uri else parsed.takeIf { it.scheme == "file" }?.path)
                ?: throw IllegalArgumentException("Not a file URI")
            val file = File(path).canonicalFile
            val roots = listOfNotNull(
                reactApplicationContext.filesDir,
                reactApplicationContext.cacheDir,
                reactApplicationContext.getExternalFilesDir(null),
                reactApplicationContext.dataDir,
            ).map { it.canonicalFile }
            if (roots.none { file.path.startsWith(it.path + File.separator) }) {
                throw IllegalArgumentException("Outside app storage")
            }
            promise.resolve(file.exists() && file.delete())
        } catch (e: Exception) {
            promise.reject("E_DELETE", e)
        }
    }

    override fun importScreenshot(uri: String, promise: Promise) {
        val context = reactApplicationContext
        val parsed = Uri.parse(uri)
        val type = runCatching { context.contentResolver.getType(parsed) }.getOrNull()
        if (!IntakeRules.acceptsUri(parsed.scheme, type)) {
            promise.reject("E_IMPORT", "Couldn’t open that image")
            return
        }
        // Copying a large image shouldn't hold up other native calls.
        Thread {
            val queued = runCatching { ReceiptIntake.submit(context, listOf(parsed), null) }.getOrDefault(0)
            if (queued > 0) promise.resolve(null) else promise.reject("E_IMPORT", "Couldn’t open that image")
        }.start()
    }
}

class SpenddPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            NativeSpenddTransactionsSpec.NAME -> SpenddTransactionsModule(reactContext)
            NativeSpenddModelsSpec.NAME -> SpenddModelsModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        listOf(NativeSpenddTransactionsSpec.NAME, NativeSpenddModelsSpec.NAME).associateWith { name ->
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
