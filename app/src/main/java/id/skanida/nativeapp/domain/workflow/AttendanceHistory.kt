package id.skanida.nativeapp.domain.workflow

import id.skanida.nativeapp.data.model.DailyAttendanceRecord
import id.skanida.nativeapp.data.model.MonthlyAttendanceStats
import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.data.model.RawAttendanceRecord
import java.time.LocalDate
import java.time.YearMonth

private val ABSENT_STATUSES = setOf("Alpha", "alpha", "absent", "alpa")
private val CHECK_IN_STATUSES = setOf("Hadir", "Terlambat", "present", "late")
private val CHECK_OUT_STATUSES = setOf("Pulang", "home")
private val LATE_STATUSES = setOf("Terlambat", "late")
private val LEAVE_STATUSES = setOf("leave", "sick", "izin", "sakit")

/**
 * Merges physical attendance records and approved leave permits for calendar & monthly history.
 * Preserves INV-MOBILE-007: only explicitly `approved` permits enter the attendance calendar,
 * expanding their effective period inclusively within the selected month range.
 */
fun buildMonthlyAttendanceHistory(
    attendances: List<RawAttendanceRecord>,
    permits: List<PermitRecord>,
    month: YearMonth? = null,
): List<DailyAttendanceRecord> {
    val rangeStart = month?.atDay(1)
    val rangeEnd = month?.atEndOfMonth()
    val days = linkedMapOf<String, DailyAttendanceRecord>()

    attendances
        .groupBy { formatDateKeyWib(it.date) }
        .forEach { (dateKey, records) ->
            if (dateKey.isBlank()) return@forEach
            val parsedDate = runCatching { LocalDate.parse(dateKey) }.getOrNull()
            if (rangeStart != null && rangeEnd != null && parsedDate != null) {
                if (parsedDate.isBefore(rangeStart) || parsedDate.isAfter(rangeEnd)) return@forEach
            }
            val first = records.first()
            val hasAbsent = records.any { it.status in ABSENT_STATUSES }
            val hasLeave = records.any { it.status in LEAVE_STATUSES }
            val checkIn = records.firstOrNull { it.status in CHECK_IN_STATUSES }
            val checkOut = records.firstOrNull {
                it.status in CHECK_OUT_STATUSES || it.actionType == "check_out"
            }
            val isLate = records.any { it.status in LATE_STATUSES }

            when {
                hasAbsent -> days[dateKey] = DailyAttendanceRecord(
                    id = first.id,
                    date = dateKey,
                    status = "absent",
                )
                hasLeave -> days[dateKey] = DailyAttendanceRecord(
                    id = first.id,
                    date = dateKey,
                    status = if (records.any { it.status == "sick" || it.status == "sakit" }) "sick" else "leave",
                )
                checkIn != null || checkOut != null -> days[dateKey] = DailyAttendanceRecord(
                    id = first.id,
                    date = dateKey,
                    status = if (isLate) "late" else "present",
                    checkInTime = checkIn?.createdAt,
                    checkOutTime = checkOut?.createdAt,
                    isLate = isLate,
                )
            }
        }

    // INV-MOBILE-007: Only explicitly approved leave requests enter the attendance calendar.
    permits
        .filter { it.approvalStatus == "approved" }
        .forEach { permit ->
            val startKey = formatDateKeyWib(permit.requestedStartDate.ifBlank { permit.date })
            val endKey = formatDateKeyWib(
                permit.effectiveEndDate?.takeIf { it.isNotBlank() }
                    ?: permit.originalEndDate?.takeIf { it.isNotBlank() }
                    ?: startKey,
            )
            val startDate = runCatching { LocalDate.parse(startKey) }.getOrNull() ?: return@forEach
            val endDate = runCatching { LocalDate.parse(endKey) }.getOrNull() ?: startDate
            val effectiveStart = if (rangeStart != null && startDate.isBefore(rangeStart)) rangeStart else startDate
            val effectiveEnd = if (rangeEnd != null && endDate.isAfter(rangeEnd)) rangeEnd else endDate
            if (effectiveStart.isAfter(effectiveEnd)) return@forEach

            val leaveStatus = if (permit.category.equals("sakit", ignoreCase = true)) "sick" else "leave"
            var cursor = effectiveStart
            while (!cursor.isAfter(effectiveEnd)) {
                val dateKey = cursor.toString()
                days[dateKey] = DailyAttendanceRecord(
                    id = permit.id,
                    date = dateKey,
                    status = leaveStatus,
                    leaveCategory = permit.category,
                    description = permit.description,
                    approvalStatus = permit.approvalStatus,
                )
                cursor = cursor.plusDays(1)
            }
        }

    return days.values.sortedByDescending { it.date }
}

fun computeMonthlyStats(records: List<DailyAttendanceRecord>): MonthlyAttendanceStats {
    var hadir = 0
    var terlambat = 0
    var sakit = 0
    var izin = 0
    var alpha = 0

    records.groupBy { it.date }.values.forEach { dayRecords ->
        val record = dayRecords.first()
        when (record.status) {
            "sick" -> sakit++
            "leave" -> izin++
            "late" -> terlambat++
            "present" -> if (record.isLate) terlambat++ else hadir++
            "absent" -> alpha++
        }
    }
    return MonthlyAttendanceStats(
        hadir = hadir,
        terlambat = terlambat,
        sakit = sakit,
        izin = izin,
        alpha = alpha,
    )
}
