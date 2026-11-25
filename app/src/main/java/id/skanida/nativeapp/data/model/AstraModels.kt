package id.skanida.nativeapp.data.model

import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.text(key: String, fallback: String = ""): String =
    if (isNull(key)) fallback else optString(key, fallback)

fun JSONObject.nullableText(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }

fun JSONArray.objects(): List<JSONObject> =
    (0 until length()).mapNotNull { optJSONObject(it) }

fun json(vararg values: Pair<String, Any?>): JSONObject =
    JSONObject().apply {
        values.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) }
    }

data class UserProfile(
    val userId: String,
    val fullName: String,
    val email: String,
    val nis: String,
    val className: String,
    val absenceNumber: String,
    val gender: String,
    val role: String,
    val avatarUrl: String?,
    val lifecycleStatus: String,
) {
    val isApproved: Boolean get() = lifecycleStatus == "approved"

    companion object {
        fun fromJson(obj: JSONObject): UserProfile {
            val avatar = obj.nullableText("avatar_url")?.trim()
                ?.takeIf { it.startsWith("http://") || it.startsWith("https://") }
            return UserProfile(
                userId = obj.text("user_id"),
                fullName = obj.text("full_name"),
                email = obj.text("email"),
                nis = obj.text("nis"),
                className = obj.text("class_name"),
                absenceNumber = obj.text("absence_number"),
                gender = obj.text("gender"),
                role = obj.text("role", "student"),
                avatarUrl = avatar,
                lifecycleStatus = obj.text("lifecycle_status", "approved"),
            )
        }
    }
}

data class DashboardAttendance(
    val todayStatus: String,
    val hasCheckedIn: Boolean,
    val hasCheckedOut: Boolean,
    val checkInTime: String?,
    val checkOutTime: String?,
    val totalWorkHours: Double?,
    val explicitCheckInStatus: String?,
) {
    companion object {
        fun fromJson(obj: JSONObject): DashboardAttendance = DashboardAttendance(
            todayStatus = obj.text("today_status", "pending"),
            hasCheckedIn = obj.optBoolean("has_checked_in", false),
            hasCheckedOut = obj.optBoolean("has_checked_out", false),
            checkInTime = obj.nullableText("check_in_time"),
            checkOutTime = obj.nullableText("check_out_time"),
            totalWorkHours = if (obj.isNull("total_work_hours")) null else obj.optDouble("total_work_hours"),
            explicitCheckInStatus = obj.nullableText("check_in_status"),
        )
    }
}

data class DashboardSchedule(
    val dayKey: String,
    val startCheckInAt: String?,
    val endCheckInAt: String?,
    val startCheckOutAt: String?,
    val endCheckOutAt: String?,
    val compensationMinutes: Int,
) {
    companion object {
        fun fromJson(obj: JSONObject?): DashboardSchedule? {
            if (obj == null) return null
            return DashboardSchedule(
                dayKey = obj.text("day_key"),
                startCheckInAt = obj.nullableText("start_check_in_at"),
                endCheckInAt = obj.nullableText("end_check_in_at"),
                startCheckOutAt = obj.nullableText("start_check_out_at"),
                endCheckOutAt = obj.nullableText("end_check_out_at"),
                compensationMinutes = obj.optInt("compensation_minutes", 0),
            )
        }
    }
}

data class DashboardFace(
    val serverStatus: String,
    val enrollmentStatus: String,
    val message: String,
) {
    val isServerHealthy: Boolean get() = serverStatus == "healthy"
    val isEnrolled: Boolean get() = enrollmentStatus == "enrolled"

    companion object {
        fun fromJson(obj: JSONObject?): DashboardFace = DashboardFace(
            serverStatus = obj?.text("server_status", "unhealthy") ?: "unhealthy",
            enrollmentStatus = obj?.text("enrollment_status", "not_enrolled") ?: "not_enrolled",
            message = obj?.text("message", "Layanan verifikasi belum siap.")
                ?: "Layanan verifikasi belum siap.",
        )
    }
}

data class DashboardPermitSummary(
    val hasActivePermit: Boolean,
    val activeCategory: String?,
) {
    companion object {
        fun fromJson(obj: JSONObject?): DashboardPermitSummary = DashboardPermitSummary(
            hasActivePermit = obj?.optBoolean("has_active_permit", false) ?: false,
            activeCategory = obj?.nullableText("active_category"),
        )
    }
}

data class DashboardPrimaryAction(
    val allowed: Boolean,
    val type: String?,
    val reasonCode: String?,
    val label: String,
    val reasonMessage: String?,
) {
    companion object {
        fun fromJson(obj: JSONObject?): DashboardPrimaryAction = DashboardPrimaryAction(
            allowed = obj?.optBoolean("allowed", false) ?: false,
            type = obj?.nullableText("type"),
            reasonCode = obj?.nullableText("reason_code"),
            label = obj?.text("label", "Presensi") ?: "Presensi",
            reasonMessage = obj?.nullableText("reason_message"),
        )
    }
}

