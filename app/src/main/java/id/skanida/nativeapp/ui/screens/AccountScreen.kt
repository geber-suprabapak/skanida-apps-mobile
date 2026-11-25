package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.R
import id.skanida.nativeapp.data.model.formatGender
import id.skanida.nativeapp.ui.components.KeyValueRow
import id.skanida.nativeapp.ui.components.MediaSourcePickerRow
import id.skanida.nativeapp.ui.components.SettingsGroupRow
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaConfirmDialog
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.components.UserAvatar
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

private val ACCOUNT_TOP_SHAPE = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp)
private val ACCOUNT_BOTTOM_SHAPE = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp)

@Composable
fun AccountScreen(model: MainViewModel, onPickAvatarGallery: () -> Unit, onOpenAvatarCamera: () -> Unit, onEnroll: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    var clearPhoto by remember { mutableStateOf(false) }
    val profile = model.profile
    val displayName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Akun Siswa"
    val enrollment = model.enrollmentStatus
    val enrolled = enrollment?.isEnrolled == true

    SkanidaScrollScreen {
        SkanidaCard(padding = PaddingValues(20.dp), spacedBy = 14.dp) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                UserAvatar(
                    url = profile?.avatarUrl,
                    fallbackName = displayName,
                    size = 88.dp,
                    borderColor = tokens.gold.copy(alpha = 0.65f),
                    borderWidth = 2.dp,
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = displayName,
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        color = tokens.foreground,
                    )
                    Text(
                        text = if (!profile?.avatarUrl.isNullOrBlank()) "Foto profil tersimpan" else "Ubah foto profil akunmu",
                        fontFamily = ManropeFontFamily,
                        fontSize = 12.sp,
                        color = tokens.mutedForeground,
                    )
                }
                MediaSourcePickerRow(
                    enabled = !model.busy,
                    onPickGallery = onPickAvatarGallery,
                    onOpenCamera = onOpenAvatarCamera,
                )
                if (!profile?.avatarUrl.isNullOrBlank()) {
                    TextButton(
                        onClick = { clearPhoto = true },
                        enabled = !model.busy,
                        colors = ButtonDefaults.textButtonColors(contentColor = tokens.error.content),
                    ) {
                        Text("Hapus foto profil", fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            val enrollSubtitle = when {
                enrolled -> "${enrollment?.embeddingCount ?: 10} sampel aktif • Terverifikasi"
                !model.approved -> "Tersedia setelah akun disetujui"
                else -> "Belum terdaftar • Ketuk untuk daftar"
            }
            SettingsGroupRow(
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.ic_face_scan),
                        contentDescription = null,
                        tint = if (enrolled) tokens.success.content else tokens.warning.content,
                        modifier = Modifier.size(20.dp),
                    )
                },
                iconBg = if (enrolled) tokens.success.container else tokens.warning.container,
                title = "Pendaftaran wajah",
                subtitle = enrollSubtitle,
                subtitleColor = if (enrolled) tokens.success.content else tokens.warning.content,
                shape = ACCOUNT_TOP_SHAPE,
                enabled = !model.busy && model.approved,
                onClick = onEnroll,
            )
            SettingsGroupRow(
                icon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = tokens.cobaltOnTint,
                        modifier = Modifier.size(19.dp),
                    )
                },
                iconBg = tokens.cobaltTint,
                title = "Ganti password",
                subtitle = "Perbarui keamanan akun sekolahmu",
                shape = ACCOUNT_BOTTOM_SHAPE,
                enabled = !model.busy,
                onClick = { model.navigate(Page.PASSWORD) },
            )
        }

        SkanidaCard(spacedBy = 12.dp) {
            Text(
                text = "Biodata Siswa",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = tokens.foreground,
            )
            KeyValueRow("Nama lengkap", profile?.fullName.orEmpty())
            HorizontalDivider(color = tokens.border.copy(alpha = 0.6f))
            KeyValueRow("NIS", profile?.nis.orEmpty(), mono = true)
            HorizontalDivider(color = tokens.border.copy(alpha = 0.6f))
            KeyValueRow("Kelas", profile?.className.orEmpty())
            HorizontalDivider(color = tokens.border.copy(alpha = 0.6f))
            KeyValueRow("Nomor absen", profile?.absenceNumber.orEmpty(), mono = true)
            HorizontalDivider(color = tokens.border.copy(alpha = 0.6f))
            KeyValueRow("Email", profile?.email.orEmpty())
            HorizontalDivider(color = tokens.border.copy(alpha = 0.6f))
            KeyValueRow("Jenis kelamin", formatGender(profile?.gender))
            Text(
                text = "Untuk perubahan data akademik, hubungi administrator sekolah.",
                fontFamily = ManropeFontFamily,
                fontSize = 12.sp,
                color = tokens.mutedForeground,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }

    if (clearPhoto) {
        SkanidaConfirmDialog(
            title = "Hapus foto profil?",
            message = "Foto profilmu akan dikembalikan ke inisial akun.",
            confirmText = "Hapus",
            dismissText = "Batal",
            onConfirm = {
                clearPhoto = false
                model.clearAvatar()
            },
            onDismiss = { clearPhoto = false },
        )
    }
}
