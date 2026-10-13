package id.skanida.nativeapp

import org.junit.Assert.*
import org.junit.Test

class AttendanceHistoryTest {
    @Test fun lateCheckInAndCheckoutBecomeOneDay() {
        val result = attendanceHistory(listOf(
            json("date" to "2026-10-13", "status" to "Pulang", "created_at" to "2026-10-13T08:00:00Z"),
            json("date" to "2026-10-13", "status" to "Terlambat", "created_at" to "2026-10-13T01:00:00Z")
        ), emptyList()).single()
        assertEquals("late", result.text("status"))
        assertEquals("2026-10-13T01:00:00Z", result.text("check_in_time"))
        assertEquals("2026-10-13T08:00:00Z", result.text("check_out_time"))
    }

    @Test fun rejectedLeaveIsExcludedAndPendingSickLeaveAppears() {
        val result = attendanceHistory(emptyList(), listOf(
            json("date" to "2026-10-12", "category" to "pergi", "approval_status" to "rejected"),
            json("date" to "2026-10-13", "category" to "sakit", "approval_status" to "pending", "description" to "Sakit demam")
        ))
        assertEquals(1, result.size)
        assertEquals("sick", result.single().text("status"))
        assertEquals("Sakit demam", result.single().text("description"))
    }
}
