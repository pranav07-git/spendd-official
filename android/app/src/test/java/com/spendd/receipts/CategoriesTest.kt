package com.spendd.receipts

import org.junit.Assert.assertEquals
import org.junit.Test

class CategoriesTest {

    private fun category(counterparty: String?, handle: String? = null) = Categories.classify(counterparty, handle).first

    @Test
    fun matchesKeywordsAtTheStartOfAWord() {
        assertEquals("Food", category("Swiggy"))
        assertEquals("Food", category(null, "swiggy.upi@icici"))
        assertEquals("Travel", category("Ola Cabs"))
        assertEquals("Bills", category("Jio Fiber"))
        assertEquals("Bills", category("Bharat Gas Agency"))
        assertEquals("Groceries", category("D Mart"))
    }

    @Test
    fun ignoresKeywordsInsideOtherWords() {
        assertEquals("Personal", category("Kolar Traders"))
        assertEquals("Personal", category("Vegas Lounge"))
        assertEquals("Personal", category("Beats Studio"))
        assertEquals("Personal", category("Ravi Kumar", "ravi@okaxis"))
        assertEquals("Personal", category("Pradeep Kumar"))
    }
}
