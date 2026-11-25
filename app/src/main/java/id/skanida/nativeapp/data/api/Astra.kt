package id.skanida.nativeapp.data.api

import id.skanida.nativeapp.BuildConfig
import id.skanida.nativeapp.data.auth.Identity
import id.skanida.nativeapp.data.model.text
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject

class AstraError(val status: Int, val code: String, message: String, val details: JSONObject? = null,) : Exception(message)

object AstraEnvelope {
    fun decode(status: Int, version: String?, body: String): Any? {
        if (version != "v1") {
            throw AstraError(
                502,
                "CONTRACT_VERSION_UNSUPPORTED",
                "Versi kontrak server tidak kompatibel. Silakan perbarui aplikasi.",
            )
        }
        val envelope = runCatching { JSONObject(body) }.getOrNull()
        if (status !in 200..299 || envelope?.optBoolean("success") != true) {
            val error = envelope?.optJSONObject("error")
            val code = error?.text("code").orEmpty()
            val details = error?.optJSONObject("details")
            val message = when (code) {
                "LEAVE_REQUEST_PENDING" ->
                    "Pengajuan izin masih menunggu persetujuan. Tunggu hingga diproses sebelum mengajukan lagi."
                "LEAVE_PERIOD_OVERLAP" -> {
                    val start = details?.text("overlapping_start_date").orEmpty()
                    val end = details?.text("overlapping_end_date").orEmpty()
                    val period = if (start.isNotBlank() && end.isNotBlank()) " ($start sampai $end)" else ""
                    "Tanggal pengajuan bertumpang tindih dengan izin yang sudah disetujui$period. Pilih tanggal lain."
                }
                "LEAVE_APPROVAL_CONFLICT" -> {
                    val datesArray = details?.optJSONArray("conflicting_dates")
                    val dates = if (datesArray != null && datesArray.length() > 0) {
                        (0 until datesArray.length()).joinToString(", ") { datesArray.optString(it) }
                    } else {
                        "tanggal yang sudah memiliki absensi fisik"
                    }
                    "Pengajuan ditolak karena absensi fisik sudah tercatat pada: $dates."
                }
                else -> error?.text("message")?.takeIf { it.isNotBlank() }
                    ?: "Permintaan server gagal ($status). Silakan coba lagi."
            }
            throw AstraError(status, code, message, details)
        }
        return envelope.opt("data").takeUnless { it == JSONObject.NULL }
    }
}

class Astra(private val identity: Identity) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(60, TimeUnit.SECONDS)
        .followRedirects(false)
        .build()

    suspend fun request(
        path: String,
        method: String = "GET",
        body: RequestBody? = null,
        authenticated: Boolean = true,
        timeoutSeconds: Long = 30,
    ): Any? {
        val token = if (authenticated) identity.accessToken() else null
        val request = Request.Builder()
            .url(BuildConfig.ASTRA_URL.trimEnd('/') + path)
            .header("Accept", "application/json")
            .header("X-Astra-Contract-Version", "v1")
            .header("X-Request-Id", "native-${UUID.randomUUID()}")
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .method(method, body)
            .build()
        val call = client.newCall(request).apply {
            timeout().timeout(timeoutSeconds, TimeUnit.SECONDS)
        }
        return suspendCancellableCoroutine { continuation ->
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isActive) {
                        continuation.resumeWithException(e)
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val decoded = response.use { res ->
                            AstraEnvelope.decode(
                                res.code,
                                res.header("X-Astra-Contract-Version"),
                                res.body?.string().orEmpty(),
                            )
                        }
                        if (continuation.isActive) {
                            continuation.resume(decoded)
                        }
                    } catch (failure: Exception) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(failure)
                        }
                    }
                }
            })
        }
    }

    suspend fun get(path: String): JSONObject = request(path) as? JSONObject ?: error("Respons server tidak valid.")

    suspend fun send(path: String, data: JSONObject, method: String = "POST", authenticated: Boolean = true, timeout: Long = 30,): Any? =
        request(
            path = path,
            method = method,
            body = data.toString().toRequestBody("application/json".toMediaType()),
            authenticated = authenticated,
            timeoutSeconds = timeout,
        )

    suspend fun upload(
        path: String,
        fields: Map<String, String> = emptyMap(),
        files: List<Pair<String, File>>,
        method: String = "POST",
        timeout: Long = 60,
    ): Any? {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .apply {
                fields.forEach { (key, value) -> addFormDataPart(key, value) }
                files.forEach { (field, file) ->
                    addFormDataPart(field, file.name, file.asRequestBody("image/jpeg".toMediaType()))
                }
            }
            .build()
        return request(path, method, body, timeoutSeconds = timeout)
    }
}
