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
        // getReferrer() is "android-app://<package>" for the app that started the share.
        val sourceApp = SourceApps.labelFor(this, referrer?.host)
        // Copy off the main thread (a slow or huge stream mustn't freeze the share), but before
        // finishing: read access to the shared URIs ends with this activity.
        Thread {
            val queued = if (uris.isEmpty()) 0 else ReceiptIntake.submit(applicationContext, uris, sourceApp)
            runOnUiThread {
                when {
                    queued == 0 -> Toast.makeText(this, "Spendd couldn’t open that image", Toast.LENGTH_SHORT).show()
                    // With notifications off, still acknowledge the share.
                    !ReceiptNotifications.canPost(this) ->
                        Toast.makeText(this, "Logging transaction in Spendd…", Toast.LENGTH_SHORT).show()
                }
                finish()
            }
        }.start()
    }

    private fun sharedImages(intent: Intent): List<Uri> {
        val fromExtras = when (intent.action) {
            Intent.ACTION_SEND ->
                listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
            Intent.ACTION_SEND_MULTIPLE ->
                IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else -> emptyList()
        }
        if (fromExtras.isNotEmpty()) return fromExtras
        val clip = intent.clipData ?: return emptyList()
        return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
    }
}
