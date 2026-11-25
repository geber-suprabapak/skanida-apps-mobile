package id.skanida.nativeapp

import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.domain.workflow.InputValidation
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class InputValidationTest {
    @Test
    fun signupValidationEnforcesNisEmailAndPasswordPolicy() {
        InputValidation.validateSignup("24001", "siswa@skanida.sch.id", "Skanida2026", "Skanida2026")

        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateSignup("24A01", "siswa@skanida.sch.id", "Skanida2026", "Skanida2026")
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateSignup("24001", "not-an-email", "Skanida2026", "Skanida2026")
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateSignup("24001", "siswa@skanida.sch.id", "weakpass", "weakpass")
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateSignup("24001", "siswa@skanida.sch.id", "Skanida2026", "Mismatch1")
        }
        assertTrue(InputValidation.hasStrongPassword("Skanida2026"))
        assertFalse(InputValidation.hasStrongPassword("skanida2026"))
    }

    @Test
    fun passwordChangeRejectsSamePasswordOrWeakConfirmation() {
        InputValidation.validatePasswordChange("OldPass123", "NewPass123", "NewPass123")

        assertThrows(IllegalStateException::class.java) {
            InputValidation.validatePasswordChange("SamePass123", "SamePass123", "SamePass123")
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validatePasswordChange("", "NewPass123", "NewPass123")
        }
    }

    @Test
    fun leaveEligibilityBlocksPendingApprovedAndDailyQuota() {
        InputValidation.validateLeaveEligibility("Sakit demam tinggi sejak semalam.", emptyList())

        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateLeaveEligibility("Terlalu", emptyList())
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateLeaveEligibility(
                "Sakit demam tinggi sejak semalam.",
                listOf(samplePermit("p1", "pending")),
            )
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateLeaveEligibility(
                "Sakit demam tinggi sejak semalam.",
                listOf(samplePermit("p1", "approved")),
            )
        }
        assertThrows(IllegalStateException::class.java) {
            InputValidation.validateLeaveEligibility(
                "Sakit demam tinggi sejak semalam.",
                listOf(samplePermit("p1", "rejected"), samplePermit("p2", "rejected"), samplePermit("p3", "rejected")),
            )
        }
    }

    private fun samplePermit(id: String, status: String) = PermitRecord(
        id = id,
        category = "sakit",
        description = "Demam",
        date = "2026-11-25",
        requestedStartDate = "2026-11-25",
        originalEndDate = null,
        effectiveEndDate = null,
        durationDays = null,
        approvalStatus = status,
        attachmentUrl = null,
        createdAt = "2026-11-25T01:00:00Z",
        rejectionReason = null,
        rejectedAt = null,
    )
}
