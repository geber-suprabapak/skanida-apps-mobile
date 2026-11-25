package id.skanida.nativeapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.BuildConfig
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.R
import id.skanida.nativeapp.data.model.formatGender
import id.skanida.nativeapp.ui.components.DestructiveActionButton
import id.skanida.nativeapp.ui.components.GuillocheOverlay
import id.skanida.nativeapp.ui.components.KeyValueRow
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.components.UserAvatar
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(model: MainViewModel, onLogoutClick: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val profile = model.profile
    val displayName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Akun Siswa"
    val displayId = profile?.nis?.takeIf { it.isNotBlank() } ?: model.identity.userId
    val subtitleLine = listOfNotNull(
        profile?.className?.takeIf { it.isNotBlank() },
        profile?.email?.takeIf { it.isNotBlank() },
    ).joinToString(" • ")

    PullToRefreshBox(
        isRefreshing = model.refreshing,
        onRefresh = { model.refresh(asPullRefresh = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        SkanidaScrollScreen {
            Text(
                text = "Pengaturan",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 26.sp,
                color = tokens.foreground,
                modifier = Modifier.semantics { heading() },
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = tokens.passTop,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.linearGradient(listOf(tokens.passTop, tokens.passBottom))),
                ) {
                    GuillocheOverlay(
                        modifier = Modifier.matchParentSize(),
                        tint = Color.White.copy(alpha = 0.05f),
                        goldAccent = tokens.gold.copy(alpha = 0.22f),
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        UserAvatar(
                            url = profile?.avatarUrl,
                            fallbackName = displayName,
                            size = 48.dp,
                            borderColor = tokens.gold.copy(alpha = 0.55f),
                            containerColor = Color.White.copy(alpha = 0.15f),
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(
                                text = displayName,
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (subtitleLine.isNotBlank()) {
                                Text(
                                    text = subtitleLine,
                                    fontFamily = ManropeFontFamily,
                                    fontSize = 11.sp,
                                    color = tokens.passSubtle,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        if (displayId.isNotBlank()) {
                            Surface(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .clickable(role = Role.Button, onClickLabel = "Salin NIS") {
                                        context.getSystemService(ClipboardManager::class.java)
                                            ?.setPrimaryClip(ClipData.newPlainText("NIS Skanida", displayId))
                                        model.showNotice("NIS $displayId berhasil disalin.")
                                    },
                                shape = RoundedCornerShape(999.dp),
                                color = tokens.goldTint,
                                border = BorderStroke(1.dp, tokens.gold.copy(alpha = 0.45f)),
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                                ) {
                                    Text(
                                        text = displayId,
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        color = tokens.gold,
                                    )
                                    Icon(
                                        painter = painterResource(R.drawable.ic_copy),
                                        contentDescription = "Salin NIS",
                                        tint = tokens.gold,
                                        modifier = Modifier.size(12.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                SettingsGroupRow(
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = tokens.foreground,
                            modifier = Modifier.size(19.dp),
                        )
                    },
                    title = "Kelola akun",
                    subtitle = "Biodata, pendaftaran wajah & password",
                    shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp),
                    enabled = !model.busy,
                    onClick = { model.navigate(Page.ACCOUNT) },
                )
                SettingsGroupRow(
                    icon = {
                        Icon(
                            painter = painterResource(R.drawable.ic_notifications),
                            contentDescription = null,
                            tint = tokens.foreground,
                            modifier = Modifier.size(19.dp),
                        )
                    },
                    title = "Pengaturan notifikasi",
                    subtitle = if (model.notificationsEnabled) {
                        "Pengingat jadwal masuk, pulang & izin"
                    } else {
                        "Notifikasi sedang dinonaktifkan"
                    },
                    shape = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp),
                    enabled = !model.busy,
                    onClick = { model.navigate(Page.NOTIFICATIONS) },
                )
            }

            SkanidaCard(cornerRadius = 22.dp, padding = PaddingValues(14.dp), spacedBy = 10.dp) {
                Text(
                    text = "Tampilan",
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = tokens.foreground,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.muted)
                        .padding(4.dp)
                        .selectableGroup(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    listOf("system" to "Sistem", "light" to "Terang", "dark" to "Gelap").forEach { (value, label) ->
                        val selected = model.theme == value
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(11.dp))
                                .background(if (selected) tokens.card else Color.Transparent)
                                .selectable(
                                    selected = selected,
                                    role = Role.RadioButton,
                                    onClick = { model.updateTheme(value) },
                                )
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = label,
                                fontFamily = ManropeFontFamily,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp,
                                color = if (selected) tokens.foreground else tokens.mutedForeground,
                            )
                        }
                    }
                }
            }

            DestructiveActionButton(
                text = "Keluar dari Akun",
                onClick = onLogoutClick,
                enabled = !model.busy,
                leadingIcon = {
                    Icon(
                        painter = painterResource(R.drawable.ic_logout),
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                },
            )

            Text(
                text = "Skanida Apps · v${BuildConfig.VERSION_NAME}",
                fontFamily = JetBrainsMonoFontFamily,
                fontSize = 11.sp,
                color = tokens.mutedForeground.copy(alpha = 0.75f),
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun SettingsGroupRow(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    shape: RoundedCornerShape,
    enabled: Boolean = true,
    iconBg: Color? = null,
    subtitleColor: Color? = null,
    onClick: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        shape = shape,
        color = tokens.card,
        border = BorderStroke(1.dp, tokens.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(iconBg ?: tokens.muted),
                contentAlignment = Alignment.Center,
            ) {
                icon()
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = tokens.foreground,
                )
                Text(
                    text = subtitle,
                    fontFamily = ManropeFontFamily,
                    fontSize = 12.sp,
                    color = subtitleColor ?: tokens.mutedForeground,
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = tokens.mutedForeground,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
fun AccountScreen(model: MainViewModel, onPickAvatarGallery: () -> Unit, onOpenAvatarCamera: () -> Unit, onEnroll: () -> Unit,) {
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(enabled = !model.busy, role = Role.Button, onClick = onPickAvatarGallery),
                        shape = RoundedCornerShape(14.dp),
                        color = tokens.muted,
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                painter = painterResource(R.drawable.ic_photo_library),
                                contentDescription = null,
                                tint = tokens.foreground,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(7.dp))
                            Text(
                                text = "Galeri",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = tokens.foreground,
                            )
                        }
                    }
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(enabled = !model.busy, role = Role.Button, onClick = onOpenAvatarCamera),
                        shape = RoundedCornerShape(14.dp),
                        color = tokens.cobaltTint,
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                painter = painterResource(R.drawable.ic_camera),
                                contentDescription = null,
                                tint = tokens.cobaltOnTint,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(7.dp))
                            Text(
                                text = "Kamera",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = tokens.cobaltOnTint,
                            )
                        }
                    }
                }
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
                        imageVector = Icons.Default.Face,
                        contentDescription = null,
                        tint = if (enrolled) tokens.success.content else tokens.warning.content,
                        modifier = Modifier.size(20.dp),
                    )
                },
                iconBg = if (enrolled) tokens.success.container else tokens.warning.container,
                title = "Pendaftaran wajah",
                subtitle = enrollSubtitle,
                subtitleColor = if (enrolled) tokens.success.content else tokens.warning.content,
                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp),
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
                shape = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp),
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
        AlertDialog(
            onDismissRequest = { clearPhoto = false },
            containerColor = tokens.card,
            titleContentColor = tokens.foreground,
            textContentColor = tokens.mutedForeground,
            title = {
                Text("Hapus foto profil?", fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
            },
            text = {
                Text("Foto profilmu akan dikembalikan ke inisial akun.", fontFamily = ManropeFontFamily)
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        clearPhoto = false
                        model.clearAvatar()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = tokens.error.content),
                ) {
                    Text("Hapus", fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { clearPhoto = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = tokens.foreground),
                ) {
                    Text("Batal", fontFamily = ManropeFontFamily, fontWeight = FontWeight.SemiBold)
                }
            },
        )
    }
}

