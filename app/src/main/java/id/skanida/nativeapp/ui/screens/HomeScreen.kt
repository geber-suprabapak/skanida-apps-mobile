package id.skanida.nativeapp.ui.screens

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
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
import id.skanida.nativeapp.data.model.DashboardAttendance
import id.skanida.nativeapp.data.model.DashboardData
import id.skanida.nativeapp.data.model.localizePrimaryActionReason
import id.skanida.nativeapp.domain.workflow.ID_LOCALE
import id.skanida.nativeapp.domain.workflow.PrecheckState
import id.skanida.nativeapp.domain.workflow.ScheduleTimelineState
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
import id.skanida.nativeapp.ui.theme.SkanidaPalette
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

private val SHORT_MONTH_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM", ID_LOCALE)
private const val MINUTE_MS = 60_000L
private const val SECOND_MS = 1_000L

@Immutable
private data class PassBadgeSpec(val label: String, val background: Color, val icon: ImageVector)

@Immutable
private data class PassCtaSpec(
    val title: String,
    val subtitle: String,
    val iconVector: ImageVector? = null,
    @param:DrawableRes val iconDrawable: Int? = null,
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
    val serverOffsetMs = model.serverOffsetMs

    // Minute-aligned clock drives greeting, date label, and schedule timeline without 1 Hz full-screen recomposition.
    var minuteEpochMs by remember(serverOffsetMs) {
        mutableLongStateOf(System.currentTimeMillis() + serverOffsetMs)
    }
    LaunchedEffect(serverOffsetMs) {
        while (true) {
            val synced = System.currentTimeMillis() + serverOffsetMs
            minuteEpochMs = synced
            val delayUntilNextMinute = MINUTE_MS - (synced % MINUTE_MS)
            delay(delayUntilNextMinute.coerceIn(SECOND_MS, MINUTE_MS))
        }
    }

    val minuteInstant = remember(minuteEpochMs / MINUTE_MS) { Instant.ofEpochMilli(minuteEpochMs) }
    val greeting = remember(minuteInstant) {
        wibGreeting(minuteInstant).lowercase(ID_LOCALE).replaceFirstChar { it.uppercase() }
    }
    val fullDateLabel = remember(minuteInstant) {
        formatFullDateWib(minuteInstant).replaceFirstChar { it.uppercase() }
    }

    val displayName = remember(profile?.fullName) {
        profile?.fullName?.takeIf { it.isNotBlank() } ?: "Siswa"
    }
    val firstName = remember(profile?.fullName) { firstNameFrom(profile?.fullName) }
    val identityLine = remember(profile?.className, profile?.nis) {
        listOfNotNull(
            profile?.className?.takeIf { it.isNotBlank() },
            profile?.nis?.takeIf { it.isNotBlank() }?.let { "NIS $it" },
        ).joinToString(" • ")
    }

    val att = data?.attendance
    val isLateCheckIn = remember(att, data?.schedule?.endCheckInAt) {
        if (att == null) {
            false
        } else {
            val lateByStatus = att.explicitCheckInStatus.equals("Terlambat", ignoreCase = true) ||
                att.todayStatus.equals("late", ignoreCase = true)
            val checkInInstant = parseTimestampToInstant(att.checkInTime)
            val endCheckInInstant = parseTimestampToInstant(data?.schedule?.endCheckInAt)
            val lateByClock = checkInInstant != null &&
                endCheckInInstant != null &&
                checkInInstant.isAfter(endCheckInInstant)
            lateByStatus || lateByClock
        }
    }

    val checkInFormatted = remember(att?.checkInTime) { att?.checkInTime?.let { formatTimeWib(it, "--:--") } }
    val checkOutFormatted = remember(att?.checkOutTime) { att?.checkOutTime?.let { formatTimeWib(it, "--:--") } }

    val badge = remember(data, att, isLateCheckIn) { resolvePassBadge(data, att, isLateCheckIn) }
    val ctaSpec = resolvePassCta(
        model = model,
        data = data,
        checkInFormatted = checkInFormatted,
        checkOutFormatted = checkOutFormatted,
        onStartAttendance = onStartAttendance,
        onStartEnrollment = onStartEnrollment,
    )

    val timeline = remember(data?.schedule, att, minuteInstant) {
        computeScheduleTimeline(data?.schedule, att, minuteInstant)
    }
    val monthSummary = remember(model.currentMonthStats) {
        computeMonthlyAttendanceSummary(model.currentMonthStats)
    }
    val shortMonthLabel = remember(minuteInstant) {
        minuteInstant.atZone(id.skanida.nativeapp.domain.workflow.WIB).toLocalDate()
            .format(SHORT_MONTH_FORMATTER)
            .replaceFirstChar { it.uppercase() }
    }
    val passGradient = remember(tokens.passTop, tokens.passBottom) {
        Brush.verticalGradient(listOf(tokens.passTop, tokens.passBottom))
    }

    PullToRefreshBox(
        isRefreshing = model.refreshing,
        onRefresh = { model.refresh(asPullRefresh = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        SkanidaScrollScreen {
            HomeHeaderStrip(greeting = greeting, firstName = firstName)

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                color = tokens.passTop,
                shadowElevation = if (tokens.isDark) 0.dp else 5.dp,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(passGradient),
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
                                Surface(shape = RoundedCornerShape(999.dp), color = badge.background) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                    ) {
                                        Icon(
                                            imageVector = badge.icon,
                                            contentDescription = null,
                                            tint = Color.White,
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Text(
                                            text = badge.label,
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
                                    text = fullDateLabel,
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = Color.White.copy(alpha = 0.9f),
                                )
                                LiveWibClock(serverOffsetMs = serverOffsetMs, goldColor = tokens.gold)
                            }
                        }

                        PassActionDock(
                            checkInFormatted = checkInFormatted,
                            checkOutFormatted = checkOutFormatted,
                            hasCheckedIn = att?.hasCheckedIn == true,
                            hasCheckedOut = att?.hasCheckedOut == true,
                            ctaSpec = ctaSpec,
                        )
                    }
                }
            }

            HomeBentoRow(
                timeline = timeline,
                hasStats = model.currentMonthStats != null && monthSummary.effectiveDays > 0,
                monthPercent = monthSummary.percent,
                monthRate = monthSummary.rate,
                attendedDays = monthSummary.attendedDays,
                effectiveDays = monthSummary.effectiveDays,
                shortMonthLabel = shortMonthLabel,
                enabled = !model.criticalSubmissionInFlight,
                onOpenHistory = { model.navigate(Page.HISTORY) },
            )

            LeaveShortcutCard(
                enabled = !model.criticalSubmissionInFlight,
                onClick = { model.navigate(Page.LEAVE) },
            )
        }
    }
}