data class DashboardData(
    val profile: UserProfile,
    val attendance: DashboardAttendance,
    val schedule: DashboardSchedule?,
    val face: DashboardFace,
    val permit: DashboardPermitSummary,
    val primaryAction: DashboardPrimaryAction,
    val serverTimeNow: String?,
) {
    companion object {
        fun fromJson(obj: JSONObject): DashboardData = DashboardData(
            profile = UserProfile.fromJson(obj.optJSONObject("profile") ?: JSONObject()),
            attendance = DashboardAttendance.fromJson(obj.optJSONObject("attendance") ?: JSONObject()),
            schedule = DashboardSchedule.fromJson(obj.optJSONObject("schedule")),
            face = DashboardFace.fromJson(obj.optJSONObject("face")),
            permit = DashboardPermitSummary.fromJson(obj.optJSONObject("permit")),
            primaryAction = DashboardPrimaryAction.fromJson(obj.optJSONObject("primary_action")),
            serverTimeNow = obj.optJSONObject("server_time")?.nullableText("now"),
        )
    }
}

data class AttendancePrecheckResult(
    val allowed: Boolean,
    val actionType: String?,
    val blockingReason: String?,
    val locationName: String?,
    val lateDeadline: String?,
    val isLate: Boolean,
    val message: String,
) {
    companion object {
        fun fromJson(obj: JSONObject, isPastLateDeadline: (String?) -> Boolean = { false }): AttendancePrecheckResult {
            val allowed = obj.optBoolean("allowed", false)
            val actionType = obj.nullableText("action_type")
            val blockingReason = obj.nullableText("blocking_reason")
            val locationName = obj.nullableText("location_name")
            val scheduleWindow = obj.optJSONObject("schedule_window")
            val lateDeadline = scheduleWindow?.nullableText("late_deadline")
            val detailStatus = obj.optJSONObject("details")?.nullableText("status")
            val isLate = allowed && actionType == "check_in" &&
                (detailStatus.equals("Terlambat", ignoreCase = true) || isPastLateDeadline(lateDeadline))
            val message = when {
                !allowed -> blockingReason ?: "Presensi belum dapat dilakukan."
                actionType == "check_out" -> "Silakan lanjut presensi pulang."
                isLate -> "Presensi masuk tercatat terlambat. Silakan lanjut verifikasi wajah."
                else -> "Silakan lanjut presensi masuk."
            }
            return AttendancePrecheckResult(
                allowed = allowed,
                actionType = actionType,
                blockingReason = blockingReason,
                locationName = locationName,
                lateDeadline = lateDeadline,
                isLate = isLate,
                message = message,
            )
        }
    }
}

data class AttendanceSubmitResult(
    val attendanceType: String,
    val statusLabel: String,
    val processedMs: Long,
) {
    companion object {
        fun fromJson(obj: JSONObject): AttendanceSubmitResult = AttendanceSubmitResult(
            attendanceType = obj.text("attendance_type", "check_in"),
            statusLabel = obj.text("status_label", "Hadir"),
            processedMs = obj.optLong("processed_ms", 0L),
        )
    }
}

data class RawAttendanceRecord(
    val id: String,
    val date: String,
    val status: String,
    val actionType: String?,
    val createdAt: String?,
) {
    companion object {
        fun fromJson(obj: JSONObject): RawAttendanceRecord = RawAttendanceRecord(
            id = obj.text("id"),
            date = obj.text("date"),
            status = obj.text("status"),
            actionType = obj.nullableText("action_type"),
            createdAt = obj.nullableText("created_at"),
        )
    }
}

data class DailyAttendanceRecord(
    val id: String,
    val date: String,
    val status: String, // "present", "late", "sick", "leave", "absent"
    val checkInTime: String? = null,
    val checkOutTime: String? = null,
    val isLate: Boolean = false,
    val leaveCategory: String? = null,
    val description: String? = null,
    val approvalStatus: String? = null,
)

data class MonthlyAttendanceStats(
    val hadir: Int,
    val terlambat: Int,
    val sakit: Int,
    val izin: Int,
    val alpha: Int,
)

