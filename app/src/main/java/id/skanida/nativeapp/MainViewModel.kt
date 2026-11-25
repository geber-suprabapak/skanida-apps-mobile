package id.skanida.nativeapp

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import id.skanida.nativeapp.data.api.AstraError
import id.skanida.nativeapp.data.device.currentLocation
import id.skanida.nativeapp.data.device.prepareImage
import id.skanida.nativeapp.data.model.AttendancePrecheckResult
import id.skanida.nativeapp.data.model.AttendanceSubmitResult
import id.skanida.nativeapp.data.model.DailyAttendanceRecord
import id.skanida.nativeapp.data.model.DashboardData
import id.skanida.nativeapp.data.model.EnrollmentStatusData
import id.skanida.nativeapp.data.model.EnrollmentSubmitResult
import id.skanida.nativeapp.data.model.MonthlyAttendanceStats
import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.data.model.RawAttendanceRecord
import id.skanida.nativeapp.data.model.UserProfile
import id.skanida.nativeapp.data.model.json
import id.skanida.nativeapp.data.model.objects
import id.skanida.nativeapp.data.model.text
import id.skanida.nativeapp.domain.workflow.AttendanceAttemptTracker
import id.skanida.nativeapp.domain.workflow.MotivationalQuotes
import id.skanida.nativeapp.domain.workflow.NotificationChannelPrefs
import id.skanida.nativeapp.domain.workflow.PendingAttendanceSuccess
import id.skanida.nativeapp.domain.workflow.PrecheckState
import id.skanida.nativeapp.domain.workflow.WIB
import id.skanida.nativeapp.domain.workflow.buildMonthlyAttendanceHistory
import id.skanida.nativeapp.domain.workflow.computeMonthlyStats
import id.skanida.nativeapp.domain.workflow.parseTimestampToInstant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.SocketTimeoutException
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth

enum class Page {
    HOME,
    HISTORY,
    PERMITS,
    SETTINGS,
    SIGNUP,
    RESET,
    ACCOUNT,
    NOTIFICATIONS,
    PASSWORD,
    LEAVE,
    ATTENDANCE,
    ENROLLMENT,
    ATTACHMENT,
    AVATAR,
}

enum class EnrollmentStep {
    CAPTURE,
    CONFIRM,
    UPLOADING,
    SUCCESS,
    UNKNOWN_OUTCOME,
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    val app = application as SkanidaApplication
    val identity = app.identity
    val astra = app.astra

    var signedIn by mutableStateOf(identity.signedIn); private set
    var page by mutableStateOf(Page.HOME); private set
    var busy by mutableStateOf(false); private set
    var criticalSubmissionInFlight by mutableStateOf(false); private set
    var refreshing by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    var isOnline by mutableStateOf(app.networkMonitor.isOnline.value); private set

    var profile by mutableStateOf<UserProfile?>(null); private set
    var dashboard by mutableStateOf<DashboardData?>(null); private set
    var dashboardError by mutableStateOf<String?>(null); private set

    var records by mutableStateOf<List<DailyAttendanceRecord>>(emptyList()); private set
    var monthlyStats by mutableStateOf<MonthlyAttendanceStats?>(null); private set
    var currentMonthStats by mutableStateOf<MonthlyAttendanceStats?>(null); private set
    var historyLoading by mutableStateOf(false); private set
    var historyError by mutableStateOf<String?>(null); private set

    var permits by mutableStateOf<List<PermitRecord>>(emptyList()); private set
    var permitsLoading by mutableStateOf(false); private set
    var permitsError by mutableStateOf<String?>(null); private set

    var month by mutableStateOf(YearMonth.now(WIB)); private set
    var selectedDate by mutableStateOf(LocalDate.now(WIB)); private set

    var enrollmentStatus by mutableStateOf<EnrollmentStatusData?>(null); private set
    var photos by mutableStateOf<List<File>>(emptyList()); private set
    var enrollmentStep by mutableStateOf(EnrollmentStep.CAPTURE); private set
    var enrollmentResult by mutableStateOf<EnrollmentSubmitResult?>(null); private set
    var enrollmentError by mutableStateOf<String?>(null); private set

    var attachment by mutableStateOf<File?>(null); private set
    var leaveCategory by mutableStateOf("sakit")
    var leaveDescription by mutableStateOf("")

