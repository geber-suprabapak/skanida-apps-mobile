package id.skanida.nativeapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
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
import id.skanida.nativeapp.ui.components.DestructiveActionButton
import id.skanida.nativeapp.ui.components.GuillocheOverlay
import id.skanida.nativeapp.ui.components.SettingsGroupRow
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.components.UserAvatar
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

private val THEME_OPTIONS = listOf("system" to "Sistem", "light" to "Terang", "dark" to "Gelap")
private val TOP_GROUP_SHAPE = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 6.dp)
private val BOTTOM_GROUP_SHAPE = RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp, bottomStart = 22.dp, bottomEnd = 22.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(model: MainViewModel, onLogoutClick: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val profile = model.profile
    val displayName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Akun Siswa"
    val displayId = profile?.nis?.takeIf { it.isNotBlank() } ?: model.identity.userId
    val subtitleLine = remember(profile?.className, profile?.email) {
        listOfNotNull(
            profile?.className?.takeIf { it.isNotBlank() },
            profile?.email?.takeIf { it.isNotBlank() },
        ).joinToString(" • ")
    }
    val miniPassGradient = remember(tokens.passTop, tokens.passBottom) {
        Brush.linearGradient(listOf(tokens.passTop, tokens.passBottom))
    }

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
                        .background(miniPassGradient),
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
                                    .heightIn(min = 38.dp)
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
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
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
                                        modifier = Modifier.size(13.dp),
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
                    shape = TOP_GROUP_SHAPE,
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
                    shape = BOTTOM_GROUP_SHAPE,
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
                    THEME_OPTIONS.forEach { (value, label) ->
                        val selected = model.theme == value
                        val activeBg = if (tokens.isDark) tokens.cobaltTint else tokens.card
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 44.dp)
                                .clip(RoundedCornerShape(11.dp))
                                .background(if (selected) activeBg else Color.Transparent)
                                .then(
                                    if (selected && tokens.isDark) {
                                        Modifier.border(1.dp, tokens.biometricBlue.copy(alpha = 0.55f), RoundedCornerShape(11.dp))
                                    } else {
                                        Modifier
                                    },
                                )
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
                                color = when {
                                    selected && tokens.isDark -> tokens.cobaltOnTint
                                    selected -> tokens.foreground
                                    else -> tokens.mutedForeground
                                },
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