/**
 * Isolated 1 Hz ticker leaf composable so only the HH:mm:ss text redraws every second.
 */
@Composable
private fun LiveWibClock(serverOffsetMs: Long, goldColor: Color) {
    var clockText by remember(serverOffsetMs) {
        mutableStateOf(formatClockWib(Instant.ofEpochMilli(System.currentTimeMillis() + serverOffsetMs)))
    }
    LaunchedEffect(serverOffsetMs) {
        while (true) {
            val synced = System.currentTimeMillis() + serverOffsetMs
            clockText = formatClockWib(Instant.ofEpochMilli(synced))
            val delayMs = SECOND_MS - (synced % SECOND_MS)
            delay(delayMs.coerceIn(50L, SECOND_MS))
        }
    }
    Row(
        modifier = Modifier.graphicsLayer {},
        verticalAlignment = Alignment.Bottom,
    ) {
        Text(
            text = clockText,
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
            color = goldColor,
            modifier = Modifier.padding(bottom = 6.dp, start = 4.dp),
        )
    }
}

@Composable
private fun HomeHeaderStrip(greeting: String, firstName: String) {
    val tokens = LocalSkanidaColors.current
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
}

@Composable
private fun PassActionDock(
    checkInFormatted: String?,
    checkOutFormatted: String?,
    hasCheckedIn: Boolean,
    hasCheckedOut: Boolean,
    ctaSpec: PassCtaSpec,
) {
    val tokens = LocalSkanidaColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(tokens.passDock.copy(alpha = 0.65f))
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            PunchTimeColumn(
                label = "MASUK",
                value = checkInFormatted,
                completed = hasCheckedIn,
                alignment = Alignment.Start,
            )
            PunchTimeColumn(
                label = "PULANG",
                value = checkOutFormatted,
                completed = hasCheckedOut,
                alignment = Alignment.End,
            )
        }

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .clickable(enabled = ctaSpec.enabled, role = Role.Button, onClick = ctaSpec.onClick),
            shape = RoundedCornerShape(16.dp),
            color = if (ctaSpec.enabled || hasCheckedOut) Color.White else Color.White.copy(alpha = 0.92f),
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
                    when {
                        ctaSpec.isChecking -> CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = ctaSpec.iconTint,
                            strokeWidth = 2.5.dp,
                        )
                        ctaSpec.iconDrawable != null -> Icon(
                            painter = painterResource(ctaSpec.iconDrawable),
                            contentDescription = null,
                            tint = ctaSpec.iconTint,
                            modifier = Modifier.size(22.dp),
                        )
                        ctaSpec.iconVector != null -> Icon(
                            imageVector = ctaSpec.iconVector,
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
                        color = SkanidaPalette.InkLight,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = ctaSpec.subtitle,
                        fontFamily = ManropeFontFamily,
                        fontSize = 11.sp,
                        color = SkanidaPalette.InkMutedLight,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (ctaSpec.isChecking) {
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = SkanidaPalette.ErrorTintLight,
                    ) {
                        Text(
                            text = "Batal",
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = SkanidaPalette.ErrorLight,
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

@Composable
private fun PunchTimeColumn(label: String, value: String?, completed: Boolean, alignment: Alignment.Horizontal) {
    val tokens = LocalSkanidaColors.current
    Column(horizontalAlignment = alignment, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = label,
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
                text = value ?: "--:--",
                fontFamily = JetBrainsMonoFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
                color = if (value != null) Color.White else Color.White.copy(alpha = 0.68f),
            )
            if (completed) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = SkanidaPalette.SuccessDark,
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}

@Composable
private fun HomeBentoRow(
    timeline: ScheduleTimelineState,
    hasStats: Boolean,
    monthPercent: Int,
    monthRate: Float,
    attendedDays: Int,
    effectiveDays: Int,
    shortMonthLabel: String,
    enabled: Boolean,
    onOpenHistory: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
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
                Spacer(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(16.dp)
                        .drawWithCache {
                            val cy = size.height / 2f
                            val strokeH = 6.dp.toPx()
                            val startX = 4.dp.toPx()
                            val endX = size.width - 4.dp.toPx()
                            val outerRadius = 6.5.dp.toPx()
                            val innerRadius = 2.8.dp.toPx()
                            val clamped = timeline.progress.coerceIn(0f, 1f)
                            val nowX = startX + (endX - startX) * clamped
                            val trackColor = tokens.muted
                            val activeColor = tokens.success.content
                            val knobColor = if (timeline.isCompleted) tokens.success.content else tokens.biometricBlue
                            onDrawBehind {
                                drawLine(trackColor, Offset(startX, cy), Offset(endX, cy), strokeH, StrokeCap.Round)
                                if (clamped > 0f) {
                                    drawLine(activeColor, Offset(startX, cy), Offset(nowX, cy), strokeH, StrokeCap.Round)
                                    drawCircle(knobColor, outerRadius, Offset(nowX, cy))
                                    drawCircle(Color.White, innerRadius, Offset(nowX, cy))
                                }
                            }
                        },
                )
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

        val historyA11y = if (hasStats) {
            "Kehadiran $shortMonthLabel $monthPercent persen, $attendedDays dari $effectiveDays hari aktif. Ketuk untuk lihat riwayat."
        } else {
            "Riwayat kehadiran bulan ini belum tersedia. Ketuk untuk lihat kalender."
        }
        Surface(
            modifier = Modifier
                .weight(0.88f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(22.dp))
                .semantics(mergeDescendants = true) { contentDescription = historyA11y }
                .clickable(enabled = enabled, role = Role.Button, onClick = onOpenHistory),
            shape = RoundedCornerShape(22.dp),
            color = tokens.card,
            border = BorderStroke(1.dp, tokens.border),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .clearAndSetSemantics {}
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                AttendanceArcRing(
                    percent = if (hasStats) monthRate else 0f,
                    ringColor = tokens.success.content,
                    trackColor = tokens.muted,
                    textColor = tokens.foreground,
                    labelOverride = if (hasStats) "$monthPercent%" else "—",
                )
                Spacer(Modifier.height(8.dp))
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (hasStats) "$shortMonthLabel · $monthPercent%" else "Riwayat",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = tokens.foreground,
                    )
                    Text(
                        text = if (hasStats) "$attendedDays/$effectiveDays hari aktif" else "Lihat kalender",
                        fontFamily = JetBrainsMonoFontFamily,
                        fontSize = 10.sp,
                        color = tokens.mutedForeground,
                    )
                }
            }
        }
    }
}

