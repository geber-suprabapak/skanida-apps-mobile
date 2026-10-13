package id.skanida.nativeapp

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AstraEnvelopeTest {
    @Test fun successUnwrapsDashboardData() {
        val data = AstraEnvelope.decode(200, "v1", """{"success":true,"data":{"primary_action":{"allowed":false}}}""") as JSONObject
        assertFalse(data.getJSONObject("primary_action").getBoolean("allowed"))
    }

    @Test fun incompatibleVersionFailsEvenForSuccessfulHttpResponse() {
        val error = assertThrows(AstraError::class.java) { AstraEnvelope.decode(200, null, """{"success":true,"data":{}}""") }
        assertEquals("CONTRACT_VERSION_UNSUPPORTED", error.code)
    }

    @Test fun leavePeriodRacePreservesActionableAttendanceBlock() {
        val error = assertThrows(AstraError::class.java) {
            AstraEnvelope.decode(409, "v1", """{"success":false,"error":{"code":"ATTENDANCE_BLOCKED","message":"Izin sudah disetujui hingga 2026-10-15.","details":{"effective_end_date":"2026-10-15"}}}""")
        }
        assertEquals("ATTENDANCE_BLOCKED", error.code)
        assertEquals("Izin sudah disetujui hingga 2026-10-15.", error.message)
        assertEquals("2026-10-15", error.details?.getString("effective_end_date"))
    }
}
