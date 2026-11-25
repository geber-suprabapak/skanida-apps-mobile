package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.R
import id.skanida.nativeapp.ui.components.DestructiveActionButton
import id.skanida.nativeapp.ui.components.GuillocheOverlay
import id.skanida.nativeapp.ui.components.KeyValueRow
import id.skanida.nativeapp.ui.components.PrimaryActionButton
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.components.SkanidaTextField
import id.skanida.nativeapp.ui.components.StatusBadge
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

private const val PASSWORD_REQUIREMENTS_HINT =
    "Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka."

@Composable
fun WelcomeScreen(
    busy: Boolean,
    onLogin: () -> Unit,
    onSignup: () -> Unit,
    onReset: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.background),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp))
                .background(Brush.verticalGradient(listOf(tokens.passTop, tokens.passBottom))),
        ) {
            GuillocheOverlay(
                modifier = Modifier.fillMaxSize(),
                tint = Color.White.copy(alpha = 0.06f),
                goldAccent = tokens.gold.copy(alpha = 0.22f),
            )
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.Bottom,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    Surface(
                        color = Color.White,
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.size(76.dp),
                    ) {
                        Image(
                            painter = painterResource(R.drawable.skanida_logo),
                            contentDescription = "Logo Skanida Apps",
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(4.dp)
                                .scale(1.45f),
                        )
                    }
                    Text(
                        text = "Skanida Apps",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 36.sp,
                        lineHeight = 42.sp,
                        letterSpacing = (-0.8).sp,
                        color = Color.White,
                        modifier = Modifier.semantics { heading() },
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 26.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(
                onClick = onLogin,
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = tokens.biometricBlue,
                    contentColor = Color.White,
                ),
            ) {
                Text(
                    text = "Masuk dengan Akun Sekolah",
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }
            OutlinedButton(
                onClick = onSignup,
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, tokens.border),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = tokens.card,
                    contentColor = tokens.foreground,
                ),
            ) {
                Text(
                    text = "Aktivasi Akun Siswa Baru",
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                )
            }
            Text(
                text = "Lupa password?",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = tokens.mutedForeground,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(enabled = !busy, onClick = onReset)
                    .padding(vertical = 8.dp),
            )
        }
    }
}

@Composable
fun LifecycleScreen(
    model: MainViewModel,
    onLogout: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    val isPending = model.lifecycle == "pending"
    val title = when (model.lifecycle) {
        "pending" -> "Menunggu Persetujuan Sekolah"
        "rejected" -> "Pendaftaran Belum Disetujui"
        "disabled" -> "Akun Dinonaktifkan"
        else -> "Akun Belum Dapat Diakses"
    }
    val description = if (isPending) {
        "Pendaftaran akunmu sedang ditinjau oleh administrator SMKN 2 Magelang. Kamu bisa mengecek status secara berkala."
    } else {
        "Akun ini belum dapat mengakses layanan presensi. Hubungi administrator sekolah untuk memastikan status akunmu."
    }

    SkanidaScrollScreen(topPadding = 32.dp) {
        SkanidaCard(cornerRadius = 26.dp, spacedBy = 14.dp) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(if (isPending) tokens.warning.container else tokens.error.container)
                    .align(Alignment.CenterHorizontally),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(if (isPending) R.drawable.ic_clock else R.drawable.ic_cancel),
                    contentDescription = null,
                    tint = if (isPending) tokens.warning.content else tokens.error.content,
                    modifier = Modifier.size(34.dp),
                )
            }
            Text(
                text = title,
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                textAlign = TextAlign.Center,
                color = tokens.foreground,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { heading() },
            )
            Text(
                text = description,
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 20.sp,
                textAlign = TextAlign.Center,
                color = tokens.mutedForeground,
                modifier = Modifier.fillMaxWidth(),
            )
            KeyValueRow("Nama", model.profile?.fullName?.ifBlank { "Siswa" } ?: "Siswa")
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                StatusBadge(
                    label = if (isPending) "Menunggu" else "Akses terbatas",
                    token = if (isPending) tokens.warning else tokens.error,
                )
            }
            Spacer(Modifier.height(2.dp))
            PrimaryActionButton(
                text = if (model.busy) "Memeriksa status..." else "Cek Status Persetujuan",
                onClick = { model.refresh() },
                enabled = !model.busy,
            )
            SecondaryActionButton(
                text = "Buka Pengaturan",
                onClick = { model.navigate(Page.SETTINGS) },
                enabled = !model.busy,
            )
            DestructiveActionButton(
                text = "Keluar / Ganti Akun",
                onClick = onLogout,
                enabled = !model.busy,
            )
        }
    }
}

