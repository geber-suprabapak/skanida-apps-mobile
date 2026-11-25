package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.ui.components.KeyValueRow
import id.skanida.nativeapp.ui.components.PrimaryActionButton
import id.skanida.nativeapp.ui.components.PrimaryBiometricButton
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import id.skanida.nativeapp.ui.theme.SkanidaPalette

@Composable
internal fun AttendanceUncertainScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    SkanidaScrollScreen {
        SkanidaCard(
            cornerRadius = 26.dp,
            containerColor = tokens.warning.container,
            borderColor = tokens.warning.border,
            padding = PaddingValues(22.dp),
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = tokens.warning.content,
                modifier = Modifier
                    .size(44.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                text = "Status Pengiriman Belum Dapat Dipastikan",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
                textAlign = TextAlign.Center,
                color = tokens.warning.content,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = model.attendanceSubmitError
                    ?: "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 20.sp,
                textAlign = TextAlign.Center,
                color = tokens.foreground,
            )
            PrimaryActionButton(
                text = "Periksa Riwayat Presensi",
                onClick = { model.navigate(Page.HISTORY) },
            )
            SecondaryActionButton(
                text = "Kembali ke Beranda",
                onClick = { model.navigate(Page.HOME) },
            )
        }
    }
}

@Composable
internal fun EnrollmentConfirmScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    SkanidaScrollScreen {
        SkanidaCard(cornerRadius = 26.dp, padding = PaddingValues(22.dp), spacedBy = 14.dp) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = SkanidaPalette.SuccessDot,
                modifier = Modifier
                    .size(54.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                text = "10 Foto Wajah Siap Dikirim",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                textAlign = TextAlign.Center,
                color = tokens.foreground,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "Pastikan seluruh foto jelas dan wajah terlihat. Setelah dikirim, data wajah akan diproses oleh server.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center,
                color = tokens.mutedForeground,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                model.photos.chunked(5).forEachIndexed { rowIdx, row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        row.forEachIndexed { idx, file ->
                            AsyncImage(
                                model = file,
                                contentDescription = "Foto wajah ${rowIdx * 5 + idx + 1}",
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(3f / 4f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .border(1.dp, tokens.border, RoundedCornerShape(10.dp)),
                                contentScale = ContentScale.Crop,
                            )
                        }
                    }
                }
            }
            PrimaryBiometricButton(
                text = "Kirim & Daftarkan Wajah",
                onClick = model::submitEnrollment,
                enabled = !model.busy,
            )
            SecondaryActionButton(
                text = "Ambil Ulang Semua Foto",
                onClick = model::retakeEnrollment,
                enabled = !model.busy,
            )
        }
    }
}

@Composable
internal fun EnrollmentUploadingScreen() {
    val tokens = LocalSkanidaColors.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.padding(32.dp),
        ) {
            CircularProgressIndicator(color = tokens.biometricBlue, modifier = Modifier.size(48.dp))
            Text(
                text = "Mendaftarkan Wajah...",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = tokens.foreground,
            )
            Text(
                text = "Mengunggah 10 sampel foto ke server verifikasi.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                color = tokens.mutedForeground,
            )
        }
    }
}

@Composable
internal fun EnrollmentSuccessScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    val res = model.enrollmentResult
    SkanidaScrollScreen {
        SkanidaCard(cornerRadius = 26.dp, padding = PaddingValues(22.dp), spacedBy = 14.dp) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(tokens.success.container)
                    .align(Alignment.CenterHorizontally),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = tokens.success.content,
                    modifier = Modifier.size(40.dp),
                )
            }
            Text(
                text = "Wajah Berhasil Didaftarkan",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                textAlign = TextAlign.Center,
                color = tokens.foreground,
                modifier = Modifier.fillMaxWidth(),
            )
            if (res != null) {
                KeyValueRow("Foto diproses", "${res.imagesProcessed} foto", mono = true)
                KeyValueRow("Foto gagal", "${res.imagesFailed} foto", mono = true)
                KeyValueRow("Sampel wajah tersimpan", "${res.totalEmbeddings} sampel", mono = true)
            }
            PrimaryActionButton(
                text = "Kembali ke Beranda",
                onClick = model::finishEnrollment,
            )
        }
    }
}

@Composable
internal fun EnrollmentUnknownOutcomeScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    SkanidaScrollScreen {
        SkanidaCard(
            cornerRadius = 26.dp,
            containerColor = tokens.warning.container,
            borderColor = tokens.warning.border,
            padding = PaddingValues(22.dp),
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = tokens.warning.content,
                modifier = Modifier
                    .size(48.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                text = "Hasil Pendaftaran Belum Diketahui",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
                textAlign = TextAlign.Center,
                color = tokens.warning.content,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = model.enrollmentError
                    ?: "Permintaan sudah dikirim, tetapi konfirmasi akhir belum diterima.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                color = tokens.foreground,
            )
            model.enrollmentStatus?.let { status ->
                KeyValueRow(
                    "Status saat ini",
                    if (status.isEnrolled) "Sudah terdaftar (${status.embeddingCount} sampel)" else "Belum terdaftar",
                )
            }
            PrimaryActionButton(
                text = "Cek Status Pendaftaran",
                onClick = model::checkEnrollmentStatusAfterUnknown,
                enabled = !model.busy,
            )
            SecondaryActionButton(
                text = "Kembali ke Beranda",
                onClick = model::finishEnrollment,
                enabled = !model.busy,
            )
        }
    }
}
