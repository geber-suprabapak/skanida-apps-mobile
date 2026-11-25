package id.skanida.nativeapp.domain.workflow

import androidx.compose.runtime.Immutable
import id.skanida.nativeapp.data.model.AttendancePrecheckResult

enum class AbsenceStatusTone {
    LOADING,
    SUCCESS,
    WARNING,
    ERROR,
    INFO,
}

enum class AbsenceStatusIcon {
    LOADER,
    CHECK_CIRCLE,
    CLOCK,
    MAP_PIN_OFF,
    HELP_CIRCLE,
}

@Immutable
data class AbsenceStatusMeta(val icon: AbsenceStatusIcon, val tone: AbsenceStatusTone, val message: String)

fun resolveAbsenceStatusMeta(isLoading: Boolean, errorMessage: String?, precheck: AttendancePrecheckResult?): AbsenceStatusMeta {
    if (isLoading) {
        return AbsenceStatusMeta(
            icon = AbsenceStatusIcon.LOADER,
            tone = AbsenceStatusTone.INFO,
            message = "Memeriksa status lokasi dan jadwal...",
        )
    }
    if (!errorMessage.isNullOrBlank()) {
        return AbsenceStatusMeta(
            icon = AbsenceStatusIcon.MAP_PIN_OFF,
            tone = AbsenceStatusTone.ERROR,
            message = errorMessage,
        )
    }
    if (precheck != null && precheck.allowed) {
        return if (precheck.isLate) {
            AbsenceStatusMeta(
                icon = AbsenceStatusIcon.CLOCK,
                tone = AbsenceStatusTone.WARNING,
                message = precheck.message,
            )
        } else {
            AbsenceStatusMeta(
                icon = AbsenceStatusIcon.CHECK_CIRCLE,
                tone = AbsenceStatusTone.SUCCESS,
                message = precheck.message,
            )
        }
    }
    return AbsenceStatusMeta(
        icon = AbsenceStatusIcon.HELP_CIRCLE,
        tone = if (precheck != null && !precheck.allowed) AbsenceStatusTone.ERROR else AbsenceStatusTone.INFO,
        message = precheck?.message ?: "Status presensi tidak diketahui.",
    )
}

@Immutable
data class AttendanceAttempt(
    val id: String,
    val userId: String,
    val actionType: String,
    val latitude: Double,
    val longitude: Double,
    val createdAtMs: Long,
    val precheck: AttendancePrecheckResult,
    val generation: Int,
)

enum class AttemptState {
    READY,
    SUBMITTING,
    SUBMITTED,
    UNCERTAIN,
    CANCELLED,
}

@Immutable
sealed interface PrecheckState {
    data object Idle : PrecheckState
    data object Checking : PrecheckState
    data class Ready(val attempt: AttendanceAttempt) : PrecheckState
    data class Blocked(val message: String, val precheck: AttendancePrecheckResult? = null) : PrecheckState
    data class Failed(val message: String) : PrecheckState
}

@Immutable
data class PendingAttendanceSuccess(
    val attendanceType: String,
    val statusLabel: String,
    val processingTimeMs: Long,
    val quote: MotivationalQuote,
)

class AttendanceAttemptTracker(private val ttlMs: Long = 600_000L, private val nowMs: () -> Long = { System.currentTimeMillis() }) {
    private var activeAttempt: AttendanceAttempt? = null
    private var activeState: AttemptState = AttemptState.CANCELLED
    private var generationCounter = 0

    fun current(): AttendanceAttempt? = activeAttempt

    fun createAttempt(userId: String, latitude: Double, longitude: Double, precheck: AttendancePrecheckResult): AttendanceAttempt? {
        if (userId.isBlank() || !precheck.allowed) return null
        val action = precheck.actionType ?: return null
        if (action !in ALLOWED_ACTIONS) return null
        if (!latitude.isFinite() || !longitude.isFinite()) return null
        cancelActive()
        generationCounter++
        val attempt = AttendanceAttempt(
            id = "att-${nowMs()}-$generationCounter",
            userId = userId,
            actionType = action,
            latitude = latitude,
            longitude = longitude,
            createdAtMs = nowMs(),
            precheck = precheck,
            generation = generationCounter,
        )
        activeAttempt = attempt
        activeState = AttemptState.READY
        return attempt
    }

    fun validateForSubmit(currentUserId: String): Pair<AttendanceAttempt?, String?> {
        val current = activeAttempt
            ?: return null to "Sesi presensi tidak ditemukan. Mulai lagi dari beranda."
        if (activeState == AttemptState.CANCELLED) {
            return null to "Sesi presensi telah dibatalkan. Silakan periksa ulang status."
        }
        if (activeState == AttemptState.UNCERTAIN) {
            return null to "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi."
        }
        if (activeState == AttemptState.SUBMITTED) {
            return null to "Presensi untuk sesi ini sudah berhasil dikirim."
        }
        if (current.userId != currentUserId || nowMs() - current.createdAtMs >= ttlMs) {
            cancelActive()
            return null to "Sesi presensi kedaluwarsa. Kembali ke beranda dan coba lagi."
        }
        return current to null
    }

    fun markSubmitting(attempt: AttendanceAttempt) {
        if (activeAttempt === attempt) activeState = AttemptState.SUBMITTING
    }

    fun markSubmitted(attempt: AttendanceAttempt) {
        if (activeAttempt === attempt) {
            activeState = AttemptState.SUBMITTED
            activeAttempt = null
        }
    }

    fun markRetryable(attempt: AttendanceAttempt) {
        if (activeAttempt === attempt && activeState == AttemptState.SUBMITTING) {
            activeState = AttemptState.READY
        }
    }

    fun markUncertain(attempt: AttendanceAttempt) {
        if (activeAttempt === attempt) {
            activeState = AttemptState.UNCERTAIN
        }
    }

    fun cancelActive() {
        if (activeAttempt != null && activeState != AttemptState.SUBMITTED) {
            activeState = AttemptState.CANCELLED
        }
        activeAttempt = null
    }

    private companion object {
        val ALLOWED_ACTIONS = setOf("check_in", "check_out")
    }
}
