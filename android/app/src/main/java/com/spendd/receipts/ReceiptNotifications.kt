package com.spendd.receipts

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.spendd.MainActivity
import com.spendd.R

/**
 * One notification per shared screenshot: it pops up once as "Logging transaction…" and is then
 * updated in place (silently) with the result.
 */
object ReceiptNotifications {

    private const val CHANNEL_ID = "transactions"

    fun canPost(context: Context): Boolean {
        val permitted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return permitted && NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    fun logging(context: Context, id: Int) =
        post(context, id) {
            setContentTitle("Logging transaction…")
            setContentText("Reading your payment screenshot")
            setProgress(0, 0, true)
            setOngoing(true)
        }

    fun logged(context: Context, id: Int, title: String, detail: String) =
        post(context, id) {
            setContentTitle(title)
            setContentText(detail)
            setAutoCancel(true)
        }

    fun failed(context: Context, id: Int, reason: String) =
        post(context, id) {
            setContentTitle("Couldn’t log that transaction")
            setContentText(reason)
            setStyle(NotificationCompat.BigTextStyle().bigText(reason))
            setAutoCancel(true)
        }

    /** Shown by the expedited worker while it runs (required for foreground execution). */
    fun loggingNotification(context: Context): Notification {
        ensureChannel(context)
        return builder(context) {
            setContentTitle("Logging transaction…")
            setContentText("Reading your payment screenshot")
            setProgress(0, 0, true)
            setOngoing(true)
        }
    }

    private fun post(context: Context, id: Int, build: NotificationCompat.Builder.() -> Unit) {
        if (!canPost(context)) return
        ensureChannel(context)
        val notification = builder(context, build)
        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (_: SecurityException) {
            // Permission revoked between the check and the post; nothing to show.
        }
    }

    private fun builder(context: Context, build: NotificationCompat.Builder.() -> Unit): Notification {
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_spendd)
            .setColor(0xFF000000.toInt())
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            // On the lock screen, show only that Spendd logged something, never the amount or payee.
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(
                NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_spendd)
                    .setColor(0xFF000000.toInt())
                    .setContentTitle("Spendd")
                    .setContentText("Transaction update")
                    .build(),
            )
            .apply(build)
            .build()
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Transaction logging", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Shows when a shared payment screenshot is being logged"
                setShowBadge(false)
            },
        )
    }
}