    var theme by mutableStateOf(app.preferences.getString("theme", "system") ?: "system"); private set
    var notificationsEnabled by mutableStateOf(false); private set
    var notificationPrefs by mutableStateOf(app.push.channelPrefs()); private set
    var serverOffsetMs by mutableLongStateOf(0L); private set

    var precheckState by mutableStateOf<PrecheckState>(PrecheckState.Idle); private set
    var pendingAttendanceSuccess by mutableStateOf<PendingAttendanceSuccess?>(null); private set
    var attendanceSubmitError by mutableStateOf<String?>(null); private set
    var attendanceOutcomeUncertain by mutableStateOf(false); private set

    private val attemptTracker = AttendanceAttemptTracker()
    private val backStack = mutableListOf<Page>()
    private val topLevelPages = setOf(Page.HOME, Page.HISTORY, Page.PERMITS, Page.SETTINGS)
    private var operation: Job? = null
    private var operationSeq = 0
    private var operationCancellable = false
    var captureGeneration by mutableIntStateOf(0); private set

    val lifecycle: String get() = profile?.lifecycleStatus ?: "approved"
    val approved: Boolean get() = lifecycle == "approved"
    val syncedNow: Instant get() = Instant.ofEpochMilli(System.currentTimeMillis() + serverOffsetMs)
    val today: LocalDate get() = syncedNow.atZone(WIB).toLocalDate()

    init {
        // No capture survives process death; biometric images are temporary.
        application.cacheDir.listFiles()?.filter { it.name.startsWith("capture-") }?.forEach { it.delete() }

        viewModelScope.launch {
            app.networkMonitor.isOnline
                .drop(1)
                .collect { online ->
                    isOnline = online
                    if (online && signedIn && !busy) {
                        // INV-MOBILE-008: Reconnect reloads complete dashboard projection.
                        refresh()
                    }
                }
        }

        if (signedIn) refresh()
    }

    private fun cancelCancellableOperation(): Boolean {
        if (!busy) return true
        if (!operationCancellable || criticalSubmissionInFlight) return false
        operationSeq++
        operation?.cancel()
        operation = null
        busy = false
        refreshing = false
        operationCancellable = false
        return true
    }

