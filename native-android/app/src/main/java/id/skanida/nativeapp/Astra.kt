package id.skanida.nativeapp

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

class AstraError(val status: Int, val code: String, message: String, val details: JSONObject? = null) : Exception(message)

fun JSONObject.text(key: String, fallback: String = ""): String = if (isNull(key)) fallback else optString(key, fallback)
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
fun json(vararg values: Pair<String, Any?>) = JSONObject().apply { values.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } }

object AstraEnvelope {
    fun decode(status: Int, version: String?, body: String): Any? {
        if (version != "v1") throw AstraError(502, "CONTRACT_VERSION_UNSUPPORTED", "Versi kontrak server tidak kompatibel. Silakan perbarui aplikasi.")
        val envelope = runCatching { JSONObject(body) }.getOrNull()
        if (status !in 200..299 || envelope?.optBoolean("success") != true) {
            val error = envelope?.optJSONObject("error")
            val code = error?.text("code").orEmpty()
            val details = error?.optJSONObject("details")
            val message = when (code) {
                "LEAVE_REQUEST_PENDING" -> "Pengajuan izin masih menunggu persetujuan. Tunggu hingga diproses sebelum mengajukan lagi."
                "LEAVE_PERIOD_OVERLAP" -> "Tanggal pengajuan bertumpang tindih dengan izin yang sudah disetujui (${details?.text("overlapping_start_date").orEmpty()} sampai ${details?.text("overlapping_end_date").orEmpty()})."
                "LEAVE_APPROVAL_CONFLICT" -> "Pengajuan ditolak karena absensi fisik sudah tercatat pada: ${details?.optJSONArray("conflicting_dates")?.join(", ").orEmpty()}."
                else -> error?.text("message")?.takeIf { it.isNotBlank() } ?: "Permintaan server gagal ($status). Silakan coba lagi."
            }
            throw AstraError(status, code, message, details)
        }
        return envelope.opt("data").takeUnless { it == JSONObject.NULL }
    }
}

class Astra(private val identity: Identity) {
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS).callTimeout(60, TimeUnit.SECONDS)
        .followRedirects(false).build()

    suspend fun request(path: String, method: String = "GET", body: RequestBody? = null, authenticated: Boolean = true, timeoutSeconds: Long = 30): Any? {
        val token = if (authenticated) identity.accessToken() else null
        return withContext(Dispatchers.IO) {
            val request = Request.Builder().url(BuildConfig.ASTRA_URL.trimEnd('/') + path)
                .header("Accept", "application/json").header("X-Astra-Contract-Version", "v1")
                .header("X-Request-Id", "native-${UUID.randomUUID()}")
                .apply { if (token != null) header("Authorization", "Bearer $token") }
                .method(method, body).build()
            client.newCall(request).apply { timeout().timeout(timeoutSeconds, TimeUnit.SECONDS) }.execute().use { response ->
                AstraEnvelope.decode(response.code, response.header("X-Astra-Contract-Version"), response.body?.string().orEmpty())
            }
        }
    }

    suspend fun get(path: String): JSONObject = request(path) as? JSONObject ?: error("Respons server tidak valid.")
    suspend fun send(path: String, data: JSONObject, method: String = "POST", authenticated: Boolean = true, timeout: Long = 30): Any? =
        request(path, method, data.toString().toRequestBody("application/json".toMediaType()), authenticated, timeout)

    suspend fun upload(path: String, fields: Map<String, String> = emptyMap(), files: List<Pair<String, File>>, method: String = "POST", timeout: Long = 60): Any? {
        val body = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
            fields.forEach { (key, value) -> addFormDataPart(key, value) }
            files.forEach { (field, file) -> addFormDataPart(field, file.name, file.asRequestBody("image/jpeg".toMediaType())) }
        }.build()
        return request(path, method, body, timeoutSeconds = timeout)
    }
}
