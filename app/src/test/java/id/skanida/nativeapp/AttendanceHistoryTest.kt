package id.skanida.nativeapp

import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.data.model.RawAttendanceRecord
import id.skanida.nativeapp.domain.workflow.buildMonthlyAttendanceHistory
import id.skanida.nativeapp.domain.workflow.computeMonthlyStats
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AttendanceHistoryTest {
    @Test
    fun lateCheckInAndCheckoutBecomeOneDay() {
        val result = buildMonthlyAttendanceHistory(
            attendances = listOf(
                RawAttendanceRecord(
                    id = "1",
                    date = "2026-10-13",
                    status = "Pulang",
                    actionType = "check_out",
                    createdAt = "2026-10-13T08:00:00Z",
                ),
                RawAttendanceRecord(
                    id = "2",
                    date = "2026-10-13",
                    status = "Terlambat",
                    actionType = "check_in",
                    createdAt = "2026-10-13T01:00:00Z",
                ),
            ),
            permits = emptyList(),
            month = YearMonth.of(2026, 10),
        ).single()

        assertEquals("late", result.status)
        assertTrue(result.isLate)
        assertEquals("2026-10-13T01:00:00Z", result.checkInTime)
        assertEquals("2026-10-13T08:00:00Z", result.checkOutTime)
    }

    @Test
    fun pendingAndRejectedLeaveAreExcludedFromCalendarAndStats() {
        val result = buildMonthlyAttendanceHistory(
            attendances = emptyList(),
            permits = listOf(
                PermitRecord(
                    id = "p1",
                    category = "pergi",
                    description = "Pergi",
                    date = "2026-10-12",
                    requestedStartDate = "2026-10-12",
                    originalEndDate = null,
                    effectiveEndDate = null,
                    durationDays = null,
                    approvalStatus = "rejected",
                    attachmentUrl = null,
                    createdAt = "2026-10-12T01:00:00Z",
                    rejectionReason = "Tidak valid",
                    rejectedAt = null,
                ),
                PermitRecord(
                    id = "p2",
                    category = "sakit",
                    description = "Sakit demam",
                    date = "2026-10-13",
                    requestedStartDate = "2026-10-13",
                    originalEndDate = null,
                    effectiveEndDate = null,
                    durationDays = null,
                    approvalStatus = "pending",
                    attachmentUrl = null,
                    createdAt = "2026-10-13T01:00:00Z",
                    rejectionReason = null,
                    rejectedAt = null,
                ),
            ),
            month = YearMonth.of(2026, 10),
        )

        assertTrue(result.isEmpty())
        val stats = computeMonthlyStats(result)
        assertEquals(0, stats.sakit)
        assertEquals(0, stats.izin)
    }

    @Test
    fun approvedLeaveExpandsInclusivelyWithinSelectedMonth() {
        val result = buildMonthlyAttendanceHistory(
            attendances = emptyList(),
            permits = listOf(
                PermitRecord(
                    id = "p3",
                    category = "sakit",
                    description = "Rawat inap",
                    date = "2026-10-29",
                    requestedStartDate = "2026-10-29",
                    originalEndDate = "2026-11-02",
                    effectiveEndDate = "2026-11-02",
                    durationDays = 5,
                    approvalStatus = "approved",
                    attachmentUrl = null,
                    createdAt = "2026-10-29T01:00:00Z",
                    rejectionReason = null,
                    rejectedAt = null,
                ),
            ),
            month = YearMonth.of(2026, 10),
        )

        assertEquals(listOf("2026-10-31", "2026-10-30", "2026-10-29"), result.map { it.date })
        assertTrue(result.all { it.status == "sick" })
        val stats = computeMonthlyStats(result)
        assertEquals(3, stats.sakit)
    }

    @Test
    fun computeMonthlyStatsCountsAllCategories() {
        val records = buildMonthlyAttendanceHistory(
            attendances = listOf(
                RawAttendanceRecord("1", "2026-11-02", "Hadir", "check_in", "2026-11-02T00:00:00Z"),
                RawAttendanceRecord("2", "2026-11-03", "Terlambat", "check_in", "2026-11-03T01:00:00Z"),
                RawAttendanceRecord("3", "2026-11-04", "absent", null, null),
            ),
            permits = listOf(
                PermitRecord(
                    id = "p4",
                    category = "pergi",
                    description = "Acara keluarga",
                    date = "2026-11-05",
                    requestedStartDate = "2026-11-05",
                    originalEndDate = "2026-11-05",
                    effectiveEndDate = "2026-11-05",
                    durationDays = 1,
                    approvalStatus = "approved",
                    attachmentUrl = null,
                    createdAt = "2026-11-05T00:00:00Z",
                    rejectionReason = null,
                    rejectedAt = null,
                ),
            ),
            month = YearMonth.of(2026, 11),
        )

        val stats = computeMonthlyStats(records)
        assertEquals(1, stats.hadir)
        assertEquals(1, stats.terlambat)
        assertEquals(0, stats.sakit)
        assertEquals(1, stats.izin)
        assertEquals(1, stats.alpha)
    }
}
