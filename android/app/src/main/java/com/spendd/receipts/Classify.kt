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
    /** Each keyword must start a word: "ola" matches "Ola Cabs", not "Kolar"; "gas" not "Vegas". */
    private fun words(vararg keywords: String) =
        Regex("(?<![\\p{L}\\p{N}])(?:${keywords.joinToString("|")})", RegexOption.IGNORE_CASE)

    private val RULES = listOf(
        "Food" to words("swiggy", "zomato", "domino", "mcdonald", "kfc", "pizza", "burger", "cafe", "café", "restaurant", "eats", "starbucks", "chai"),
        "Groceries" to words("blinkit", "zepto", "instamart", "bigbasket", "dmart", "grocer", "jiomart", "kirana", "mart\\b"),
        "Travel" to words("uber", "ola\\b", "rapido", "irctc", "metro", "redbus", "makemytrip", "indigo", "fuel", "petrol", "indianoil", "hpcl", "bpcl", "fastag"),
        "Shopping" to words("amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "croma", "reliance digital", "decathlon"),
        "Entertainment" to words("netflix", "spotify", "hotstar", "prime video", "youtube", "bookmyshow", "pvr", "inox", "steam"),
        "Bills" to words("airtel", "jio", "vodafone", "vi\\b", "electricity", "bescom", "tata power", "recharge", "broadband", "gas", "water bill"),
    )

    /** Returns (category, kind) where kind is "merchant" or "personal". */
    fun classify(counterparty: String?, handle: String?): Pair<String, String> {
        val haystack = listOfNotNull(counterparty, handle).joinToString(" ")
        RULES.firstOrNull { (_, regex) -> regex.containsMatchIn(haystack) }?.let { return it.first to "merchant" }
        return "Personal" to "personal"
    }
}