data class PermitRecord(
    val id: String,
    val category: String,
    val description: String,
    val date: String,
    val requestedStartDate: String,
    val originalEndDate: String?,
    val effectiveEndDate: String?,
    val durationDays: Int?,
    val approvalStatus: String?,
    val attachmentUrl: String?,
    val createdAt: String,
    val rejectionReason: String?,
    val rejectedAt: String?,
) {
    val categoryLabel: String get() = formatPermitCategory(category)

    companion object {
        fun fromJson(obj: JSONObject): PermitRecord {
            val status = obj.nullableText("approval_status")
            val baseDate = obj.text("date")
            return PermitRecord(
                id = obj.text("id"),
                category = obj.text("category", "izin"),
                description = obj.text("description"),
                date = baseDate,
                requestedStartDate = obj.nullableText("requested_start_date") ?: baseDate,
                originalEndDate = obj.nullableText("original_end_date")
                    ?: if (status == "approved") baseDate else null,
                effectiveEndDate = obj.nullableText("effective_end_date")
                    ?: if (status == "approved") baseDate else null,
                durationDays = if (obj.isNull("duration_days")) {
                    if (status == "approved") 1 else null
                } else obj.optInt("duration_days"),
                approvalStatus = status,
                attachmentUrl = obj.nullableText("attachment_url")?.trim()
                    ?.takeIf { it.startsWith("http://") || it.startsWith("https://") },
                createdAt = obj.nullableText("created_at") ?: baseDate,
                rejectionReason = obj.nullableText("rejection_reason"),
                rejectedAt = obj.nullableText("rejected_at"),
            )
        }
    }
}

fun formatPermitCategory(category: String?): String = when (category?.lowercase()) {
    "sakit" -> "Sakit"
    "pergi" -> "Izin (Pergi)"
    "dispensasi" -> "Dispensasi"
    "lainnya" -> "Izin (Lainnya)"
    "cuti" -> "Cuti"
    else -> "Izin"
}

fun formatGender(raw: String?): String = when (raw?.trim()?.lowercase()) {
    "l", "m", "male", "laki-laki", "laki laki" -> "Laki-laki"
    "p", "f", "female", "perempuan" -> "Perempuan"
    null, "" -> "—"
    else -> raw.trim()
}

fun localizePrimaryActionReason(reasonCode: String?, rawMessage: String?): String? {
    val normalizedCode = reasonCode?.trim()?.lowercase()
    when (normalizedCode) {
        "face_not_enrolled", "enrollment_required" ->
            return "Daftarkan wajah terlebih dahulu sebelum melakukan presensi."
        "face_server_unhealthy", "service_unavailable" ->
            return "Layanan verifikasi wajah sedang tidak tersedia. Coba beberapa saat lagi."
        "already_completed", "attendance_completed" ->
            return "Presensi masuk dan pulang hari ini sudah tercatat."
        "active_permit", "on_leave", "approved_permit" ->
            return "Kamu tercatat izin hari ini, sehingga tidak perlu melakukan presensi."
        "outside_schedule", "outside_window", "not_within_schedule" ->
            return "Saat ini di luar jam presensi yang dijadwalkan."
        "no_schedule", "holiday", "weekend" ->
            return "Tidak ada jadwal presensi hari ini."
        "account_not_approved", "lifecycle_blocked" ->
            return "Akunmu belum disetujui untuk melakukan presensi."
    }
    val msg = rawMessage?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val lower = msg.lowercase()
    return when {
        "face enrollment is required" in lower || "enroll your face" in lower ->
            "Daftarkan wajah terlebih dahulu sebelum melakukan presensi."
        "already checked out" in lower || "attendance completed" in lower ->
            "Presensi hari ini sudah selesai."
        "outside" in lower && "schedule" in lower ->
            "Saat ini di luar jam presensi yang dijadwalkan."
        "no schedule" in lower ->
            "Tidak ada jadwal presensi hari ini."
        "active permit" in lower || "approved leave" in lower ->
            "Kamu tercatat izin hari ini, sehingga tidak perlu melakukan presensi."
        "server" in lower && ("unhealthy" in lower || "unavailable" in lower) ->
            "Layanan verifikasi wajah sedang tidak tersedia. Coba beberapa saat lagi."
        else -> msg
    }
}

data class EnrollmentStatusData(
    val status: String,
    val embeddingCount: Int,
    val message: String,
) {
    val isEnrolled: Boolean get() = status == "enrolled"

    companion object {
        fun fromJson(obj: JSONObject): EnrollmentStatusData = EnrollmentStatusData(
            status = obj.text("status", "not_enrolled"),
            embeddingCount = obj.optInt("embeddingCount", 0),
            message = obj.text("message"),
        )
    }
}

data class EnrollmentSubmitResult(
    val imagesProcessed: Int,
    val imagesFailed: Int,
    val totalEmbeddings: Int,
) {
    companion object {
        fun fromJson(obj: JSONObject): EnrollmentSubmitResult = EnrollmentSubmitResult(
            imagesProcessed = obj.optInt("imagesProcessed", 0),
            imagesFailed = obj.optInt("imagesFailed", 0),
            totalEmbeddings = obj.optInt("totalEmbeddings", 0),
        )
    }
}
