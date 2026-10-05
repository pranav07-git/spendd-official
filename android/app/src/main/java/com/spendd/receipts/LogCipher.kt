package com.spendd.receipts

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** The log's bytes can never be read back (wrong key, truncated, tampered). Not a temporary error. */
class CorruptLogException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Encrypts the transaction log at rest. */
interface LogCodec {
    /** Whether [bytes] are in this codec's format (rather than a legacy plaintext log). */
    fun isEncrypted(bytes: ByteArray): Boolean
    fun encrypt(plain: ByteArray): ByteArray

    /**
     * Throws [CorruptLogException] when the bytes can never be decrypted; any other exception
     * (e.g. the Keystore being briefly unavailable) means "try again later".
     */
    fun decrypt(encrypted: ByteArray): ByteArray
}

/**
 * AES-256-GCM. Layout: "SPD1" magic, IV length (1 byte), IV, ciphertext + tag.
 * The key comes from [key] each time, so a Keystore-backed key never leaves the Keystore.
 */
open class AesGcmLogCodec(private val key: () -> SecretKey) : LogCodec {

    override fun isEncrypted(bytes: ByteArray): Boolean =
        bytes.size >= MAGIC.size && MAGIC.indices.all { bytes[it] == MAGIC[it] }

    override fun encrypt(plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val iv = cipher.iv
        return MAGIC + byteArrayOf(iv.size.toByte()) + iv + cipher.doFinal(plain)
    }

    override fun decrypt(encrypted: ByteArray): ByteArray {
        if (!isEncrypted(encrypted) || encrypted.size <= MAGIC.size) throw CorruptLogException("Not an encrypted log")
        val ivLength = encrypted[MAGIC.size].toInt() and 0xFF
        val ivStart = MAGIC.size + 1
        if (ivLength !in 12..16 || encrypted.size < ivStart + ivLength + TAG_BYTES) throw CorruptLogException("Truncated log")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BYTES * 8, encrypted, ivStart, ivLength))
        return try {
            cipher.doFinal(encrypted, ivStart + ivLength, encrypted.size - ivStart - ivLength)
        } catch (e: AEADBadTagException) {
            throw CorruptLogException("Log failed authentication", e)
        }
    }

    companion object {
        private val MAGIC = "SPD1".toByteArray(Charsets.US_ASCII)
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val TAG_BYTES = 16
    }
}

/**
 * The app's codec: a non-extractable AES-256 key in the Android Keystore. No user
 * authentication is required, because the background worker writes while the app is locked.
 */
object KeystoreLogCodec : AesGcmLogCodec(::keystoreKey)

private const val KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "spendd.transactions.v1"
private val KEY_LOCK = Any()

private fun keystoreKey(): SecretKey = synchronized(KEY_LOCK) {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return@synchronized it }
    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
        init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        generateKey()
    }
}
