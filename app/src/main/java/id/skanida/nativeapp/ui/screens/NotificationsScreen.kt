package id.skanida.nativeapp.ui.screens

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.R
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

private val NOTIF_TOP_SHAPE = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp)
private val NOTIF_MIDDLE_SHAPE = RoundedCornerShape(6.dp)
private val NOTIF_BOTTOM_SHAPE = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp)

@Composable
fun NotificationsScreen(model: MainViewModel, onToggleMaster: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val prefs = model.notificationPrefs
    val masterOn = model.notificationsEnabled

    SkanidaScrollScreen {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .toggleable(
                    value = masterOn,
                    enabled = !model.busy,
                    role = Role.Switch,
                    onValueChange = { onToggleMaster() },
                ),
            shape = RoundedCornerShape(22.dp),
            color = tokens.card,
            border = BorderStroke(1.dp, tokens.border),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
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
                    onCheckedChange = null,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = tokens.primaryButtonContainer,
                        uncheckedThumbColor = tokens.mutedForeground,
                        uncheckedTrackColor = tokens.muted,
                        uncheckedBorderColor = tokens.mutedForeground.copy(alpha = 0.45f),
                    ),
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
                shape = NOTIF_TOP_SHAPE,
            )
            NotificationToggleRow(
                title = "Pengingat Presensi Pulang",
                subtitle = "Kabar saat sesi presensi pulang mulai dibuka",
                checked = masterOn && prefs.checkOut,
                enabled = masterOn && !model.busy,
                onCheckedChange = { model.updateNotificationPrefs(prefs.copy(checkOut = it)) },
                shape = NOTIF_MIDDLE_SHAPE,
            )
            NotificationToggleRow(
                title = "Pembaruan Status Perizinan",
                subtitle = "Kabar langsung saat izin disetujui atau ditolak",
                checked = masterOn && prefs.permitUpdates,
                enabled = masterOn && !model.busy,
                onCheckedChange = { model.updateNotificationPrefs(prefs.copy(permitUpdates = it)) },
                shape = NOTIF_BOTTOM_SHAPE,
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
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .toggleable(
                value = checked,
                enabled = enabled,
                role = Role.Switch,
                onValueChange = onCheckedChange,
            ),
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
                onCheckedChange = null,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = tokens.primaryButtonContainer,
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