    private fun run(
        asPullRefresh: Boolean = false,
        cancellable: Boolean = false,
        block: suspend () -> Unit,
    ) {
        if (busy && !cancelCancellableOperation()) return
        busy = true
        operationCancellable = cancellable
        if (asPullRefresh) refreshing = true
        error = null
        val seq = ++operationSeq
        operation = viewModelScope.launch {
            try {
                block()
            } catch (_: TimeoutCancellationException) {
                if (operationSeq == seq) {
                    error = "Permintaan melebihi batas waktu. Silakan coba lagi."
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                if (operationSeq == seq) {
                    error = humanizeError(failure)
                    handleSessionLossIfNeeded()
                }
            } finally {
                if (operationSeq == seq) {
                    busy = false
                    refreshing = false
                    operationCancellable = false
                }
            }
        }
    }

    private fun humanizeError(failure: Exception): String = when (failure) {
        is SocketTimeoutException -> "Permintaan melebihi batas waktu. Silakan coba lagi."
        is java.io.IOException -> "Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi."
        else -> failure.message ?: "Terjadi kesalahan. Silakan coba lagi."
    }

    private fun handleSessionLossIfNeeded() {
        if (!identity.signedIn) {
            signedIn = false
            app.push.localLogout()
            cleanupCaptures()
            clearAccountData()
            backStack.clear()
            page = Page.HOME
        }
    }

    fun showError(message: String) {
        error = message
    }

    fun dismissError() {
        error = null
    }

    fun dismissNotice() {
        notice = null
    }

    fun showNotice(message: String) {
        notice = message
    }

    fun dismissAttendanceSuccess() {
        pendingAttendanceSuccess = null
    }

    fun clearAttendanceSubmitError() {
        attendanceSubmitError = null
        attendanceOutcomeUncertain = false
    }

    fun updateTheme(value: String) {
        theme = value
        app.preferences.edit().putString("theme", value).apply()
    }

    fun updateNotificationPrefs(prefs: NotificationChannelPrefs) {
        notificationPrefs = prefs
        app.push.saveChannelPrefs(prefs)
    }

    fun selectDate(value: LocalDate) {
        selectedDate = value
    }

    fun login(start: (Intent) -> Unit) = run {
        start(identity.loginIntent())
    }

    fun completeLogin(intent: Intent?) = run {
        check(intent != null) { "Login dibatalkan. Silakan coba lagi." }
        identity.completeLogin(intent)
        clearAccountData()
        backStack.clear()
        signedIn = true
        page = if (identity.mustChangePassword) Page.PASSWORD else Page.HOME
        loadProfileAndDashboard()
    }

    fun logout(start: (Intent) -> Unit) = run {
        // Unregister before clearing identity so another user never inherits this device token.
        if (app.push.registeredForCurrentUser()) {
            try {
                app.push.disable()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                notice = "Keluar berhasil. Token notifikasi lama akan diganti sebelum notifikasi diaktifkan kembali."
            }
        }
        val intent = identity.logoutIntent()
        identity.clear()
        app.push.localLogout()
        cleanupCaptures()
        clearAccountData()
        backStack.clear()
        signedIn = false
        notificationsEnabled = false
        page = Page.HOME
        if (intent != null) start(intent)
    }

    fun refresh(asPullRefresh: Boolean = false) {
        if (!signedIn) return
        if (asPullRefresh && refreshing) return
        when (page) {
            Page.HISTORY -> run(asPullRefresh, cancellable = true) { loadHistory() }
            Page.PERMITS, Page.LEAVE -> run(asPullRefresh, cancellable = true) { loadPermits() }
            Page.ACCOUNT -> run(asPullRefresh, cancellable = true) { loadAccountDetails() }
            Page.ENROLLMENT -> run(asPullRefresh, cancellable = true) { checkEnrollmentReadiness() }
            else -> run(asPullRefresh, cancellable = true) { loadProfileAndDashboard() }
        }
    }

    private suspend fun loadProfileAndDashboard() {
        val loadedProfile = UserProfile.fromJson(astra.get("/v1/mobile/profile"))
        profile = loadedProfile
        if (identity.mustChangePassword) {
            page = Page.PASSWORD
            return
        }
        if (loadedProfile.isApproved) {
            try {
                val loadedDashboard = DashboardData.fromJson(astra.get("/v1/mobile/dashboard"))
                dashboard = loadedDashboard
                dashboardError = null
                loadedDashboard.serverTimeNow?.let { serverNow ->
                    parseTimestampToInstant(serverNow)?.let { instant ->
                        serverOffsetMs = instant.toEpochMilli() - System.currentTimeMillis()
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                dashboardError = humanizeError(failure)
                handleSessionLossIfNeeded()
                if (failure is AstraError && failure.status == 403) {
                    profile = loadedProfile.copy(lifecycleStatus = "disabled")
                }
            }
            if (dashboardError == null) {
                runCatching { loadCurrentMonthSummary() }
                    .onFailure {
                        if (it is CancellationException) throw it
                        handleSessionLossIfNeeded()
                    }
            }
        }
        notificationsEnabled = try {
            app.push.reconcile()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            app.push.enabledForCurrentUser()
        }
    }

    private suspend fun loadAccountDetails() {
        profile = UserProfile.fromJson(astra.get("/v1/mobile/profile"))
        enrollmentStatus = EnrollmentStatusData.fromJson(astra.get("/v1/mobile/face/enrollment/status"))
    }

    fun navigate(target: Page, recordBack: Boolean = true) {
        if (criticalSubmissionInFlight || !cancelCancellableOperation()) return
        if (identity.mustChangePassword && signedIn && target != Page.PASSWORD) {
            page = Page.PASSWORD
            return
        }
        if (page in listOf(Page.ATTACHMENT, Page.AVATAR) && page != target) {
            captureGeneration++
        }
        if (page == Page.ENROLLMENT && target != Page.ENROLLMENT) {
            cleanupEnrollmentCaptures()
        }
        if (target != Page.ATTENDANCE &&
            (page == Page.ATTENDANCE || precheckState != PrecheckState.Idle)
        ) {
            attemptTracker.cancelActive()
            precheckState = PrecheckState.Idle
            attendanceSubmitError = null
            attendanceOutcomeUncertain = false
        }
        if (page == Page.LEAVE && target != Page.ATTACHMENT) {
            removeAttachment()
        }
        if (target in topLevelPages) {
            backStack.clear()
        } else if (recordBack && target != page && backStack.lastOrNull() != page) {
            backStack.add(page)
        }
        error = null
        page = target
        if (signedIn) {
            when (target) {
                Page.HOME -> run(cancellable = true) { loadProfileAndDashboard() }
                Page.HISTORY -> run(cancellable = true) { loadHistory() }
                Page.PERMITS, Page.LEAVE -> run(cancellable = true) { loadPermits() }
                Page.ACCOUNT -> run(cancellable = true) { loadAccountDetails() }
                else -> Unit
            }
        }
    }

    fun back() {
        if (criticalSubmissionInFlight || !cancelCancellableOperation()) return
        val fallback = when (page) {
            Page.ATTACHMENT -> Page.LEAVE
            Page.AVATAR -> Page.ACCOUNT
            Page.LEAVE -> Page.PERMITS
            Page.ATTENDANCE -> Page.HOME
            Page.PASSWORD, Page.ENROLLMENT -> Page.ACCOUNT
            Page.ACCOUNT, Page.NOTIFICATIONS -> Page.SETTINGS
            Page.HISTORY, Page.PERMITS, Page.SETTINGS -> Page.HOME
            else -> Page.HOME
        }
        val target = if (backStack.isNotEmpty()) backStack.removeAt(backStack.lastIndex) else fallback
        navigate(target, recordBack = false)
    }

    fun changeMonth(delta: Long) {
        selectMonth(month.plusMonths(delta))
    }

    fun selectMonth(value: YearMonth) {
        if (value > YearMonth.from(today) || criticalSubmissionInFlight || !cancelCancellableOperation()) return
        month = value
        records = emptyList()
        monthlyStats = null
        selectedDate = if (value == YearMonth.from(today)) today else value.atDay(1)
        run(cancellable = true) { loadHistory() }
    }

    private suspend fun loadHistory() {
        val mySeq = operationSeq
        historyLoading = true
        historyError = null
        try {
            val start = month.atDay(1)
            val end = month.atEndOfMonth()
            val attendanceRaw = astra.get(
                "/v1/mobile/attendance?startDate=$start&endDate=$end&start_date=$start&end_date=$end",
            ).optJSONArray("items")?.objects().orEmpty().map(RawAttendanceRecord::fromJson)
            val loadedPermits = astra.get("/v1/mobile/permits")
                .optJSONArray("items")?.objects().orEmpty().map(PermitRecord::fromJson)
            if (operationSeq != mySeq) return
            permits = loadedPermits
            val merged = buildMonthlyAttendanceHistory(attendanceRaw, loadedPermits, month)
            records = merged
            val computed = computeMonthlyStats(merged)
            monthlyStats = computed
            if (month == YearMonth.from(today)) {
                currentMonthStats = computed
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            if (operationSeq == mySeq) {
                historyError = humanizeError(failure)
                handleSessionLossIfNeeded()
            }
        } finally {
            if (operationSeq == mySeq) {
                historyLoading = false
            }
        }
    }

    private suspend fun loadCurrentMonthSummary() {
        val currentMonth = YearMonth.from(today)
        val start = currentMonth.atDay(1)
        val end = currentMonth.atEndOfMonth()
        val attendanceRaw = astra.get(
            "/v1/mobile/attendance?startDate=$start&endDate=$end&start_date=$start&end_date=$end",
        ).optJSONArray("items")?.objects().orEmpty().map(RawAttendanceRecord::fromJson)
        val loadedPermits = astra.get("/v1/mobile/permits")
            .optJSONArray("items")?.objects().orEmpty().map(PermitRecord::fromJson)
        val merged = buildMonthlyAttendanceHistory(attendanceRaw, loadedPermits, currentMonth)
        currentMonthStats = computeMonthlyStats(merged)
        if (month == currentMonth && records.isEmpty()) {
            records = merged
            monthlyStats = currentMonthStats
        }
    }

    private suspend fun loadPermits() {
        val mySeq = operationSeq
        permitsLoading = true
        permitsError = null
        try {
            val loadedPermits = astra.get("/v1/mobile/permits")
                .optJSONArray("items")?.objects().orEmpty().map(PermitRecord::fromJson)
            if (operationSeq != mySeq) return
            permits = loadedPermits
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            if (operationSeq == mySeq) {
                permitsError = humanizeError(failure)
                handleSessionLossIfNeeded()
            }
        } finally {
            if (operationSeq == mySeq) {
                permitsLoading = false
            }
        }
    }

    fun signup(nis: String, email: String, password: String, confirm: String) = run {
        check(nis.matches(Regex("[0-9]+"))) { "NIS harus berupa angka." }
        check(android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) { "Email tidak valid." }
        check(
            password.length >= 8 &&
                password.any { it.isUpperCase() } &&
                password.any { it.isLowerCase() } &&
                password.any { it.isDigit() },
        ) { "Password minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send(
            "/v1/auth/student/signup",
            json("nis" to nis.trim(), "email" to email.trim(), "password" to password),
            authenticated = false,
        )
        page = Page.HOME
        notice = "Pendaftaran berhasil dikirim dan menunggu persetujuan sekolah."
    }

    fun resetPassword(nis: String, code: String, password: String, confirm: String) = run {
        check(nis.isNotBlank() && code.isNotBlank()) { "NIS dan kode pemulihan wajib diisi." }
        check(password.length >= 8) { "Password minimal 8 karakter." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send(
            "/v1/auth/student/reset-password",
            json("nis" to nis.trim(), "code" to code.trim(), "new_password" to password),
            authenticated = false,
        )
        page = Page.HOME
        notice = "Password berhasil diperbarui. Silakan login kembali."
    }

    fun changePassword(current: String, password: String, confirm: String) = run {
        check(current.isNotBlank() && password.length >= 8) {
            "Isi password saat ini dan password baru minimal 8 karakter."
        }
        check(
            password.any { it.isUpperCase() } &&
                password.any { it.isLowerCase() } &&
                password.any { it.isDigit() },
        ) { "Password harus mengandung huruf besar, huruf kecil, dan angka." }
        check(current != password) { "Password baru harus berbeda dari password lama." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
        astra.send(
            "/v1/mobile/profile/password",
            json("current_password" to current, "new_password" to password),
            "PATCH",
        )
        identity.clear()
        app.push.localLogout()
        signedIn = false
        cleanupCaptures()
        clearAccountData()
        page = Page.HOME
        notice = "Password diperbarui. Silakan login kembali dengan password baru."
    }

    fun importImage(uri: Uri, avatar: Boolean) = run {
        val file = prepareImage(app, uri, if (avatar) 5L * 1024 * 1024 else 10L * 1024 * 1024)
        if (avatar) {
            try {
                uploadAvatar(file)
            } finally {
                file.delete()
            }
        } else {
            attachment?.delete()
            attachment = file
        }
    }

    private suspend fun uploadAvatar(file: File) {
        astra.upload("/v1/mobile/profile/avatar", files = listOf("file" to file), method = "PATCH", timeout = 45)
        profile = UserProfile.fromJson(astra.get("/v1/mobile/profile"))
        notice = "Foto profil diperbarui."
    }

    fun clearAvatar() = run {
        astra.send("/v1/mobile/profile/avatar", json("clear" to true), "PATCH")
        profile = UserProfile.fromJson(astra.get("/v1/mobile/profile"))
        notice = "Foto profil dihapus."
    }

    fun removeAttachment() {
        attachment?.delete()
        attachment = null
    }

    fun submitLeave() = run {
        criticalSubmissionInFlight = true
        try {
            val description = leaveDescription.trim()
            check(description.length in 10..500) { "Keterangan harus 10–500 karakter." }
            val photo = attachment ?: error("Lampirkan foto bukti izin terlebih dahulu.")
            loadPermits()
            val todayStr = today.toString()
            val forToday = permits.filter { it.date.startsWith(todayStr) }
            check(forToday.none { it.approvalStatus == "pending" }) {
                "Pengajuan hari ini masih menunggu persetujuan."
            }
            check(forToday.none { it.approvalStatus == "approved" }) {
                "Izin hari ini sudah disetujui."
            }
            check(forToday.size < 3) {
                "Batas maksimal 3 pengajuan per hari telah tercapai."
            }
            astra.upload(
                "/v1/mobile/permits",
                fields = mapOf("category" to leaveCategory, "description" to description, "date" to todayStr),
                files = listOf("attachment" to photo),
                timeout = 45,
            )
            removeAttachment()
            leaveDescription = ""
            backStack.clear()
            page = Page.PERMITS
            loadPermits()
            notice = "Pengajuan izin berhasil dikirim. Tunggu persetujuan sekolah."
        } finally {
            criticalSubmissionInFlight = false
        }
    }

    fun startAttendanceFlow() {
        if (criticalSubmissionInFlight || !cancelCancellableOperation()) return
        if (!approved) {
            showError("Akun belum disetujui untuk melakukan presensi.")
            return
        }
        runAttendancePrecheck()
    }

    fun cancelAttendancePrecheck() {
        if (precheckState is PrecheckState.Checking) {
            cancelCancellableOperation()
        }
        attemptTracker.cancelActive()
        precheckState = PrecheckState.Idle
    }

    fun dismissPrecheckFeedback() {
        if (precheckState is PrecheckState.Blocked || precheckState is PrecheckState.Failed) {
            attemptTracker.cancelActive()
            precheckState = PrecheckState.Idle
        }
    }

    fun runAttendancePrecheck() {
        if (criticalSubmissionInFlight || !cancelCancellableOperation()) return
        precheckState = PrecheckState.Checking
        error = null
        busy = true
        operationCancellable = true
        val seq = ++operationSeq
        operation = viewModelScope.launch {
            try {
                check(approved) { "Akun belum disetujui untuk melakukan presensi." }
                val location = currentLocation(app)
                val response = astra.send(
                    "/v1/mobile/attendance/precheck",
                    json("latitude" to location.latitude, "longitude" to location.longitude),
                ) as JSONObject
                if (operationSeq != seq) return@launch
                val precheck = AttendancePrecheckResult.fromJson(response) { lateDeadlineRaw ->
                    val deadline = parseTimestampToInstant(lateDeadlineRaw)
                    deadline != null && syncedNow.isAfter(deadline)
                }
                if (!precheck.allowed) {
                    attemptTracker.cancelActive()
                    precheckState = PrecheckState.Blocked(precheck.message, precheck)
                } else {
                    val created = attemptTracker.createAttempt(
                        userId = identity.userId,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        precheck = precheck,
                    )
                    if (created != null) {
                        precheckState = PrecheckState.Ready(created)
                        attendanceSubmitError = null
                        attendanceOutcomeUncertain = false
                        if (page != Page.ATTENDANCE) {
                            if (backStack.lastOrNull() != page) backStack.add(page)
                            page = Page.ATTENDANCE
                        }
                    } else {
                        precheckState = PrecheckState.Blocked("Tindakan presensi tidak valid.", precheck)
                    }
                }
            } catch (_: TimeoutCancellationException) {
                if (operationSeq == seq) {
                    attemptTracker.cancelActive()
                    precheckState = PrecheckState.Failed("Pemeriksaan lokasi dan jadwal melebihi batas waktu. Coba lagi.")
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                if (operationSeq == seq) {
                    attemptTracker.cancelActive()
                    precheckState = PrecheckState.Failed(humanizeError(failure))
                    handleSessionLossIfNeeded()
                }
            } finally {
                if (operationSeq == seq) {
                    busy = false
                    operationCancellable = false
                }
            }
        }
    }

    fun startEnrollment() {
        val origin = page
        run(cancellable = true) {
            cleanupEnrollmentCaptures()
            checkEnrollmentReadiness()
            enrollmentStep = EnrollmentStep.CAPTURE
            if (origin != Page.ENROLLMENT && backStack.lastOrNull() != origin) {
                backStack.add(origin)
            }
            page = Page.ENROLLMENT
        }
    }

    fun undoLastEnrollmentPhoto() {
        if (busy || photos.isEmpty() || enrollmentStep != EnrollmentStep.CAPTURE) return
        val last = photos.last()
        last.delete()
        photos = photos.dropLast(1)
    }

    private suspend fun checkEnrollmentReadiness() {
        val health = astra.request("/v1/mobile/health", authenticated = false) as JSONObject
        check(health.text("status") == "healthy") { "Server verifikasi belum siap. Silakan coba lagi." }
        enrollmentStatus = EnrollmentStatusData.fromJson(astra.get("/v1/mobile/face/enrollment/status"))
    }

    fun captured(raw: File, ownerGeneration: Int, purpose: Page) {
        if (busy || ownerGeneration != captureGeneration || purpose != page) {
            raw.delete()
            return
        }
        run {
            val max = if (purpose == Page.ENROLLMENT) 2L * 1024 * 1024 else 5L * 1024 * 1024
            val file = try {
                prepareImage(app, Uri.fromFile(raw), max)
            } finally {
                raw.delete()
            }
            when (purpose) {
                Page.ENROLLMENT -> {
                    if (photos.size >= 10) {
                        file.delete()
                    } else {
                        val updated = photos + file
                        photos = updated
                        if (updated.size == 10) {
                            enrollmentStep = EnrollmentStep.CONFIRM
                        }
                    }
                }
                Page.ATTACHMENT -> {
                    attachment?.delete()
                    attachment = file
                    if (backStack.lastOrNull() == Page.LEAVE) backStack.removeAt(backStack.lastIndex)
                    page = Page.LEAVE
                }
                Page.AVATAR -> {
                    try {
                        uploadAvatar(file)
                        if (backStack.lastOrNull() == Page.ACCOUNT) backStack.removeAt(backStack.lastIndex)
                        page = Page.ACCOUNT
                    } finally {
                        file.delete()
                    }
                }
                Page.ATTENDANCE -> {
                    submitAttendancePhoto(file)
                }
                else -> file.delete()
            }
        }
    }

    private suspend fun submitAttendancePhoto(file: File) {
        val (attempt, validationError) = attemptTracker.validateForSubmit(identity.userId)
        if (attempt == null) {
            file.delete()
            attendanceSubmitError = validationError ?: "Sesi presensi tidak valid."
            attendanceOutcomeUncertain = false
            return
        }

        attemptTracker.markSubmitting(attempt)
        criticalSubmissionInFlight = true
        attendanceSubmitError = null
        attendanceOutcomeUncertain = false
        try {
            val encoded = withContext(Dispatchers.IO) {
                Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
            }
            val rawResult = astra.send(
                "/v1/mobile/attendance/submit",
                json(
                    "action_type" to attempt.actionType,
                    "image_base64" to encoded,
                    "latitude" to attempt.latitude,
                    "longitude" to attempt.longitude,
                ),
                timeout = 45,
            ) as JSONObject
            val result = AttendanceSubmitResult.fromJson(rawResult)
            attemptTracker.markSubmitted(attempt)
            pendingAttendanceSuccess = PendingAttendanceSuccess(
                attendanceType = result.attendanceType,
                statusLabel = result.statusLabel,
                processingTimeMs = result.processedMs,
                quote = MotivationalQuotes.random(),
            )
            backStack.clear()
            page = Page.HOME
            loadProfileAndDashboard()
        } catch (cancelled: CancellationException) {
            attemptTracker.cancelActive()
            throw cancelled
        } catch (astraError: AstraError) {
            when {
                astraError.code == "ATTENDANCE_BLOCKED" || astraError.status == 409 -> {
                    attemptTracker.cancelActive()
                    attendanceSubmitError = astraError.message ?: "Presensi diblokir oleh server."
                    attendanceOutcomeUncertain = false
                }
                astraError.status == 413 || (astraError.status in 400..499 && astraError.status != 408) -> {
                    attemptTracker.markRetryable(attempt)
                    attendanceSubmitError = astraError.message ?: "Foto tidak diterima server. Silakan ambil ulang."
                    attendanceOutcomeUncertain = false
                }
                else -> {
                    attemptTracker.markUncertain(attempt)
                    attendanceOutcomeUncertain = true
                    attendanceSubmitError = "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi."
                }
            }
        } catch (_: TimeoutCancellationException) {
            attemptTracker.markUncertain(attempt)
            attendanceOutcomeUncertain = true
            attendanceSubmitError = "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi."
        } catch (_: Exception) {
            attemptTracker.markUncertain(attempt)
            attendanceOutcomeUncertain = true
            attendanceSubmitError = "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi."
            handleSessionLossIfNeeded()
        } finally {
            criticalSubmissionInFlight = false
            file.delete()
        }
    }

    fun retakeEnrollment() {
        photos.forEach { it.delete() }
        photos = emptyList()
        enrollmentResult = null
        enrollmentError = null
        enrollmentStep = EnrollmentStep.CAPTURE
    }

    fun submitEnrollment() {
        if (criticalSubmissionInFlight || !cancelCancellableOperation()) return
        val currentPhotos = photos
        if (currentPhotos.size != 10) {
            showError("Ambil tepat 10 foto wajah.")
            return
        }
        if (!currentPhotos.all { it.exists() && it.length() in 1..(2L * 1024 * 1024) }) {
            showError("Ada foto tidak valid. Ambil ulang foto.")
            return
        }
        busy = true
        criticalSubmissionInFlight = true
        operationCancellable = false
        error = null
        enrollmentError = null
        val seq = ++operationSeq
        operation = viewModelScope.launch {
            var postStarted = false
            try {
                // INV-MOBILE-005: Recheck service readiness before multipart upload.
                checkEnrollmentReadiness()
                enrollmentStep = EnrollmentStep.UPLOADING
                postStarted = true
                val raw = astra.upload(
                    "/v1/mobile/face/enrollment",
                    files = currentPhotos.map { "files" to it },
                    timeout = 60,
                ) as JSONObject
                enrollmentResult = EnrollmentSubmitResult.fromJson(raw)
                enrollmentStep = EnrollmentStep.SUCCESS
                cleanupEnrollmentCapturesOnlyFiles()
                loadProfileAndDashboard()
            } catch (cancelled: CancellationException) {
                cleanupEnrollmentCapturesOnlyFiles()
                if (postStarted) {
                    enrollmentStep = EnrollmentStep.UNKNOWN_OUTCOME
                    enrollmentError = "Proses pendaftaran dibatalkan setelah pengiriman dimulai. Periksa status pendaftaran wajah."
                }
                throw cancelled
            } catch (failure: Exception) {
                if (!postStarted) {
                    enrollmentStep = EnrollmentStep.CONFIRM
                    error = humanizeError(failure)
                } else {
                    cleanupEnrollmentCapturesOnlyFiles()
                    enrollmentStep = EnrollmentStep.UNKNOWN_OUTCOME
                    enrollmentError = humanizeError(failure)
                }
                handleSessionLossIfNeeded()
            } finally {
                if (operationSeq == seq) {
                    busy = false
                    criticalSubmissionInFlight = false
                    operationCancellable = false
                }
            }
        }
    }

    fun checkEnrollmentStatusAfterUnknown() = run(cancellable = true) {
        enrollmentStatus = EnrollmentStatusData.fromJson(astra.get("/v1/mobile/face/enrollment/status"))
        if (enrollmentStatus?.isEnrolled == true) {
            loadProfileAndDashboard()
        }
    }

    fun finishEnrollment() {
        cleanupEnrollmentCaptures()
        backStack.clear()
        page = Page.HOME
        refresh()
    }

    fun enableNotifications() = run {
        app.push.enable()
        notificationsEnabled = true
    }

    fun disableNotifications() = run {
        app.push.disable()
        notificationsEnabled = false
    }

    private fun cleanupEnrollmentCapturesOnlyFiles() {
        photos.forEach { it.delete() }
        photos = emptyList()
    }

    private fun cleanupEnrollmentCaptures() {
        cleanupEnrollmentCapturesOnlyFiles()
        enrollmentResult = null
        enrollmentError = null
        enrollmentStep = EnrollmentStep.CAPTURE
    }

    private fun cleanupCaptures() {
        captureGeneration++
        attemptTracker.cancelActive()
        cleanupEnrollmentCaptures()
        removeAttachment()
    }

    private fun clearAccountData() {
        dashboard = null
        dashboardError = null
        profile = null
        records = emptyList()
        monthlyStats = null
        currentMonthStats = null
        historyError = null
        permits = emptyList()
        permitsError = null
        enrollmentStatus = null
        notificationsEnabled = false
        serverOffsetMs = 0L
        precheckState = PrecheckState.Idle
        pendingAttendanceSuccess = null
        attendanceSubmitError = null
        attendanceOutcomeUncertain = false
    }

    override fun onCleared() {
        cleanupCaptures()
        super.onCleared()
    }
}
