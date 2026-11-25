package id.skanida.nativeapp

import id.skanida.nativeapp.data.model.AttendancePrecheckResult
import id.skanida.nativeapp.data.model.formatGender
import id.skanida.nativeapp.data.model.localizePrimaryActionReason
import id.skanida.nativeapp.domain.workflow.AbsenceStatusIcon
import id.skanida.nativeapp.domain.workflow.AbsenceStatusTone
import id.skanida.nativeapp.domain.workflow.formatAttendanceDateLabel
import id.skanida.nativeapp.domain.workflow.formatTimeWib
import id.skanida.nativeapp.domain.workflow.resolveAbsenceStatusMeta
import org.junit.Assert.assertEquals
import org.junit.Test

class TimeAndFormattingTest {
    @Test
    fun bugMob04FormatsAttendanceDatesInIndonesianLocale() {
        assertEquals("18 Nov 2026", formatAttendanceDateLabel("2026-11-18"))
        assertEquals("18 Nov 2026", formatAttendanceDateLabel("2026-11-17T17:00:00.000Z"))
        assertEquals("5 Jan 2026", formatAttendanceDateLabel("2026-01-05"))
        assertEquals("", formatAttendanceDateLabel(""))
        assertEquals("not-a-date", formatAttendanceDateLabel("not-a-date"))
    }

    @Test
    fun formatsPostgresAndIsoTimestampsInWib() {
        assertEquals("09:28", formatTimeWib("2026-10-26 09:28:12.123456+07"))
        assertEquals("09:28", formatTimeWib("2026-10-26T02:28:00.000Z"))
        assertEquals("—", formatTimeWib(null))
    }

    @Test
    fun bugMob03ResolvesAmberToneForTerlambatAndGreenForOnTime() {
        val latePrecheck = AttendancePrecheckResult(
            allowed = true,
            actionType = "check_in",
            blockingReason = null,
            locationName = "SMKN 2 Magelang",
            lateDeadline = null,
            isLate = true,
            message = "Presensi masuk terlambat tercatat.",
        )
        val lateMeta = resolveAbsenceStatusMeta(isLoading = false, errorMessage = null, precheck = latePrecheck)
        assertEquals(AbsenceStatusIcon.CLOCK, lateMeta.icon)
        assertEquals(AbsenceStatusTone.WARNING, lateMeta.tone)

        val onTimePrecheck = latePrecheck.copy(isLate = false, message = "Tepat waktu.")
        val onTimeMeta = resolveAbsenceStatusMeta(isLoading = false, errorMessage = null, precheck = onTimePrecheck)
        assertEquals(AbsenceStatusIcon.CHECK_CIRCLE, onTimeMeta.icon)
        assertEquals(AbsenceStatusTone.SUCCESS, onTimeMeta.tone)

        val errorMeta = resolveAbsenceStatusMeta(
            isLoading = false,
            errorMessage = "Lokasi tidak tersedia",
            precheck = null,
        )
        assertEquals(AbsenceStatusIcon.MAP_PIN_OFF, errorMeta.icon)
        assertEquals(AbsenceStatusTone.ERROR, errorMeta.tone)
    }

    @Test
    fun formatsGenderCodesIntoIndonesianLabels() {
        assertEquals("Laki-laki", formatGender("L"))
        assertEquals("Perempuan", formatGender("P"))
        assertEquals("Laki-laki", formatGender("male"))
        assertEquals("—", formatGender(""))
    }

    @Test
    fun localizesEnglishPrimaryActionReasonsToIndonesian() {
        assertEquals(
            "Daftarkan wajah terlebih dahulu sebelum melakukan presensi.",
            localizePrimaryActionReason("face_not_enrolled", "Face enrollment is required before attendance."),
        )
        assertEquals(
            "Daftarkan wajah terlebih dahulu sebelum melakukan presensi.",
            localizePrimaryActionReason(null, "Face enrollment is required before attendance."),
        )
        assertEquals(
            "Saat ini di luar jam presensi yang dijadwalkan.",
            localizePrimaryActionReason("outside_schedule", "Outside schedule window."),
        )
    }
}