@Composable
fun NotificationsScreen(model: MainViewModel, onToggleMaster: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val prefs = model.notificationPrefs
    val masterOn = model.notificationsEnabled

    SkanidaScrollScreen {
        SkanidaCard(cornerRadius = 22.dp, padding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(tokens.cobaltTint),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_notifications),
                        contentDescription = null,
                        tint = tokens.cobaltOnTint,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Aktifkan Notifikasi",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = tokens.foreground,
                    )
                    Text(
                        text = if (masterOn) "Aktif untuk perangkat ini" else "Semua pengingat dimatikan",
                        fontFamily = ManropeFontFamily,
                        fontSize = 12.sp,
                        color = tokens.mutedForeground,
                    )
                }
                Switch(
                    checked = masterOn,
                    enabled = !model.busy,
                    onCheckedChange = { onToggleMaster() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = tokens.biometricBlue,
                        uncheckedThumbColor = tokens.mutedForeground,
                        uncheckedTrackColor = tokens.muted,
                        uncheckedBorderColor = tokens.mutedForeground.copy(alpha = 0.45f),
                    ),
                    modifier = Modifier.semantics { contentDescription = "Aktifkan Notifikasi" },
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            NotificationToggleRow(
                title = "Pengingat Presensi Masuk",
                subtitle = "Kabar pengingat jadwal masuk pada hari sekolah",
                checked = masterOn && prefs.checkIn,
                enabled = masterOn && !model.busy,
                onCheckedChange = { model.updateNotificationPrefs(prefs.copy(checkIn = it)) },
                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp),
            )
            NotificationToggleRow(
                title = "Pengingat Presensi Pulang",
                subtitle = "Kabar saat sesi presensi pulang mulai dibuka",
                checked = masterOn && prefs.checkOut,
                enabled = masterOn && !model.busy,
                onCheckedChange = { model.updateNotificationPrefs(prefs.copy(checkOut = it)) },
                shape = RoundedCornerShape(6.dp),
            )
            NotificationToggleRow(
                title = "Pembaruan Status Perizinan",
                subtitle = "Kabar langsung saat izin disetujui atau ditolak",
                checked = masterOn && prefs.permitUpdates,
                enabled = masterOn && !model.busy,
                onCheckedChange = { model.updateNotificationPrefs(prefs.copy(permitUpdates = it)) },
                shape = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp),
            )
        }

        SecondaryActionButton(
            text = "Pengaturan Izin Perangkat",
            onClick = {
                val intent = if (Build.VERSION.SDK_INT >= 26) {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    }
                } else {
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:${context.packageName}"),
                    )
                }
                context.startActivity(intent)
            },
        )
    }
}

@Composable
private fun NotificationToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    shape: RoundedCornerShape,
) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = shape,
        color = tokens.card,
        border = BorderStroke(1.dp, tokens.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = if (enabled) tokens.foreground else tokens.mutedForeground,
                )
                Text(
                    text = subtitle,
                    fontFamily = ManropeFontFamily,
                    fontSize = 12.sp,
                    color = tokens.mutedForeground,
                )
            }
            Switch(
                checked = checked,
                enabled = enabled,
                onCheckedChange = onCheckedChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = tokens.biometricBlue,
                    uncheckedThumbColor = tokens.mutedForeground,
                    uncheckedTrackColor = tokens.muted,
                    uncheckedBorderColor = tokens.mutedForeground.copy(alpha = 0.45f),
                    disabledUncheckedThumbColor = tokens.mutedForeground.copy(alpha = 0.4f),
                    disabledUncheckedTrackColor = tokens.muted.copy(alpha = 0.55f),
                    disabledUncheckedBorderColor = tokens.border,
                ),
            )
        }
    }
}
