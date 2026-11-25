package id.skanida.nativeapp

import id.skanida.nativeapp.data.api.AstraEnvelope
import id.skanida.nativeapp.data.api.AstraError
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AstraEnvelopeTest {
    @Test
    fun successUnwrapsDashboardData() {
        val data = AstraEnvelope.decode(
            200,
            "v1",
            """{"success":true,"data":{"primary_action":{"allowed":false}}}""",
        ) as JSONObject
        assertFalse(data.getJSONObject("primary_action").getBoolean("allowed"))
    }

    @Test
    fun incompatibleVersionFailsEvenForSuccessfulHttpResponse() {
        val error = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(200, null, """{"success":true,"data":{}}""")
        }
        assertEquals("CONTRACT_VERSION_UNSUPPORTED", error.code)
    }

    @Test
    fun leavePeriodRacePreservesActionableAttendanceBlock() {
        val error = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(
                409,
                "v1",
                """{"success":false,"error":{"code":"ATTENDANCE_BLOCKED","message":"Izin sudah disetujui hingga 2026-10-15.","details":{"effective_end_date":"2026-10-15"}}}""",
            )
        }
        assertEquals("ATTENDANCE_BLOCKED", error.code)
        assertEquals("Izin sudah disetujui hingga 2026-10-15.", error.message)
        assertEquals("2026-10-15", error.details?.getString("effective_end_date"))
    }

    @Test
    fun leaveConflictCodesProduceActionableIndonesianMessages() {
        val pending = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(
                409,
                "v1",
                """{"success":false,"error":{"code":"LEAVE_REQUEST_PENDING","message":"Pending"}}""",
            )
        }
        assertTrue(pending.message!!.contains("menunggu persetujuan"))

        val overlap = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(
                409,
                "v1",
                """{"success":false,"error":{"code":"LEAVE_PERIOD_OVERLAP","message":"Overlap","details":{"overlapping_start_date":"2026-10-10","overlapping_end_date":"2026-10-12"}}}""",
            )
        }
        assertTrue(overlap.message!!.contains("2026-10-10 sampai 2026-10-12"))

        val conflict = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(
                409,
                "v1",
                """{"success":false,"error":{"code":"LEAVE_APPROVAL_CONFLICT","message":"Conflict","details":{"conflicting_dates":["2026-10-13"]}}}""",
            )
        }
        assertTrue(conflict.message!!.contains("2026-10-13"))
    }
}