@Composable
private fun LeaveShortcutCard(enabled: Boolean, onClick: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
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

private fun resolvePassBadge(data: DashboardData?, att: DashboardAttendance?, isLateCheckIn: Boolean): PassBadgeSpec {
    val needsFaceEnrollment = data != null && data.face.isServerHealthy && !data.face.isEnrolled
    val serverUnhealthy = data != null && !data.face.isServerHealthy
    return when {
        data == null -> PassBadgeSpec("Sinkronisasi", SkanidaPalette.PassBadgeCobalt, Icons.Default.Refresh)
        serverUnhealthy -> PassBadgeSpec("Server Offline", SkanidaPalette.PassBadgeWarning, Icons.Default.Warning)
        needsFaceEnrollment -> PassBadgeSpec("Perlu Daftar", SkanidaPalette.PassBadgeWarning, Icons.Default.Warning)
        att?.hasCheckedOut == true -> PassBadgeSpec("Lengkap", SkanidaPalette.PassBadgeSuccess, Icons.Default.CheckCircle)
        att?.todayStatus.equals("present", ignoreCase = true) ->
            if (isLateCheckIn) {
                PassBadgeSpec("Terlambat", SkanidaPalette.PassBadgeWarning, Icons.Default.Warning)
            } else {
                PassBadgeSpec("Hadir", SkanidaPalette.PassBadgeSuccess, Icons.Default.CheckCircle)
            }
        att?.todayStatus.equals("late", ignoreCase = true) ->
            PassBadgeSpec("Terlambat", SkanidaPalette.PassBadgeWarning, Icons.Default.Warning)
        att?.todayStatus.equals("leave", ignoreCase = true) ->
            if (data.permit.activeCategory.equals("sakit", ignoreCase = true)) {
                PassBadgeSpec("Sakit", SkanidaPalette.PassBadgeSick, Icons.Default.CheckCircle)
            } else {
                PassBadgeSpec("Izin", SkanidaPalette.PassBadgeInfo, Icons.Default.CheckCircle)
            }
        att?.todayStatus.equals("absent", ignoreCase = true) ->
            PassBadgeSpec("Alpha", SkanidaPalette.PassBadgeError, Icons.Default.Warning)
        else -> PassBadgeSpec("Belum Masuk", SkanidaPalette.PassBadgeCobalt, Icons.Default.CheckCircle)
    }
}

private fun resolvePassCta(
    model: MainViewModel,
    data: DashboardData?,
    checkInFormatted: String?,
    checkOutFormatted: String?,
    onStartAttendance: () -> Unit,
    onStartEnrollment: () -> Unit,
): PassCtaSpec {
    val att = data?.attendance
    val isCheckingAttendance = model.precheckState is PrecheckState.Checking
    val busy = model.busy
    val criticalInFlight = model.criticalSubmissionInFlight
    val needsFaceEnrollment = data != null && data.face.isServerHealthy && !data.face.isEnrolled
    val serverUnhealthy = data != null && !data.face.isServerHealthy
    return when {
        isCheckingAttendance -> PassCtaSpec(
            title = "Memeriksa lokasi & jadwal...",
            subtitle = "Kamera akan terbuka otomatis",
            iconDrawable = R.drawable.ic_face_scan,
            iconBg = SkanidaPalette.CobaltTintLight,
            iconTint = SkanidaPalette.CobaltOnTintLight,
            enabled = !criticalInFlight,
            isChecking = true,
            onClick = model::cancelAttendancePrecheck,
        )
        data == null -> PassCtaSpec(
            title = if (busy) "Memuat Data Presensi..." else "Muat Ulang Data",
            subtitle = model.dashboardError ?: "Tarik ke bawah atau ketuk untuk sinkronisasi",
            iconVector = Icons.Default.Refresh,
            iconBg = SkanidaPalette.CobaltTintLight,
            iconTint = SkanidaPalette.CobaltOnTintLight,
            enabled = !busy,
            onClick = { model.refresh() },
        )
        serverUnhealthy -> PassCtaSpec(
            title = "Cek Ulang Server",
            subtitle = data.face.message.ifBlank { "Layanan verifikasi wajah belum siap" },
            iconVector = Icons.Default.Warning,
            iconBg = SkanidaPalette.WarningTintLight,
            iconTint = SkanidaPalette.WarningLight,
            enabled = !busy,
            onClick = { model.refresh() },
        )
        needsFaceEnrollment -> PassCtaSpec(
            title = "Daftarkan Wajah",
            subtitle = "Ambil 10 sampel wajah untuk presensi",
            iconDrawable = R.drawable.ic_face_scan,
            iconBg = SkanidaPalette.WarningTintLight,
            iconTint = SkanidaPalette.WarningLight,
            enabled = !busy,
            onClick = onStartEnrollment,
        )
        att?.hasCheckedOut == true -> PassCtaSpec(
            title = "Presensi Hari Ini Selesai",
            subtitle = "Masuk ${checkInFormatted ?: "--:--"} · Pulang ${checkOutFormatted ?: "--:--"} WIB",
            iconVector = Icons.Default.CheckCircle,
            iconBg = SkanidaPalette.SuccessTintLight,
            iconTint = SkanidaPalette.SuccessLight,
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
                iconDrawable = R.drawable.ic_face_scan,
                iconBg = SkanidaPalette.CobaltTintLight,
                iconTint = SkanidaPalette.CobaltOnTintLight,
                enabled = !criticalInFlight,
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
                iconDrawable = R.drawable.ic_face_scan,
                iconBg = SkanidaPalette.SurfaceMutedLight,
                iconTint = SkanidaPalette.InkMutedLight,
                enabled = false,
                onClick = {},
            )
        }
    }
}
