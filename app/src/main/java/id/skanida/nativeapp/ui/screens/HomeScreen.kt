package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.R
import id.skanida.nativeapp.data.model.localizePrimaryActionReason
import id.skanida.nativeapp.domain.workflow.ID_LOCALE
import id.skanida.nativeapp.domain.workflow.PrecheckState
import id.skanida.nativeapp.domain.workflow.computeMonthlyAttendanceSummary
import id.skanida.nativeapp.domain.workflow.computeScheduleTimeline
import id.skanida.nativeapp.domain.workflow.firstNameFrom
import id.skanida.nativeapp.domain.workflow.formatClockWib
import id.skanida.nativeapp.domain.workflow.formatFullDateWib
import id.skanida.nativeapp.domain.workflow.formatTimeWib
import id.skanida.nativeapp.domain.workflow.parseTimestampToInstant
import id.skanida.nativeapp.domain.workflow.wibGreeting
import id.skanida.nativeapp.ui.components.AttendanceArcRing
import id.skanida.nativeapp.ui.components.GuillocheOverlay
import id.skanida.nativeapp.ui.components.SkanidaScrollScreen
import id.skanida.nativeapp.ui.components.UserAvatar
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

private val SHORT_MONTH_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM", ID_LOCALE)

private data class PassCtaSpec(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val iconBg: Color,
    val iconTint: Color,
    val enabled: Boolean,
    val isChecking: Boolean = false,
    val onClick: () -> Unit,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(model: MainViewModel, onStartAttendance: () -> Unit, onStartEnrollment: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val data = model.dashboard
    val profile = data?.profile ?: model.profile

    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis() + model.serverOffsetMs) }
    LaunchedEffect(model.serverOffsetMs) {
        while (true) {
            nowMs = System.currentTimeMillis() + model.serverOffsetMs
            delay(1000L)
        }
    }
    val clockInstant = Instant.ofEpochMilli(nowMs)
    val greeting = wibGreeting(clockInstant).lowercase(ID_LOCALE).replaceFirstChar { it.uppercase() }
    val displayName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Siswa"
    val firstName = firstNameFrom(profile?.fullName)
    val identityLine = listOfNotNull(
        profile?.className?.takeIf { it.isNotBlank() },
        profile?.nis?.takeIf { it.isNotBlank() }?.let { "NIS $it" },
    ).joinToString(" • ")

    val att = data?.attendance
    val checkInInstant = parseTimestampToInstant(att?.checkInTime)
    val endCheckInInstant = parseTimestampToInstant(data?.schedule?.endCheckInAt)
    val isLateCheckIn = att != null && (
        att.explicitCheckInStatus.equals("Terlambat", ignoreCase = true) ||
            att.todayStatus.equals("late", ignoreCase = true) ||
            (checkInInstant != null && endCheckInInstant != null && checkInInstant.isAfter(endCheckInInstant))
        )

    val needsFaceEnrollment = data != null && data.face.isServerHealthy && !data.face.isEnrolled
    val serverUnhealthy = data != null && !data.face.isServerHealthy

    val (badgeLabel, badgeBg, badgeIcon) = when {
        data == null -> Triple("Sinkronisasi", Color(0xFF2563EB), Icons.Default.Refresh)
        serverUnhealthy -> Triple("Server Offline", Color(0xFFD97706), Icons.Default.Warning)
        needsFaceEnrollment -> Triple("Perlu Daftar", Color(0xFFD97706), Icons.Default.Warning)
        att?.hasCheckedOut == true -> Triple("Lengkap", Color(0xFF059669), Icons.Default.CheckCircle)
        att?.todayStatus.equals("present", ignoreCase = true) ->
            if (isLateCheckIn) {
                Triple("Terlambat", Color(0xFFD97706), Icons.Default.Warning)
            } else {
                Triple("Hadir", Color(0xFF10B981), Icons.Default.CheckCircle)
            }
        att?.todayStatus.equals("late", ignoreCase = true) -> Triple("Terlambat", Color(0xFFD97706), Icons.Default.Warning)
        att?.todayStatus.equals("leave", ignoreCase = true) ->
            if (data.permit.activeCategory.equals("sakit", ignoreCase = true)) {
                Triple("Sakit", Color(0xFF7C3AED), Icons.Default.CheckCircle)
            } else {
                Triple("Izin", Color(0xFF0284C7), Icons.Default.CheckCircle)
            }
        att?.todayStatus.equals("absent", ignoreCase = true) -> Triple("Alpha", Color(0xFFDC2626), Icons.Default.Warning)
        else -> Triple("Belum Masuk", Color(0xFF2563EB), Icons.Default.CheckCircle)
    }

    val checkInFormatted = att?.checkInTime?.let { formatTimeWib(it, "--:--") }
    val checkOutFormatted = att?.checkOutTime?.let { formatTimeWib(it, "--:--") }

    val isCheckingAttendance = model.precheckState is PrecheckState.Checking

    val ctaSpec: PassCtaSpec = when {
        isCheckingAttendance -> PassCtaSpec(
            title = "Memeriksa lokasi & jadwal...",
            subtitle = "Kamera akan terbuka otomatis",
            icon = Icons.Default.Face,
            iconBg = Color(0xFFE8F0FF),
            iconTint = Color(0xFF1447CC),
            enabled = !model.criticalSubmissionInFlight,
            isChecking = true,
            onClick = { model.cancelAttendancePrecheck() },
        )
        data == null -> PassCtaSpec(
            title = if (model.busy) "Memuat Data Presensi..." else "Muat Ulang Data",
            subtitle = model.dashboardError ?: "Tarik ke bawah atau ketuk untuk sinkronisasi",
            icon = Icons.Default.Refresh,
            iconBg = Color(0xFFE8F0FF),
            iconTint = Color(0xFF1447CC),
            enabled = !model.busy,
            onClick = { model.refresh() },
        )
        serverUnhealthy -> PassCtaSpec(
            title = "Cek Ulang Server",
            subtitle = data.face.message.ifBlank { "Layanan verifikasi wajah belum siap" },
            icon = Icons.Default.Warning,
            iconBg = Color(0xFFFEF3C7),
            iconTint = Color(0xFFB45309),
            enabled = !model.busy,
            onClick = { model.refresh() },
        )
        needsFaceEnrollment -> PassCtaSpec(
            title = "Daftarkan Wajah",
            subtitle = "Ambil 10 sampel wajah untuk presensi",
            icon = Icons.Default.Face,
            iconBg = Color(0xFFFEF3C7),
            iconTint = Color(0xFFB45309),
            enabled = !model.busy,
            onClick = onStartEnrollment,
        )
        att?.hasCheckedOut == true -> PassCtaSpec(
            title = "Presensi Hari Ini Selesai",
            subtitle = "Masuk ${checkInFormatted ?: "--:--"} · Pulang ${checkOutFormatted ?: "--:--"} WIB",
            icon = Icons.Default.CheckCircle,
            iconBg = Color(0xFFE2F6EE),
            iconTint = Color(0xFF0A8F62),
            enabled = false,
            onClick = {},
        )
        data.primaryAction.allowed -> {
            val sub = when (data.primaryAction.type) {
                "check_out" -> {
                    val outStart = data.schedule?.startCheckOutAt?.let { formatTimeWib(it) }
                    if (outStart != null) "Dibuka $outStart WIB · Verifikasi wajah" else "Verifikasi wajah & GPS"
                }
                else -> "Sesi aktif · Verifikasi wajah & GPS"
            }
            PassCtaSpec(
                title = data.primaryAction.label,
                subtitle = sub,
                icon = Icons.Default.Face,
                iconBg = Color(0xFFE8F0FF),
                iconTint = Color(0xFF1447CC),
                enabled = !model.criticalSubmissionInFlight,
                onClick = onStartAttendance,
            )
        }
        else -> {
            val reason = localizePrimaryActionReason(
                data.primaryAction.reasonCode,
                data.primaryAction.reasonMessage,
            ) ?: "Presensi belum tersedia saat ini"
            PassCtaSpec(
                title = data.primaryAction.label,
                subtitle = reason,
                icon = Icons.Default.Face,
                iconBg = Color(0xFFE8EEF7),
                iconTint = Color(0xFF586680),
                enabled = false,
                onClick = {},
            )
        }
    }

    val timeline = remember(data?.schedule, att, nowMs / 30_000L) {
        computeScheduleTimeline(data?.schedule, att, clockInstant)
    }
    val monthSummary = remember(model.currentMonthStats) {
        computeMonthlyAttendanceSummary(model.currentMonthStats)
    }
    val shortMonthLabel = remember(model.today) {
        model.today.format(SHORT_MONTH_FORMATTER).replaceFirstChar { it.uppercase() }
    }

    PullToRefreshBox(
        isRefreshing = model.refreshing,
        onRefresh = { model.refresh(asPullRefresh = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        SkanidaScrollScreen {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, tokens.border),
                    modifier = Modifier.size(38.dp),
                ) {
                    Image(
                        painter = painterResource(R.drawable.skanida_logo),
                        contentDescription = "Logo Skanida Apps",
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(2.dp)
                            .scale(1.45f),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Skanida Apps",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 17.sp,
                        color = tokens.foreground,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text = "$greeting, $firstName",
                        fontFamily = ManropeFontFamily,
                        fontSize = 12.sp,
                        color = tokens.mutedForeground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                color = tokens.passTop,
                shadowElevation = if (tokens.isDark) 0.dp else 5.dp,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(tokens.passTop, tokens.passBottom))),
                ) {
                    GuillocheOverlay(
                        modifier = Modifier.matchParentSize(),
                        tint = Color.White.copy(alpha = 0.055f),
                        goldAccent = tokens.gold.copy(alpha = 0.25f),
                    )
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                UserAvatar(
                                    url = profile?.avatarUrl,
                                    fallbackName = displayName,
                                    size = 48.dp,
                                    borderColor = tokens.gold.copy(alpha = 0.55f),
                                    containerColor = Color.White.copy(alpha = 0.14f),
                                    modifier = Modifier
                                        .semantics { contentDescription = "Buka profil akun $displayName" }
                                        .clickable(
                                            enabled = !model.criticalSubmissionInFlight,
                                            role = Role.Button,
                                        ) { model.navigate(Page.ACCOUNT) },
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = displayName,
                                        fontFamily = ManropeFontFamily,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 18.sp,
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    if (identityLine.isNotBlank()) {
                                        Text(
                                            text = identityLine,
                                            fontFamily = JetBrainsMonoFontFamily,
                                            fontSize = 11.sp,
                                            color = tokens.passSubtle,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                                Surface(shape = RoundedCornerShape(999.dp), color = badgeBg) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                    ) {
                                        Icon(
                                            imageVector = badgeIcon,
                                            contentDescription = null,
                                            tint = Color.White,
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Text(
                                            text = badgeLabel,
                                            fontFamily = ManropeFontFamily,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 12.sp,
                                            color = Color.White,
                                        )
                                    }
                                }
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    text = formatFullDateWib(clockInstant).replaceFirstChar { it.uppercase() },
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = Color.White.copy(alpha = 0.9f),
                                )
                                Row(verticalAlignment = Alignment.Bottom) {
                                    Text(
                                        text = formatClockWib(clockInstant),
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 36.sp,
                                        letterSpacing = (-1.0).sp,
                                        color = Color.White,
                                        maxLines = 1,
                                        softWrap = false,
                                    )
                                    Text(
                                        text = " WIB",
                                        fontFamily = ManropeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = tokens.gold,
                                        modifier = Modifier.padding(bottom = 6.dp, start = 4.dp),
                                    )
                                }
                            }
                        }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(tokens.passDock.copy(alpha = 0.65f))
                                .padding(horizontal = 18.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        text = "MASUK",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                        color = tokens.passSubtle,
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                    ) {
                                        Text(
                                            text = checkInFormatted ?: "--:--",
                                            fontFamily = JetBrainsMonoFontFamily,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 19.sp,
                                            color = if (checkInFormatted != null) Color.White else Color.White.copy(alpha = 0.52f),
                                        )
                                        if (att?.hasCheckedIn == true) {
                                            Icon(
                                                imageVector = Icons.Default.CheckCircle,
                                                contentDescription = null,
                                                tint = Color(0xFF34D399),
                                                modifier = Modifier.size(15.dp),
                                            )
                                        }
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        text = "PULANG",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                        color = tokens.passSubtle,
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                    ) {
                                        Text(
                                            text = checkOutFormatted ?: "--:--",
                                            fontFamily = JetBrainsMonoFontFamily,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 19.sp,
                                            color = if (checkOutFormatted != null) Color.White else Color.White.copy(alpha = 0.52f),
                                        )
                                        if (att?.hasCheckedOut == true) {
                                            Icon(
                                                imageVector = Icons.Default.CheckCircle,
                                                contentDescription = null,
                                                tint = Color(0xFF34D399),
                                                modifier = Modifier.size(15.dp),
                                            )
                                        }
                                    }
                                }
                            }

                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable(enabled = ctaSpec.enabled, role = Role.Button, onClick = ctaSpec.onClick),
                                shape = RoundedCornerShape(16.dp),
                                color = if (ctaSpec.enabled || att?.hasCheckedOut == true) Color.White else Color.White.copy(alpha = 0.92f),
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
                                            .size(38.dp)
                                            .clip(RoundedCornerShape(11.dp))
                                            .background(ctaSpec.iconBg),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (ctaSpec.isChecking) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(20.dp),
                                                color = ctaSpec.iconTint,
                                                strokeWidth = 2.5.dp,
                                            )
                                        } else {
                                            Icon(
                                                imageVector = ctaSpec.icon,
                                                contentDescription = null,
                                                tint = ctaSpec.iconTint,
                                                modifier = Modifier.size(22.dp),
                                            )
                                        }
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = ctaSpec.title,
                                            fontFamily = ManropeFontFamily,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 15.sp,
                                            color = Color(0xFF0E172A),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Text(
                                            text = ctaSpec.subtitle,
                                            fontFamily = ManropeFontFamily,
                                            fontSize = 11.sp,
                                            color = Color(0xFF5A6780),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                    if (ctaSpec.isChecking) {
                                        Surface(
                                            shape = RoundedCornerShape(999.dp),
                                            color = Color(0xFFFEE2E2),
                                        ) {
                                            Text(
                                                text = "Batal",
                                                fontFamily = ManropeFontFamily,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                                color = Color(0xFFDC2626),
                                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                            )
                                        }
                                    } else if (ctaSpec.enabled) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                            contentDescription = null,
                                            tint = ctaSpec.iconTint,
                                            modifier = Modifier.size(22.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Surface(
                    modifier = Modifier
                        .weight(1.12f)
                        .fillMaxHeight(),
                    shape = RoundedCornerShape(22.dp),
                    color = tokens.card,
                    border = BorderStroke(1.dp, tokens.border),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = "Linimasa",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = tokens.foreground,
                            )
                            Text(
                                text = timeline.statusText,
                                fontFamily = ManropeFontFamily,
                                fontSize = 11.sp,
                                color = tokens.mutedForeground,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.height(14.dp))
                        Canvas(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(16.dp),
                        ) {
                            val cy = size.height / 2f
                            val strokeH = 6.dp.toPx()
                            val startX = 4.dp.toPx()
                            val endX = size.width - 4.dp.toPx()
                            drawLine(tokens.muted, Offset(startX, cy), Offset(endX, cy), strokeH, StrokeCap.Round)
                            if (timeline.progress > 0f) {
                                val nowX = startX + (endX - startX) * timeline.progress.coerceIn(0f, 1f)
                                drawLine(tokens.success.content, Offset(startX, cy), Offset(nowX, cy), strokeH, StrokeCap.Round)
                                drawCircle(
                                    color = if (timeline.isCompleted) tokens.success.content else tokens.biometricBlue,
                                    radius = 6.5.dp.toPx(),
                                    center = Offset(nowX, cy),
                                )
                                drawCircle(Color.White, 2.8.dp.toPx(), Offset(nowX, cy))
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                text = timeline.startLabel,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = tokens.foreground,
                            )
                            Text(
                                text = timeline.endLabel,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = tokens.mutedForeground,
                            )
                        }
                    }
                }

                Surface(
                    modifier = Modifier
                        .weight(0.88f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(22.dp))
                        .clickable(enabled = !model.criticalSubmissionInFlight, role = Role.Button) { model.navigate(Page.HISTORY) },
                    shape = RoundedCornerShape(22.dp),
                    color = tokens.card,
                    border = BorderStroke(1.dp, tokens.border),
                ) {
                    val hasStats = model.currentMonthStats != null && monthSummary.effectiveDays > 0
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        AttendanceArcRing(
                            percent = if (hasStats) monthSummary.rate else 0f,
                            ringColor = tokens.success.content,
                            trackColor = tokens.muted,
                            textColor = tokens.foreground,
                            labelOverride = if (hasStats) "${monthSummary.percent}%" else "—",
                        )
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = if (hasStats) "$shortMonthLabel · ${monthSummary.percent}%" else "Riwayat",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = tokens.foreground,
                            )
                            Text(
                                text = if (hasStats) {
                                    "${monthSummary.attendedDays}/${monthSummary.effectiveDays} hari aktif"
                                } else {
                                    "Lihat kalender"
                                },
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 10.sp,
                                color = tokens.mutedForeground,
                            )
                        }
                    }
                }
            }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .clickable(enabled = !model.criticalSubmissionInFlight, role = Role.Button) { model.navigate(Page.LEAVE) },
                shape = RoundedCornerShape(18.dp),
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
                            .size(36.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(tokens.sick.container),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_medical),
                            contentDescription = null,
                            tint = tokens.sick.content,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Berhalangan hadir?",
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = tokens.foreground,
                        )
                        Text(
                            text = "Ajukan izin sakit atau keperluan resmi",
                            fontFamily = ManropeFontFamily,
                            fontSize = 12.sp,
                            color = tokens.mutedForeground,
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = null,
                        tint = tokens.mutedForeground,
                    )
                }
            }
        }
    }
}
