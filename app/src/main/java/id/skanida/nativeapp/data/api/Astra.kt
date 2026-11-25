package id.skanida.nativeapp.data.api

import android.util.Base64
import android.util.Base64OutputStream
import id.skanida.nativeapp.BuildConfig
import id.skanida.nativeapp.data.auth.Identity
import id.skanida.nativeapp.data.model.AttendancePrecheckResult
import id.skanida.nativeapp.data.model.AttendanceSubmitResult
import id.skanida.nativeapp.data.model.DashboardData
import id.skanida.nativeapp.data.model.EnrollmentStatusData
import id.skanida.nativeapp.data.model.EnrollmentSubmitResult
import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.data.model.RawAttendanceRecord
import id.skanida.nativeapp.data.model.UserProfile
import id.skanida.nativeapp.data.model.json
import id.skanida.nativeapp.data.model.objects
import id.skanida.nativeapp.data.model.text
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.time.YearMonth
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink
import org.json.JSONObject

class AstraError(val status: Int, val code: String, message: String, val details: JSONObject? = null) : Exception(message)

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

/**
 * Streams the attendance JSON payload directly from the JPEG file to OkHttp without
 * materializing full-file byte arrays, Base64 strings, or serialized JSON copies in heap.
 */
internal class AttendanceSubmitRequestBody(
    private val actionType: String,
    private val imageFile: File,
    private val latitude: Double,
    private val longitude: Double,
) : RequestBody() {
    override fun contentType(): MediaType = JSON_MEDIA_TYPE

    override fun writeTo(sink: BufferedSink) {
        sink.writeUtf8("{\"action_type\":")
        sink.writeUtf8(JSONObject.quote(actionType))
        sink.writeUtf8(",\"image_base64\":\"")
        val nonClosingOut = object : OutputStream() {
            override fun write(b: Int) {
                sink.writeByte(b)
            }

            override fun write(b: ByteArray, off: Int, len: Int) {
                sink.write(b, off, len)
            }
        }
        val b64 = Base64OutputStream(nonClosingOut, Base64.NO_WRAP or Base64.NO_CLOSE)
        imageFile.inputStream().buffered(STREAM_BUFFER_BYTES).use { input ->
            val buf = ByteArray(STREAM_BUFFER_BYTES)
            while (true) {
                val read = input.read(buf)
                if (read <= 0) break
                b64.write(buf, 0, read)
            }
        }
        b64.close()
        sink.writeUtf8("\",\"latitude\":")
        sink.writeUtf8(latitude.toString())
        sink.writeUtf8(",\"longitude\":")
        sink.writeUtf8(longitude.toString())
        sink.writeUtf8("}")
    }

    private companion object {
        const val STREAM_BUFFER_BYTES = 16 * 1024
    }
}

private val JSON_MEDIA_TYPE: MediaType = "application/json".toMediaType()
private val JPEG_MEDIA_TYPE: MediaType = "image/jpeg".toMediaType()

