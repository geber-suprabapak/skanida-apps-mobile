package id.skanida.nativeapp.domain.workflow

import id.skanida.nativeapp.data.model.PermitRecord

private val DIGITS_ONLY_REGEX = Regex("^[0-9]+$")
private val EMAIL_REGEX = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")

object InputValidation {
    const val MIN_PASSWORD_LENGTH = 8
    const val MIN_LEAVE_DESCRIPTION = 10
    const val MAX_LEAVE_DESCRIPTION = 500
    const val MAX_DAILY_PERMITS = 3

    fun hasStrongPassword(password: String): Boolean = password.length >= MIN_PASSWORD_LENGTH &&
        password.any { it.isUpperCase() } &&
        password.any { it.isLowerCase() } &&
        password.any { it.isDigit() }

    fun validateSignup(nis: String, email: String, password: String, confirm: String) {
        check(DIGITS_ONLY_REGEX.matches(nis.trim())) { "NIS harus berupa angka." }
        check(EMAIL_REGEX.matches(email.trim())) { "Email tidak valid." }
        check(hasStrongPassword(password)) {
            "Password minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka."
        }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
    }

    fun validatePasswordReset(nis: String, code: String, password: String, confirm: String) {
        check(nis.isNotBlank() && code.isNotBlank()) { "NIS dan kode pemulihan wajib diisi." }
        check(password.length >= MIN_PASSWORD_LENGTH) { "Password minimal 8 karakter." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
    }

    fun validatePasswordChange(current: String, password: String, confirm: String) {
        check(current.isNotBlank() && password.length >= MIN_PASSWORD_LENGTH) {
            "Isi password saat ini dan password baru minimal 8 karakter."
        }
        check(hasStrongPassword(password)) {
            "Password harus mengandung huruf besar, huruf kecil, dan angka."
        }
        check(current != password) { "Password baru harus berbeda dari password lama." }
        check(password == confirm) { "Konfirmasi password tidak cocok." }
    }

    fun validateLeaveEligibility(description: String, todayPermits: List<PermitRecord>) {
        check(description.length in MIN_LEAVE_DESCRIPTION..MAX_LEAVE_DESCRIPTION) {
            "Keterangan harus 10–500 karakter."
        }
        check(todayPermits.none { it.approvalStatus == "pending" }) {
            "Pengajuan hari ini masih menunggu persetujuan."
        }
        check(todayPermits.none { it.approvalStatus == "approved" }) {
            "Izin hari ini sudah disetujui."
        }
        check(todayPermits.size < MAX_DAILY_PERMITS) {
            "Batas maksimal $MAX_DAILY_PERMITS pengajuan per hari telah tercapai."
        }
    }
}
