package id.skanida.nativeapp

import id.skanida.nativeapp.data.model.DashboardAttendance
import id.skanida.nativeapp.data.model.DashboardSchedule
import id.skanida.nativeapp.data.model.MonthlyAttendanceStats
import id.skanida.nativeapp.domain.workflow.NotificationChannelPrefs
import id.skanida.nativeapp.domain.workflow.computeMonthlyAttendanceSummary
import id.skanida.nativeapp.domain.workflow.computeScheduleTimeline
import id.skanida.nativeapp.domain.workflow.initialsFromName
import id.skanida.nativeapp.domain.workflow.shouldDeliverNotification
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class AttendancePresentationTest {

    @Test
    fun `schedule timeline tracks active countdown and completed checkout`() {
        val schedule = DashboardSchedule(
            dayKey = "tuesday",
            startCheckInAt = "2026-11-24T06:30:00+07:00",
            endCheckInAt = "2026-11-24T07:00:00+07:00",
            startCheckOutAt = "2026-11-24T15:00:00+07:00",
            endCheckOutAt = "2026-11-24T17:00:00+07:00",
            compensationMinutes = 15,
        )
        val checkedIn = DashboardAttendance(
            todayStatus = "present",
            hasCheckedIn = true,
            hasCheckedOut = false,
            checkInTime = "2026-11-24T06:48:00+07:00",
            checkOutTime = null,
            totalWorkHours = null,
            explicitCheckInStatus = "Hadir",
        )

        val midDay = computeScheduleTimeline(
            schedule = schedule,
            attendance = checkedIn,
            nowInstant = Instant.parse("2026-11-24T07:32:00Z"), // 14:32 WIB
        )
        assertFalse(midDay.isCompleted)
        assertEquals("Tersisa 28 mnt ke pulang", midDay.statusText)
        assertEquals("06:30", midDay.startLabel)
        assertEquals("15:00", midDay.endLabel)
        assertTrue(midDay.progress in 0.85f..0.95f)

        val completed = computeScheduleTimeline(
            schedule = schedule,
            attendance = checkedIn.copy(hasCheckedOut = true, checkOutTime = "2026-11-24T15:05:00+07:00"),
            nowInstant = Instant.parse("2026-11-24T08:10:00Z"),
        )
        assertTrue(completed.isCompleted)
        assertEquals(1f, completed.progress, 0.001f)
        assertEquals("Sesi hari ini selesai", completed.statusText)

        val holiday = computeScheduleTimeline(null, null, Instant.parse("2026-11-24T07:00:00Z"))
        assertEquals("Tidak ada jadwal hari ini", holiday.statusText)
        assertEquals(0f, holiday.progress, 0.001f)
    }

    @Test
    fun `monthly attendance summary calculates percentage safely including empty months`() {
        val empty = computeMonthlyAttendanceSummary(MonthlyAttendanceStats(0, 0, 0, 0, 0))
        assertEquals(0, empty.effectiveDays)
        assertEquals(0, empty.percent)

        val active = computeMonthlyAttendanceSummary(
            MonthlyAttendanceStats(hadir = 14, terlambat = 1, sakit = 1, izin = 1, alpha = 0),
        )
        assertEquals(15, active.attendedDays)
        assertEquals(17, active.effectiveDays)
        assertEquals(88, active.percent)
        assertEquals("RP", initialsFromName("Raka Pratama"))
    }

    @Test
    fun `notification channel preferences filter targeted reminders without dropping general notices`() {
        val mutedCheckIn = NotificationChannelPrefs(checkIn = false, checkOut = true, permitUpdates = false)
        assertFalse(shouldDeliverNotification(mutedCheckIn, "check_in", "Presensi Masuk", "Sesi pagi dibuka"))
        assertTrue(shouldDeliverNotification(mutedCheckIn, "check_out", "Presensi Pulang", "Sesi pulang dibuka"))
        assertFalse(shouldDeliverNotification(mutedCheckIn, "permit_approved", "Perizinan", "Izin sakit disetujui"))
        assertTrue(shouldDeliverNotification(mutedCheckIn, "announcement", "Pengumuman Sekolah", "Upacara hari Senin"))
    }
}