class Astra(private val identity: Identity) {
    // Shared OkHttpClient reused by Coil and PushController so only one connection/thread pool lives in RAM.
    val httpClient: OkHttpClient = OkHttpClient.Builder()
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
        val call = httpClient.newCall(request).apply {
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

    suspend fun send(path: String, data: JSONObject, method: String = "POST", authenticated: Boolean = true, timeout: Long = 30): Any? =
        request(
            path = path,
            method = method,
            body = data.toString().toRequestBody(JSON_MEDIA_TYPE),
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
                    addFormDataPart(field, file.name, file.asRequestBody(JPEG_MEDIA_TYPE))
                }
            }
            .build()
        return request(path, method, body, timeoutSeconds = timeout)
    }

    suspend fun getProfile(): UserProfile = UserProfile.fromJson(get("/v1/mobile/profile"))

    suspend fun getDashboard(): DashboardData = DashboardData.fromJson(get("/v1/mobile/dashboard"))

    suspend fun getMonthlyAttendance(month: YearMonth): List<RawAttendanceRecord> {
        val start = month.atDay(1)
        val end = month.atEndOfMonth()
        return get("/v1/mobile/attendance?startDate=$start&endDate=$end&start_date=$start&end_date=$end")
            .optJSONArray("items")?.objects().orEmpty().map(RawAttendanceRecord::fromJson)
    }

    suspend fun getPermits(): List<PermitRecord> =
        get("/v1/mobile/permits").optJSONArray("items")?.objects().orEmpty().map(PermitRecord::fromJson)

    suspend fun getEnrollmentStatus(): EnrollmentStatusData =
        EnrollmentStatusData.fromJson(get("/v1/mobile/face/enrollment/status"))

    suspend fun requireHealthyService() {
        val health = request("/v1/mobile/health", authenticated = false) as? JSONObject
            ?: error("Server verifikasi belum siap. Silakan coba lagi.")
        check(health.text("status") == "healthy") { "Server verifikasi belum siap. Silakan coba lagi." }
    }

    suspend fun precheckAttendance(
        latitude: Double,
        longitude: Double,
        isPastLateDeadline: (String?) -> Boolean,
    ): AttendancePrecheckResult {
        val response = send(
            "/v1/mobile/attendance/precheck",
            json("latitude" to latitude, "longitude" to longitude),
        ) as? JSONObject ?: error("Respons pemeriksaan presensi tidak valid.")
        return AttendancePrecheckResult.fromJson(response, isPastLateDeadline)
    }

    suspend fun submitAttendancePhoto(
        actionType: String,
        imageFile: File,
        latitude: Double,
        longitude: Double,
    ): AttendanceSubmitResult {
        val body = AttendanceSubmitRequestBody(actionType, imageFile, latitude, longitude)
        val rawResult = request("/v1/mobile/attendance/submit", method = "POST", body = body, timeoutSeconds = 45) as? JSONObject
            ?: error("Respons presensi tidak valid.")
        return AttendanceSubmitResult.fromJson(rawResult)
    }

    suspend fun uploadFaceEnrollment(photos: List<File>): EnrollmentSubmitResult {
        val raw = upload(
            "/v1/mobile/face/enrollment",
            files = photos.map { "files" to it },
            timeout = 60,
        ) as? JSONObject ?: error("Respons pendaftaran wajah tidak valid.")
        return EnrollmentSubmitResult.fromJson(raw)
    }

    suspend fun submitPermit(category: String, description: String, date: String, attachment: File) {
        upload(
            "/v1/mobile/permits",
            fields = mapOf("category" to category, "description" to description, "date" to date),
            files = listOf("attachment" to attachment),
            timeout = 45,
        )
    }

    suspend fun uploadAvatar(file: File) {
        upload("/v1/mobile/profile/avatar", files = listOf("file" to file), method = "PATCH", timeout = 45)
    }

    suspend fun clearAvatar() {
        send("/v1/mobile/profile/avatar", json("clear" to true), "PATCH")
    }

    suspend fun signup(nis: String, email: String, password: String) {
        send(
            "/v1/auth/student/signup",
            json("nis" to nis, "email" to email, "password" to password),
            authenticated = false,
        )
    }

    suspend fun resetPassword(nis: String, code: String, newPassword: String) {
        send(
            "/v1/auth/student/reset-password",
            json("nis" to nis, "code" to code, "new_password" to newPassword),
            authenticated = false,
        )
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        send(
            "/v1/mobile/profile/password",
            json("current_password" to currentPassword, "new_password" to newPassword),
            "PATCH",
        )
    }

    suspend fun getNotificationToken(): String = get("/v1/mobile/notifications/token").text("notification_token")

    suspend fun setNotificationToken(token: String?) {
        send("/v1/mobile/notifications/token", json("token" to token), "PATCH")
    }
}
