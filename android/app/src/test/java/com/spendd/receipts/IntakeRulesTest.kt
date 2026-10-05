package com.spendd.receipts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class IntakeRulesTest {

    @Test
    fun acceptsOnlyContentImages() {
        assertTrue(IntakeRules.acceptsUri("content", "image/png"))
        assertTrue(IntakeRules.acceptsUri("CONTENT", "Image/JPEG"))
        assertFalse(IntakeRules.acceptsUri("file", "image/png"))
        assertFalse(IntakeRules.acceptsUri("content", "application/pdf"))
        assertFalse(IntakeRules.acceptsUri("content", null))
        assertFalse(IntakeRules.acceptsUri(null, "image/png"))
    }

    @Test
    fun stopsCopyingPastTheLimit() {
        val out = ByteArrayOutputStream()
        assertTrue(IntakeRules.copyBounded(ByteArrayInputStream(ByteArray(1000)), out, limit = 1000))
        assertEquals(1000, out.size())
        assertFalse(IntakeRules.copyBounded(ByteArrayInputStream(ByteArray(1001)), ByteArrayOutputStream(), limit = 1000))
        assertEquals(25L * 1024 * 1024, IntakeRules.MAX_IMAGE_BYTES)
        assertEquals(10, IntakeRules.MAX_IMAGES)
    }
}
