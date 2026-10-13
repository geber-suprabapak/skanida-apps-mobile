package id.skanida.nativeapp

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
enum class Page { HOME, HISTORY, PERMITS, SETTINGS, SIGNUP, RESET, ACCOUNT, PASSWORD, LEAVE, ATTENDANCE, ENROLLMENT, ATTACHMENT, AVATAR }
private data class AttendanceAttempt(val userId: String, val action: String, val latitude: Double, val longitude: Double, val createdAt: Long)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    val app = application as SkanidaApplication
    val identity = app.identity
    val astra = app.astra
    var signedIn by mutableStateOf(identity.signedIn); private set
    var page by mutableStateOf(Page.HOME); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    var profile by mutableStateOf<JSONObject?>(null); private set
    var dashboard by mutableStateOf<JSONObject?>(null); private set
    var records by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var permits by mutableStateOf<List<JSONObject>>(emptyList()); private set
    var month by mutableStateOf(YearMonth.now(WIB)); private set
    var selectedDate by mutableStateOf(LocalDate.now(WIB)); private set
    var enrollmentStatus by mutableStateOf<JSONObject?>(null); private set
    var photos by mutableStateOf<List<File>>(emptyList()); private set
    var attachment by mutableStateOf<File?>(null); private set
    var leaveCategory by mutableStateOf("sakit")
    var leaveDescription by mutableStateOf("")
    var theme by mutableStateOf(app.preferences.getString("theme", "system") ?: "system"); private set
    var notificationsEnabled by mutableStateOf(false); private set
    var serverOffsetMs by mutableStateOf(0L); private set
    private var attempt: AttendanceAttempt? = null
    private var operation: Job? = null
    var captureGeneration = 0; private set
    val lifecycle get() = profile?.text("lifecycle_status", "approved") ?: "approved"
    val approved get() = lifecycle == "approved"
    val today get() = Instant.ofEpochMilli(System.currentTimeMillis() + serverOffsetMs).atZone(WIB).toLocalDate()

    init {
        // No capture survives process death; biometric images are temporary.
        application.cacheDir.listFiles()?.filter { it.name.startsWith("capture-") }?.forEach { it.delete() }
        if (signedIn) refresh()
    }

    private fun run(block: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = null
        operation = viewModelScope.launch {
            try { block() }
            catch (_: TimeoutCancellationException) { error = "Permintaan melebihi batas waktu. Silakan coba lagi." }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                error = when (failure) {
                    is java.net.SocketTimeoutException -> "Permintaan melebihi batas waktu. Silakan coba lagi."
                    is java.io.IOException -> "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi."
                    else -> failure.message ?: "Terjadi kesalahan. Silakan coba lagi."
                }
                if (!identity.signedIn) { signedIn = false; app.push.localLogout(); clearAccountData() }
            } finally { busy = false }
        }
    }

    fun showError(message: String) { error = message }
    fun dismissError() { error = null }
    fun dismissNotice() { notice = null }
    fun showNotice(message: String) { notice = message }
    fun updateTheme(value: String) { theme = value; app.preferences.edit().putString("theme", value).apply() }
    fun selectDate(value: LocalDate) { selectedDate = value }

    fun login(start: (Intent) -> Unit) = run { start(identity.loginIntent()) }
    fun completeLogin(intent: Intent?) = run {
        check(intent != null) { "Login dibatalkan. Silakan coba lagi." }
        identity.completeLogin(intent)
        clearAccountData()
        signedIn = true
        page = if (identity.mustChangePassword) Page.PASSWORD else Page.HOME
        loadProfileAndDashboard()
    }

    fun logout(start: (Intent) -> Unit) = run {
        // Unregister before clearing identity so another user never inherits this device token.
        if (app.push.registeredForCurrentUser()) {
            try { app.push.disable() } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { notice = "Keluar berhasil. Token notifikasi lama akan diganti sebelum notifikasi diaktifkan kembali." }
        }
        val intent = identity.logoutIntent()
        identity.clear()
        app.push.localLogout()
        cleanupCaptures()
        clearAccountData()
        signedIn = false; notificationsEnabled = false; page = Page.HOME
        if (intent != null) start(intent)
    }

    fun refresh() = run {
        if (!signedIn) return@run
        when (page) {
            Page.HISTORY -> loadHistory()
            Page.PERMITS, Page.LEAVE -> loadPermits()
            Page.ENROLLMENT -> checkEnrollment()
            else -> loadProfileAndDashboard()
        }
    }

    private suspend fun loadProfileAndDashboard() {
        profile = astra.get("/v1/mobile/profile")
        if (identity.mustChangePassword) page = Page.PASSWORD
        if (approved) {
            dashboard = astra.get("/v1/mobile/dashboard")
            dashboard?.optJSONObject("server_time")?.text("now")?.let {
                runCatching { serverOffsetMs = Instant.parse(it).toEpochMilli() - System.currentTimeMillis() }
            }
        }
        notificationsEnabled = try { app.push.reconcile() } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { app.push.enabledForCurrentUser() }
    }

    fun navigate(target: Page) {
        if (busy) return
        if (identity.mustChangePassword && signedIn && target != Page.PASSWORD) { page = Page.PASSWORD; return }
        if (page in listOf(Page.ATTACHMENT, Page.AVATAR) && page != target) captureGeneration++
        if (page in listOf(Page.ATTENDANCE, Page.ENROLLMENT) && target != page) cleanupCaptures()
        if (page == Page.LEAVE && target != Page.ATTACHMENT) { attachment?.delete(); attachment = null }
        error = null
        page = target
        if (signedIn) when (target) {
            Page.HISTORY -> run { loadHistory() }
            Page.PERMITS -> run { loadPermits() }
            Page.LEAVE -> run { loadPermits() }
            Page.ACCOUNT -> run { profile = astra.get("/v1/mobile/profile"); enrollmentStatus = astra.get("/v1/mobile/face/enrollment/status") }
            else -> Unit
        }
    }

    fun back() {
        if (busy) return
        navigate(when (page) {
            Page.ATTACHMENT -> Page.LEAVE
            Page.AVATAR -> Page.ACCOUNT
            Page.LEAVE -> Page.PERMITS
            Page.ACCOUNT, Page.PASSWORD, Page.ENROLLMENT -> Page.SETTINGS
            else -> Page.HOME
        })
    }

    fun changeMonth(delta: Long) {
        if (busy) return
        selectMonth(month.plusMonths(delta))
    }
    fun selectMonth(value: YearMonth) {
        if (busy || value > YearMonth.from(today)) return
        month = value
        records = emptyList()
        selectedDate = month.atDay(1)
        run { loadHistory() }
    }
    private suspend fun loadHistory() {
        val start = month.atDay(1); val end = month.atEndOfMonth()
        val attendance = astra.get("/v1/mobile/attendance?startDate=$start&endDate=$end&start_date=$start&end_date=$end")
            .optJSONArray("items")?.objects().orEmpty()
        loadPermits()
        records = attendanceHistory(attendance, permits).filter { it.text("date") >= start.toString() && it.text("date") <= end.toString() }
    }
    private suspend fun loadPermits() { permits = astra.get("/v1/mobile/permits").optJSONArray("items")?.objects().orEmpty() }

    fun signup(nis: String, email: String, password: String, confirm: String) = run {
        check(nis.matches(Regex("[0-9]+"))) { "NIS harus berupa angka." }
        check(android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) { "Email tidak valid." }
        check(password.length >= 8 && password.any { it.isUpperCase() } && password.any { it.isLowerCase() } && password.any { it.isDigit() }) {
            "Password minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka."
        }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send("/v1/auth/student/signup", json("nis" to nis.trim(), "email" to email.trim(), "password" to password), authenticated = false)
        page = Page.HOME
        notice = "Pendaftaran berhasil dikirim dan menunggu persetujuan sekolah."
    }

    fun resetPassword(nis: String, code: String, password: String, confirm: String) = run {
        check(nis.isNotBlank() && code.isNotBlank()) { "NIS dan kode pemulihan wajib diisi." }
        check(password.length >= 8) { "Password minimal 8 karakter." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send("/v1/auth/student/reset-password", json("nis" to nis.trim(), "code" to code.trim(), "new_password" to password), authenticated = false)
        page = Page.HOME; notice = "Password berhasil diperbarui. Silakan login kembali."
    }

    fun changePassword(current: String, password: String, confirm: String) = run {
        check(current.isNotBlank() && password.length >= 8) { "Isi password saat ini dan password baru minimal 8 karakter." }
        check(password.any { it.isUpperCase() } && password.any { it.isLowerCase() } && password.any { it.isDigit() }) { "Password harus mengandung huruf besar, huruf kecil, dan angka." }
        check(current != password) { "Password baru harus berbeda dari password lama." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send("/v1/mobile/profile/password", json("current_password" to current, "new_password" to password), "PATCH")
        identity.clear(); app.push.localLogout(); signedIn = false; cleanupCaptures(); clearAccountData()
        page = Page.HOME; notice = "Password diperbarui. Silakan login kembali dengan password baru."
    }

    fun importImage(uri: Uri, avatar: Boolean) = run {
        val file = prepareImage(app, uri, if (avatar) 5L * 1024 * 1024 else 10L * 1024 * 1024)
        if (avatar) {
            try {
                uploadAvatar(file)
            } finally { file.delete() }
        } else { attachment?.delete(); attachment = file }
    }
    private suspend fun uploadAvatar(file: File) {
        astra.upload("/v1/mobile/profile/avatar", files = listOf("file" to file), method = "PATCH", timeout = 45)
        profile = astra.get("/v1/mobile/profile")
        notice = "Foto profil diperbarui."
    }

    fun clearAvatar() = run {
        astra.send("/v1/mobile/profile/avatar", json("clear" to true), "PATCH")
        profile = astra.get("/v1/mobile/profile")
    }
    fun removeAttachment() { attachment?.delete(); attachment = null }

    fun submitLeave() = run {
        val description = leaveDescription.trim()
        check(description.length in 10..500) { "Keterangan harus 10–500 karakter." }
        val photo = attachment ?: error("Lampirkan foto bukti izin terlebih dahulu.")
        loadPermits()
        val forToday = permits.filter { it.text("date") == today.toString() }
        check(forToday.none { it.text("approval_status") == "pending" }) { "Pengajuan hari ini masih menunggu persetujuan." }
        check(forToday.none { it.text("approval_status") == "approved" }) { "Izin hari ini sudah disetujui." }
        check(forToday.size < 3) { "Batas maksimal 3 pengajuan per hari telah tercapai." }
        astra.upload("/v1/mobile/permits", mapOf("category" to leaveCategory, "description" to description, "date" to today.toString()), listOf("attachment" to photo), timeout = 45)
        removeAttachment(); leaveDescription = ""; page = Page.PERMITS; loadPermits()
        notice = "Pengajuan izin berhasil dikirim. Tunggu persetujuan sekolah."
    }

    fun prepareAttendance() = run {
        check(approved) { "Akun belum disetujui untuk melakukan presensi." }
        val location = currentLocation(app)
        val result = astra.send("/v1/mobile/attendance/precheck", json("latitude" to location.latitude, "longitude" to location.longitude)) as JSONObject
        check(result.optBoolean("allowed")) { result.text("blocking_reason", "Presensi belum dapat dilakukan.") }
        val action = result.text("action_type")
        check(action in listOf("check_in", "check_out")) { "Tindakan presensi tidak valid." }
        attempt = AttendanceAttempt(identity.userId, action, location.latitude, location.longitude, SystemClock.elapsedRealtime())
        page = Page.ATTENDANCE
    }

    fun startEnrollment() = run {
        checkEnrollment()
        page = Page.ENROLLMENT
    }
    private suspend fun checkEnrollment() {
        val health = astra.request("/v1/mobile/health", authenticated = false) as JSONObject
        check(health.text("status") == "healthy") { "Server verifikasi belum siap. Silakan coba lagi." }
        enrollmentStatus = astra.get("/v1/mobile/face/enrollment/status")
    }

    fun captured(raw: File, ownerGeneration: Int, purpose: Page) {
        if (busy || ownerGeneration != captureGeneration || purpose != page) { raw.delete(); return }
        run {
            val max = if (purpose == Page.ENROLLMENT) 2L * 1024 * 1024 else 5L * 1024 * 1024
            val file = try { prepareImage(app, Uri.fromFile(raw), max) } finally { raw.delete() }
            when (purpose) {
                Page.ENROLLMENT -> {
                    if (photos.size >= 10) file.delete() else photos = photos + file
                }
                Page.ATTACHMENT -> { attachment?.delete(); attachment = file; page = Page.LEAVE }
                Page.AVATAR -> { try { uploadAvatar(file); page = Page.ACCOUNT } finally { file.delete() } }
                Page.ATTENDANCE -> {
                    try {
                        val current = attempt ?: error("Sesi presensi tidak ditemukan. Mulai lagi dari beranda.")
                        check(current.userId == identity.userId && SystemClock.elapsedRealtime() - current.createdAt < 600_000) { "Sesi presensi kedaluwarsa. Kembali ke beranda dan coba lagi." }
                        attempt = null
                        val encoded = withContext(Dispatchers.IO) { Base64.encodeToString(file.readBytes(), Base64.NO_WRAP) }
                        val result = astra.send("/v1/mobile/attendance/submit", json("action_type" to current.action, "image_base64" to encoded, "latitude" to current.latitude, "longitude" to current.longitude), timeout = 45) as JSONObject
                        page = Page.HOME
                        notice = "Presensi ${if (result.text("attendance_type") == "check_out") "pulang" else "masuk"} berhasil • ${result.text("status_label")}"
                        loadProfileAndDashboard()
                    } finally { file.delete(); if (attempt == null) page = Page.HOME }
                }
                else -> file.delete()
            }
        }
    }

    fun retakeEnrollment() { photos.forEach { it.delete() }; photos = emptyList() }
    fun submitEnrollment() = run {
        check(photos.size == 10) { "Ambil tepat 10 foto wajah." }
        check(photos.all { it.exists() && it.length() in 1..(2L * 1024 * 1024) }) { "Ada foto tidak valid. Ambil ulang foto." }
        checkEnrollment()
        val result = astra.upload("/v1/mobile/face/enrollment", files = photos.map { "files" to it }) as JSONObject
        cleanupCaptures(); page = Page.SETTINGS
        notice = "Wajah terdaftar: ${result.optInt("imagesProcessed")} foto diproses, ${result.optInt("totalEmbeddings")} data wajah."
        loadProfileAndDashboard()
    }

    fun enableNotifications() = run { app.push.enable(); notificationsEnabled = true }
    fun disableNotifications() = run { app.push.disable(); notificationsEnabled = false }
    private fun cleanupCaptures() { captureGeneration++; attempt = null; retakeEnrollment(); removeAttachment() }
    private fun clearAccountData() {
        dashboard = null; profile = null; records = emptyList(); permits = emptyList(); enrollmentStatus = null
        notificationsEnabled = false; serverOffsetMs = 0L
    }
    override fun onCleared() { cleanupCaptures(); super.onCleared() }
}
