package id.skanida.nativeapp.data.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("identity", Context.MODE_PRIVATE)

    @Volatile
    private var cachedKey: SecretKey? = null

    private fun key(): SecretKey {
        cachedKey?.let { return it }
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val resolved = store.getKey("skanida-session", null) as? SecretKey ?: KeyGenerator
            .getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
                init(
                    KeyGenParameterSpec.Builder(
                        "skanida-session",
                        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                    )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .build(),
                )
            }.generateKey()
        cachedKey = resolved
        return resolved
    }

    @Synchronized
    fun read(): String? {
        val raw = prefs.getString("session", null) ?: return null
        return try {
            val bytes = Base64.decode(raw, Base64.NO_WRAP)
            if (bytes.size <= GCM_IV_LENGTH_BYTES) {
                clear()
                return null
            }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(GCM_TAG_LENGTH_BITS, bytes, 0, GCM_IV_LENGTH_BYTES))
            String(cipher.doFinal(bytes, GCM_IV_LENGTH_BYTES, bytes.size - GCM_IV_LENGTH_BYTES), Charsets.UTF_8)
        } catch (_: Exception) {
            cachedKey = null
            clear()
            null
        }
    }

    @Synchronized
    fun write(value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val encoded = Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)
        check(prefs.edit().putString("session", encoded).commit()) {
            "Sesi tidak dapat disimpan. Coba login kembali."
        }
    }

    @Synchronized
    fun clear() {
        prefs.edit().remove("session").commit()
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_IV_LENGTH_BYTES = 12
        const val GCM_TAG_LENGTH_BITS = 128
    }
}