@Composable
fun SignupScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    var nis by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    SkanidaScrollScreen {
        SkanidaCard(spacedBy = 14.dp) {
            Text(
                text = "Gunakan NIS yang terdaftar di SMKN 2 Magelang. Akun aktif setelah mendapat persetujuan administrator.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = tokens.mutedForeground,
            )
            SkanidaTextField("NIS", nis, { nis = it }, keyboardType = KeyboardType.Number, enabled = !model.busy)
            SkanidaTextField("Email sekolah", email, { email = it }, keyboardType = KeyboardType.Email, enabled = !model.busy)
            SkanidaTextField(
                label = "Password",
                value = password,
                onValueChange = { password = it },
                isPassword = true,
                enabled = !model.busy,
                supportingText = PASSWORD_REQUIREMENTS_HINT,
            )
            SkanidaTextField("Konfirmasi password", confirm, { confirm = it }, isPassword = true, enabled = !model.busy)
            PrimaryActionButton(
                text = "Kirim Pendaftaran",
                onClick = { model.signup(nis, email, password, confirm) },
                enabled = !model.busy,
            )
        }
    }
}

@Composable
fun ResetScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    var nis by rememberSaveable { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    SkanidaScrollScreen {
        SkanidaCard(spacedBy = 14.dp) {
            Text(
                text = "Masukkan NIS dan kode pemulihan yang diberikan oleh administrator sekolah.",
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = tokens.mutedForeground,
            )
            SkanidaTextField("NIS", nis, { nis = it }, keyboardType = KeyboardType.Number, enabled = !model.busy)
            SkanidaTextField("Kode pemulihan", code, { code = it }, enabled = !model.busy)
            SkanidaTextField(
                label = "Password baru",
                value = password,
                onValueChange = { password = it },
                isPassword = true,
                enabled = !model.busy,
                supportingText = PASSWORD_REQUIREMENTS_HINT,
            )
            SkanidaTextField("Konfirmasi password baru", confirm, { confirm = it }, isPassword = true, enabled = !model.busy)
            PrimaryActionButton(
                text = "Perbarui Password",
                onClick = { model.resetPassword(nis, code, password, confirm) },
                enabled = !model.busy,
            )
        }
    }
}

@Composable
fun PasswordScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    var current by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    SkanidaScrollScreen {
        SkanidaCard(spacedBy = 14.dp) {
            Text(
                text = if (model.identity.mustChangePassword) {
                    "Kamu wajib mengganti password sementara sebelum melanjutkan."
                } else {
                    "Setelah password diganti, kamu akan diminta masuk kembali dengan password baru."
                },
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = if (model.identity.mustChangePassword) tokens.warning.content else tokens.mutedForeground,
            )
            SkanidaTextField("Password saat ini", current, { current = it }, isPassword = true, enabled = !model.busy)
            SkanidaTextField(
                label = "Password baru",
                value = password,
                onValueChange = { password = it },
                isPassword = true,
                enabled = !model.busy,
                supportingText = PASSWORD_REQUIREMENTS_HINT,
            )
            SkanidaTextField("Konfirmasi password baru", confirm, { confirm = it }, isPassword = true, enabled = !model.busy)
            PrimaryActionButton(
                text = "Simpan Password Baru",
                onClick = { model.changePassword(current, password, confirm) },
                enabled = !model.busy,
            )
        }
    }
}
