package id.skanida.nativeapp

import id.skanida.nativeapp.data.model.AttendancePrecheckResult
import id.skanida.nativeapp.domain.workflow.AttendanceAttemptTracker
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AttendanceWorkflowTest {
    private val validPrecheck = AttendancePrecheckResult(
        allowed = true,
        actionType = "check_in",
        blockingReason = null,
        locationName = "SMKN 2 Magelang",
        lateDeadline = null,
        isLate = false,
        message = "Silakan lanjut presensi masuk.",
    )

    @Test
    fun invMobile002PrecheckRequiredAndCreatesValidAttempt() {
        val tracker = AttendanceAttemptTracker(ttlMs = 600_000L, nowMs = { 1_000L })
        val blockedPrecheck = validPrecheck.copy(allowed = false, actionType = null, blockingReason = "Di luar area")
        assertNull(tracker.createAttempt("user-1", -7.45, 110.22, blockedPrecheck))

        val attempt = tracker.createAttempt("user-1", -7.45, 110.22, validPrecheck)
        assertNotNull(attempt)
        val (validated, error) = tracker.validateForSubmit("user-1")
        assertNotNull(validated)
        assertNull(error)
    }

    @Test
    fun invMobile004PerUserOwnershipTtlAndCancellation() {
        var now = 1_000L
        val tracker = AttendanceAttemptTracker(ttlMs = 600_000L, nowMs = { now })
        val attempt = tracker.createAttempt("user-1", -7.45, 110.22, validPrecheck)!!

        // Different user cannot reuse attempt.
        val (wrongUser, wrongUserErr) = tracker.validateForSubmit("user-2")
        assertNull(wrongUser)
        assertTrue(wrongUserErr!!.contains("kedaluwarsa"))

        // Expiry after 10 minutes blocks submission.
        val tracker2 = AttendanceAttemptTracker(ttlMs = 600_000L, nowMs = { now })
        tracker2.createAttempt("user-1", -7.45, 110.22, validPrecheck)
        now += 600_001L
        val (expired, expiredErr) = tracker2.validateForSubmit("user-1")
        assertNull(expired)
        assertTrue(expiredErr!!.contains("kedaluwarsa"))
    }

    @Test
    fun uncertainOutcomePreventsDuplicateSubmit() {
        val tracker = AttendanceAttemptTracker(ttlMs = 600_000L, nowMs = { 1_000L })
        val attempt = tracker.createAttempt("user-1", -7.45, 110.22, validPrecheck)!!
        tracker.markSubmitting(attempt)
        tracker.markUncertain(attempt)

        val (validated, error) = tracker.validateForSubmit("user-1")
        assertNull(validated)
        assertTrue(error!!.contains("belum dapat dipastikan"))
    }
}
