package com.spendd.receipts

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.core.content.IntentCompat

/**
 * Invisible share target. Shows "Spendd" in the system share sheet for images, queues the
 * screenshot for background logging and closes immediately, so the user never leaves the app
 * they shared from.
 */
class ShareReceiverActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uris = sharedImages(intent)
        // getReferrer() is "android-app://<package>" for the app that started the share. The sender
        // can set it, so it is only used as a display label.
        val sourceApp = SourceApps.labelFor(this, referrer?.host)
        val app = applicationContext

        // Copying can take a moment for large images; keep it off the main thread. The activity
        // stays open until then, because read access to the shared URIs ends when it finishes.
        Thread {
            val queued = if (uris.isEmpty()) 0 else ReceiptIntake.submit(app, uris, sourceApp)
            runOnUiThread {
                when {
                    queued == 0 -> Toast.makeText(app, "Spendd couldn’t open that image", Toast.LENGTH_SHORT).show()
                    // With notifications off, still acknowledge the share.
                    !ReceiptNotifications.canPost(app) ->
                        Toast.makeText(app, "Logging transaction in Spendd…", Toast.LENGTH_SHORT).show()
                }
                finish()
            }
        }.start()
    }

    /** content:// images only, at most [IntakeRules.MAX_IMAGES]; anything else is refused. */
    private fun sharedImages(intent: Intent): List<Uri> {
        if (intent.type?.lowercase()?.startsWith("image/") != true) return emptyList()
        val fromExtras = when (intent.action) {
            Intent.ACTION_SEND ->
                listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        val candidates = fromExtras.ifEmpty {
            val clip = intent.clipData ?: return emptyList()
            (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
        }
        return candidates
            .filter { uri -> IntakeRules.acceptsUri(uri.scheme, runCatching { contentResolver.getType(uri) }.getOrNull()) }
            .take(IntakeRules.MAX_IMAGES)
    }
}
