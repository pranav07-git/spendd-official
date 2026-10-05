package com.spendd.receipts

import org.junit.Assert.assertEquals
import org.junit.Test

class CategoriesTest {
    @Test
    fun knownMerchantsGoStraightToTheirCategory() {
        assertEquals("Food" to "merchant", Categories.classify("Swiggy", "swiggy@icici"))
        assertEquals("Medical" to "merchant", Categories.classify("Apollo Pharmacy", null))
        assertEquals("Travel" to "merchant", Categories.classify("Uber India", "uber@axisbank"))
    }

    @Test
    fun unknownBusinessesWaitForSpenddAiAsOther() {
        assertEquals("Other" to "merchant", Categories.classify("Rui Chuang Technologies Pvt", "ruichuangtechnologie.63332869@hdfcbank"))
        assertEquals("Other" to "merchant", Categories.classify("Fusion", "0530@hdfcbank"))
    }

    @Test
    fun peopleArePersonal() {
        assertEquals("Personal" to "personal", Categories.classify("Ravi Shekhar Kumar", "ebed@mbk"))
        assertEquals("Personal" to "personal", Categories.classify("Pranjal Vats", "9876543210@ybl"))
        assertEquals("Personal" to "personal", Categories.classify(null, null))
    }
}
