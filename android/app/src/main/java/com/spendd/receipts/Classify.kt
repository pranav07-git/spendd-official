package com.spendd.receipts

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build

/** Names the app a screenshot was shared from, using the label Android itself shows. */
object SourceApps {
    fun labelFor(context: Context, packageName: String?): String? {
        if (packageName == null || packageName == context.packageName) return null
        val pm = context.packageManager
        val info = try {
            pm.getApplicationInfo(packageName, 0)
        } catch (_: PackageManager.NameNotFoundException) {
            return null
        }
        // Re-sharing from a gallery or the screenshot UI says nothing about how the payment was made.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && info.category == ApplicationInfo.CATEGORY_IMAGE) return null
        if (pm.getLaunchIntentForPackage(packageName) == null) return null
        return pm.getApplicationLabel(info).toString()
    }
}

object Categories {
    private val RULES = listOf(
        "Food" to Regex("swiggy|zomato|domino|mcdonald|kfc|pizza|burger|cafe|café|restaurant|eats|starbucks|chai", RegexOption.IGNORE_CASE),
        "Groceries" to Regex("blinkit|zepto|instamart|bigbasket|dmart|grocer|jiomart|kirana|mart\\b", RegexOption.IGNORE_CASE),
        "Travel" to Regex("uber|ola\\b|rapido|irctc|metro|redbus|makemytrip|indigo|fuel|petrol|indianoil|hpcl|bpcl|fastag", RegexOption.IGNORE_CASE),
        "Shopping" to Regex("amazon|flipkart|myntra|ajio|nykaa|meesho|croma|reliance digital|decathlon", RegexOption.IGNORE_CASE),
        "Entertainment" to Regex("netflix|spotify|hotstar|prime video|youtube|bookmyshow|pvr|inox|steam", RegexOption.IGNORE_CASE),
        "Bills" to Regex("airtel|jio|vodafone|\\bvi\\b|electricity|bescom|tata power|recharge|broadband|gas|water bill", RegexOption.IGNORE_CASE),
    )

    /** Returns (category, kind) where kind is "merchant" or "personal". */
    fun classify(counterparty: String?, handle: String?): Pair<String, String> {
        val haystack = listOfNotNull(counterparty, handle).joinToString(" ")
        RULES.firstOrNull { (_, regex) -> regex.containsMatchIn(haystack) }?.let { return it.first to "merchant" }
        return "Personal" to "personal"
    }
}
