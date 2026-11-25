package id.skanida.nativeapp.domain.workflow

import androidx.compose.runtime.Immutable
import id.skanida.nativeapp.data.model.DashboardAttendance
import id.skanida.nativeapp.data.model.DashboardSchedule
import id.skanida.nativeapp.data.model.MonthlyAttendanceStats
import java.time.Instant
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

private val SCHEDULE_HM_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", ID_LOCALE)
private val PERMIT_KEYWORDS = listOf("permit", "izin", "perizinan", "cuti", "sakit", "leave")
private val CHECKOUT_KEYWORDS = listOf("check_out", "checkout", "pulang")
private val CHECKIN_KEYWORDS = listOf("check_in", "checkin", "masuk", "pagi")
private val WHITESPACE_REGEX = Regex("\\s+")

@Immutable
data class ScheduleTimelineState(
    val progress: Float,
    val statusText: String,
    val startLabel: String,
    val endLabel: String,
    val isCompleted: Boolean,
)

@Immutable
data class MonthlyAttendanceSummary(val attendedDays: Int, val effectiveDays: Int, val rate: Float, val percent: Int)

@Immutable
data class NotificationChannelPrefs(val checkIn: Boolean = true, val checkOut: Boolean = true, val permitUpdates: Boolean = true)

enum class NotificationCategory {
    CHECK_IN,
    CHECK_OUT,
    PERMIT,
    GENERAL,
}

fun computeScheduleTimeline(schedule: DashboardSchedule?, attendance: DashboardAttendance?, nowInstant: Instant): ScheduleTimelineState {
    if (schedule == null) {
        val done = attendance?.hasCheckedOut == true
        return ScheduleTimelineState(
            progress = if (done) 1f else 0f,
            statusText = if (done) "Sesi hari ini selesai" else "Tidak ada jadwal hari ini",
            startLabel = "--:--",
            endLabel = "--:--",
            isCompleted = done,
        )
    }

    val startIn = parseScheduleLocalTime(schedule.startCheckInAt) ?: LocalTime.of(6, 30)
    val endIn = parseScheduleLocalTime(schedule.endCheckInAt) ?: LocalTime.of(7, 0)
    val startOut = parseScheduleLocalTime(schedule.startCheckOutAt) ?: LocalTime.of(15, 0)
    val startLabel = startIn.format(SCHEDULE_HM_FORMATTER)
    val endLabel = startOut.format(SCHEDULE_HM_FORMATTER)

    if (attendance?.hasCheckedOut == true) {
        return ScheduleTimelineState(
            progress = 1f,
            statusText = "Sesi hari ini selesai",
            startLabel = startLabel,
            endLabel = endLabel,
            isCompleted = true,
        )
    }

    val nowTime = nowInstant.atZone(WIB).toLocalTime()
    val totalMinutes = ChronoUnit.MINUTES.between(startIn, startOut).coerceAtLeast(1L)
    val elapsedMinutes = ChronoUnit.MINUTES.between(startIn, nowTime)
    val remainingToOut = ChronoUnit.MINUTES.between(nowTime, startOut)

    val progress = when {
        nowTime.isBefore(startIn) -> 0.08f
        !nowTime.isBefore(startOut) -> 0.94f
        else -> (elapsedMinutes.toFloat() / totalMinutes.toFloat()).coerceIn(0.10f, 0.94f)
    }

    val statusText = when {
        attendance?.hasCheckedIn == true && remainingToOut > 0 ->
            "Tersisa ${formatDurationMinutes(remainingToOut)} ke pulang"
        attendance?.hasCheckedIn == true ->
            "Sesi pulang sudah dibuka"
        nowTime.isBefore(endIn) ->
            "Jadwal masuk $startLabel–${endIn.format(SCHEDULE_HM_FORMATTER)}"
        !nowTime.isBefore(startOut) ->
            "Sesi pulang $endLabel WIB"
        else ->
            "Masuk $startLabel–${endIn.format(SCHEDULE_HM_FORMATTER)} WIB"
    }

    return ScheduleTimelineState(
        progress = progress,
        statusText = statusText,
        startLabel = startLabel,
        endLabel = endLabel,
        isCompleted = false,
    )
}

fun formatDurationMinutes(minutes: Long): String {
    val safe = minutes.coerceAtLeast(0L)
    val hours = safe / 60L
    val rem = safe % 60L
    return when {
        hours == 0L -> "$rem mnt"
        rem == 0L -> "$hours jam"
        else -> "$hours j $rem mnt"
    }
}

fun computeMonthlyAttendanceSummary(stats: MonthlyAttendanceStats?): MonthlyAttendanceSummary {
    if (stats == null) {
        return MonthlyAttendanceSummary(attendedDays = 0, effectiveDays = 0, rate = 0f, percent = 0)
    }
    val attended = stats.hadir + stats.terlambat
    val effective = attended + stats.sakit + stats.izin + stats.alpha
    if (effective <= 0) {
        return MonthlyAttendanceSummary(attendedDays = 0, effectiveDays = 0, rate = 0f, percent = 0)
    }
    val rate = (attended.toFloat() / effective.toFloat()).coerceIn(0f, 1f)
    return MonthlyAttendanceSummary(
        attendedDays = attended,
        effectiveDays = effective,
        rate = rate,
        percent = (rate * 100f).roundToInt(),
    )
}

fun classifyNotification(type: String?, title: String?, body: String?): NotificationCategory {
    val combined = listOfNotNull(type, title, body).joinToString(" ").lowercase(ID_LOCALE)
    return when {
        PERMIT_KEYWORDS.any { it in combined } -> NotificationCategory.PERMIT
        CHECKOUT_KEYWORDS.any { it in combined } -> NotificationCategory.CHECK_OUT
        CHECKIN_KEYWORDS.any { it in combined } -> NotificationCategory.CHECK_IN
        else -> NotificationCategory.GENERAL
    }
}

fun shouldDeliverNotification(prefs: NotificationChannelPrefs, type: String?, title: String?, body: String?): Boolean =
    when (classifyNotification(type, title, body)) {
        NotificationCategory.CHECK_IN -> prefs.checkIn
        NotificationCategory.CHECK_OUT -> prefs.checkOut
        NotificationCategory.PERMIT -> prefs.permitUpdates
        NotificationCategory.GENERAL -> true
    }

fun initialsFromName(fullName: String?): String {
    val parts = fullName.orEmpty().trim().split(WHITESPACE_REGEX).filter { it.isNotEmpty() }
    return when {
        parts.isEmpty() -> "S"
        parts.size == 1 -> parts.first().take(2).uppercase(ID_LOCALE)
        else -> "${parts.first().first()}${parts[1].first()}".uppercase(ID_LOCALE)
    }
}

fun firstNameFrom(fullName: String?): String = fullName.orEmpty().trim().substringBefore(" ").ifBlank { "Siswa" }
