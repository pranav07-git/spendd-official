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

/**
 * Spendd's built-in merchant list: well-known names go straight to their category. Anything else is
 * left for Spendd AI to place (src/transactions/autoCategorize.ts); people go to the story's question.
 */
object Categories {
    private fun rule(category: String, pattern: String) = category to Regex(pattern, RegexOption.IGNORE_CASE)

    private val RULES = listOf(
        rule("Food", "swiggy|zomato|domino|mcdonald|kfc|pizza|burger|cafe|café|restaurant|eats|starbucks|chai|biryani|dhaba|bakery|haldiram|subway|baskin|barbeque|eatclub|box8|faasos|chaayos|third wave"),
        rule("Groceries", "blinkit|zepto|instamart|bigbasket|dmart|grocer|jiomart|kirana|mart\\b|more retail|spencer|nature'?s basket|milkbasket|country delight|licious|fresh to home|swiggy genie"),
        rule("Medical", "pharma|pharmacy|medical|chemist|apollo|medplus|1mg|pharmeasy|netmeds|hospital|clinic|diagnostic|lab\\b|healthcare|practo"),
        rule("Travel", "uber|ola\\b|olacabs|rapido|irctc|metro|redbus|makemytrip|goibibo|cleartrip|ixigo|indigo|air ?india|akasa|spicejet|vistara|fuel|petrol|indianoil|indian oil|hpcl|bpcl|shell|fastag|namma yatri|blusmart|yulu"),
        rule("Shopping", "amazon|flipkart|myntra|ajio|nykaa|meesho|croma|reliance digital|decathlon|tata cliq|snapdeal|lenskart|ikea|zara|h&m|uniqlo|westside|pantaloons|lifestyle|vijay sales|apple|samsung|vivo|oppo|xiaomi|oneplus"),
        rule("Entertainment", "netflix|spotify|hotstar|jiocinema|prime video|youtube|bookmyshow|district|pvr|inox|cinepolis|steam|playstation|xbox|sonyliv|zee5|gaana|wynk"),
        rule("Bills", "airtel|jio\\b|vodafone|\\bvi\\b|bsnl|electricity|bescom|tata power|adani|recharge|broadband|act fibernet|\\bgas\\b|water bill|bill ?desk|billdesk|insurance|lic\\b|emi\\b|loan|credit card|cred\\b"),
        rule("Education", "school|college|university|institute|academy|coaching|udemy|coursera|byju|unacademy|physics ?wallah|upgrad|tuition|exam fee"),
        rule("Rent", "\\brent\\b|nobroker|nestaway|housing\\.com|stanza|zolo|\\bpg\\b"),
    )

    /** Words that mark a business rather than a person ("Sharma Traders", "Rui Chuang Technologies Pvt"). */
    private val BUSINESS = Regex(
        "\\b(pvt|private|ltd|limited|llp|inc|co|company|corp|store|stores|shop|mart|traders?|enterprises?|services?|" +
            "solutions|technologies|tech|retail|foods?|hotel|motors|garage|travels?|tours|bank|finance|online|" +
            "fashion|electronics|mobiles|gym|fitness|salon|spa|studio|kitchen|bar|pub|dairy|fruits?|laundry|" +
            "tailors?|opticals?|jewell?ers|hardware|furniture|india)\\b",
        RegexOption.IGNORE_CASE,
    )

    /** Mirrors looksLikePerson in src/transactions/merchants.ts. */
    private fun looksLikePerson(counterparty: String?, handle: String?): Boolean {
        val local = handle?.takeIf { it.contains('@') }?.substringBefore('@')
        if (local != null && Regex("^\\+?\\d[\\d.-]{7,}$").matches(local)) return true
        val name = counterparty?.trim().orEmpty()
        if (name.isEmpty()) return handle == null
        if (BUSINESS.containsMatchIn(name) || name.any { it.isDigit() }) return false
        val words = name.split(Regex("\\s+"))
        return words.size in 2..3 && words.all { Regex("^[a-z.'-]+$", RegexOption.IGNORE_CASE).matches(it) }
    }

    /** Returns (category, kind) where kind is "merchant" or "personal". */
    fun classify(counterparty: String?, handle: String?): Pair<String, String> {
        val haystack = listOfNotNull(counterparty, handle).joinToString(" ")
        RULES.firstOrNull { (_, regex) -> regex.containsMatchIn(haystack) }?.let { return it.first to "merchant" }
        // Not on the list: a person's payment waits for the user; a business waits for Spendd AI.
        return if (looksLikePerson(counterparty, handle)) "Personal" to "personal" else "Other" to "merchant"
    }
}
