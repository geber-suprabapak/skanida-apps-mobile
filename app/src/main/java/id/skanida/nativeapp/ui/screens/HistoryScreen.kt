package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.data.model.DailyAttendanceRecord
import id.skanida.nativeapp.data.model.formatPermitCategory
import id.skanida.nativeapp.domain.workflow.computeMonthlyAttendanceSummary
import id.skanida.nativeapp.domain.workflow.formatAttendanceDateLabel
import id.skanida.nativeapp.domain.workflow.formatHeaderDateWib
import id.skanida.nativeapp.domain.workflow.formatTimeWib
import id.skanida.nativeapp.ui.components.AttendanceArcRing
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaLazyScreen
import id.skanida.nativeapp.ui.components.StatusBadge
import id.skanida.nativeapp.ui.components.statusTokenFor
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import java.time.LocalDate
import java.time.YearMonth

private val INDONESIAN_MONTHS_SHORT = listOf(
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
)
private val WEEKDAY_LABELS = listOf("Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab")

@Immutable
private data class CalendarDayCell(
    val dayNumber: Int,
    val date: LocalDate,
    val isToday: Boolean,
    val isFuture: Boolean,
    val isSunday: Boolean,
    val record: DailyAttendanceRecord?,
    val accessibilityLabel: String,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    var pickMonth by remember { mutableStateOf(false) }

    val today = remember(model.serverOffsetMs, model.month) { model.today }
    val selectedDateStr = remember(model.selectedDate) { model.selectedDate.toString() }
    val selectedDayRecords = remember(model.records, selectedDateStr) {
        model.records.filter { it.date == selectedDateStr }
    }
    val otherMonthRecords = remember(model.records, selectedDateStr) {
        model.records.filter { it.date != selectedDateStr }
    }
    val summary = remember(model.monthlyStats) {
        computeMonthlyAttendanceSummary(model.monthlyStats)
    }
    val calendarWeeks = remember(model.month, model.records, today) {
        buildCalendarWeeks(model.month, model.records, today)
    }
    val compactMonthLabel = "${INDONESIAN_MONTHS_SHORT[model.month.monthValue - 1]} ${model.month.year}"
    val maxMonth = remember(today) { YearMonth.from(today) }
    val canNextMonth = !model.busy && model.month < maxMonth

    PullToRefreshBox(
        isRefreshing = model.refreshing,
        onRefresh = { model.refresh(asPullRefresh = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        SkanidaLazyScreen(spacedBy = 12.dp) {
            item(key = "header") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Riwayat",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 26.sp,
                        color = tokens.foreground,
                        modifier = Modifier.semantics { heading() },
                    )
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = tokens.card,
                        border = BorderStroke(1.dp, tokens.border),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 2.dp),
                        ) {
                            IconButton(
                                onClick = { model.changeMonth(-1) },
                                enabled = !model.busy,
                                modifier = Modifier.size(44.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                    contentDescription = "Bulan sebelumnya",
                                    tint = tokens.foreground,
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .heightIn(min = 44.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable(enabled = !model.busy, role = Role.Button) { pickMonth = true }
                                    .padding(horizontal = 6.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = compactMonthLabel,
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = tokens.foreground,
                                )
                            }
                            IconButton(
                                onClick = { model.changeMonth(1) },
                                enabled = canNextMonth,
                                modifier = Modifier.size(44.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = "Bulan berikutnya",
                                    tint = if (canNextMonth) tokens.foreground else tokens.mutedForeground.copy(alpha = 0.4f),
                                )
                            }
                        }
                    }
                }
            }

            model.monthlyStats?.let { stats ->
                item(key = "stats") {
                    val hasData = summary.effectiveDays > 0
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(IntrinsicSize.Min),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Surface(
                            modifier = Modifier
                                .weight(0.85f)
                                .fillMaxHeight(),
                            shape = RoundedCornerShape(22.dp),
                            color = tokens.card,
                            border = BorderStroke(1.dp, tokens.border),
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                AttendanceArcRing(
                                    percent = if (hasData) summary.rate else 0f,
                                    ringColor = tokens.success.content,
                                    trackColor = tokens.muted,
                                    textColor = tokens.foreground,
                                    labelOverride = if (hasData) "${summary.percent}%" else "—",
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = if (hasData) "${summary.percent}% Aktif" else "Belum ada",
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = tokens.foreground,
                                )
                                Text(
                                    text = "${summary.attendedDays}/${summary.effectiveDays} hari",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = tokens.mutedForeground,
                                )
                                if (stats.alpha > 0) {
                                    Spacer(Modifier.height(6.dp))
                                    StatusBadge(label = "Alpha ${stats.alpha}", token = tokens.error)
                                }
                            }
                        }
                        Column(
                            modifier = Modifier
                                .weight(1.25f)
                                .fillMaxHeight(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                HistoryStatTile(
                                    "Hadir",
                                    stats.hadir,
                                    tokens.success.content,
                                    tokens.success.container,
                                    Modifier.weight(1f).fillMaxHeight(),
                                )
                                HistoryStatTile(
                                    "Telat",
                                    stats.terlambat,
                                    tokens.warning.content,
                                    tokens.warning.container,
                                    Modifier.weight(1f).fillMaxHeight(),
                                )
                            }
                            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                HistoryStatTile(
                                    "Sakit",
                                    stats.sakit,
                                    tokens.sick.content,
                                    tokens.sick.container,
                                    Modifier.weight(1f).fillMaxHeight(),
                                )
                                HistoryStatTile(
                                    "Izin",
                                    stats.izin,
                                    tokens.info.content,
                                    tokens.info.container,
                                    Modifier.weight(1f).fillMaxHeight(),
                                )
                            }
                        }
                    }
                }
            }

            item(key = "calendar") {
                SkanidaCard(padding = PaddingValues(14.dp), spacedBy = 6.dp) {
                    Row(Modifier.fillMaxWidth()) {
                        WEEKDAY_LABELS.forEach { dayName ->
                            Text(
                                text = dayName,
                                modifier = Modifier.weight(1f),
                                textAlign = TextAlign.Center,
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = if (dayName == "Min") tokens.error.content else tokens.mutedForeground,
                            )
                        }
                    }

                    when {
                        model.historyLoading -> {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator(color = tokens.biometricBlue)
                            }
                        }
                        model.historyError != null -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Text(
                                    text = model.historyError.orEmpty(),
                                    fontFamily = ManropeFontFamily,
                                    fontSize = 13.sp,
                                    color = tokens.error.content,
                                    textAlign = TextAlign.Center,
                                )
                                SecondaryActionButton(
                                    text = "Muat Ulang Riwayat",
                                    onClick = { model.refresh() },
                                )
                            }
                        }
                        else -> {
                            calendarWeeks.forEach { week ->
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    week.forEach { cell ->
                                        if (cell != null) {
                                            CalendarDayTile(
                                                cell = cell,
                                                isSelected = model.selectedDate == cell.date,
                                                onSelect = { model.selectDate(cell.date) },
                                                modifier = Modifier.weight(1f),
                                            )
                                        } else {
                                            Spacer(Modifier.weight(1f).height(46.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item(key = "selected-day") {
                SkanidaCard(cornerRadius = 22.dp, padding = PaddingValues(16.dp)) {
                    val primaryRec = selectedDayRecords.firstOrNull()
                    if (primaryRec != null) {
                        SelectedDayDetailContent(primaryRec)
                        selectedDayRecords.drop(1).forEach { extra ->
                            AttendanceRecordRow(extra)
                        }
                    } else {
                        Text(
                            text = formatHeaderDateWib(model.selectedDate).replaceFirstChar { it.uppercase() },
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = tokens.foreground,
                        )
                        Text(
                            text = if (model.historyLoading) "Memuat riwayat..." else "Tidak ada catatan presensi pada tanggal ini.",
                            fontFamily = ManropeFontFamily,
                            fontSize = 13.sp,
                            color = tokens.mutedForeground,
                        )
                    }
                }
            }

            if (otherMonthRecords.isNotEmpty()) {
                item(key = "other-header") {
                    Text(
                        text = "Catatan Lain Bulan Ini",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = tokens.foreground,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                items(otherMonthRecords, key = { "${it.id}-${it.date}" }) { item ->
                    SkanidaCard(cornerRadius = 20.dp, padding = PaddingValues(15.dp)) {
                        AttendanceRecordRow(item)
                    }
                }
            }

            item(key = "bottom-spacer") {
                Spacer(Modifier.height(6.dp))
            }
        }
    }

    if (pickMonth) {
        IndonesianMonthYearPickerDialog(
            currentMonth = model.month,
            maxMonth = maxMonth,
            onDismiss = { pickMonth = false },
            onSelect = { selectedMonth ->
                model.selectMonth(selectedMonth)
                pickMonth = false
            },
        )
    }
}

private fun buildCalendarWeeks(
    month: YearMonth,
    records: List<DailyAttendanceRecord>,
    today: LocalDate,
): List<List<CalendarDayCell?>> {
    val recordMap = records.associateBy { it.date }
    val offset = month.atDay(1).dayOfWeek.value % 7
    val totalDays = month.lengthOfMonth()
    val rows = (offset + totalDays + 6) / 7
    return List(rows) { row ->
        List(7) { col ->
            val day = row * 7 + col - offset + 1
            if (day in 1..totalDays) {
                val date = month.atDay(day)
                val record = recordMap[date.toString()]
                val statusDesc = record?.let { recordStatusLabel(it) } ?: "Belum ada catatan"
                CalendarDayCell(
                    dayNumber = day,
                    date = date,
                    isToday = date == today,
                    isFuture = date.isAfter(today),
                    isSunday = col == 0,
                    record = record,
                    accessibilityLabel = "${formatHeaderDateWib(date)}, $statusDesc",
                )
            } else {
                null
            }
        }
    }
}

@Composable
private fun CalendarDayTile(cell: CalendarDayCell, isSelected: Boolean, onSelect: () -> Unit, modifier: Modifier = Modifier) {
    val tokens = LocalSkanidaColors.current
    val record = cell.record
    val (fill, dot) = when {
        isSelected -> tokens.primaryButtonContainer to if (record != null) Color.White else Color.Transparent
        record == null -> Color.Transparent to Color.Transparent
        record.status == "absent" -> tokens.error.container to tokens.error.content
        record.status == "sick" -> tokens.sick.container to tokens.sick.content
        record.status == "leave" -> tokens.info.container to tokens.info.content
        record.isLate || record.status == "late" -> tokens.warning.container to tokens.warning.content
        else -> tokens.success.container to tokens.success.content
    }

    Box(
        modifier = modifier
            .height(46.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(fill)
            .then(
                if (cell.isToday && !isSelected) {
                    Modifier.border(1.5.dp, tokens.biometricBlue, RoundedCornerShape(12.dp))
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) {
                contentDescription = cell.accessibilityLabel
                selected = isSelected
            }
            .clickable(enabled = !cell.isFuture, role = Role.Button, onClick = onSelect),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = cell.dayNumber.toString(),
                fontFamily = ManropeFontFamily,
                fontWeight = if (isSelected || record != null || cell.isToday) FontWeight.Bold else FontWeight.Medium,
                fontSize = 13.sp,
                color = when {
                    isSelected -> Color.White
                    cell.isFuture -> tokens.mutedForeground.copy(alpha = 0.48f)
                    cell.isSunday -> tokens.error.content
                    else -> tokens.foreground
                },
            )
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(dot),
            )
        }
    }
}

@Composable
private fun HistoryStatTile(label: String, count: Int, accent: Color, tint: Color, modifier: Modifier = Modifier) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = modifier.semantics(mergeDescendants = true) {
            contentDescription = "$label: $count"
        },
        shape = RoundedCornerShape(16.dp),
        color = tokens.card,
        border = BorderStroke(1.dp, tokens.border),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
                Text(
                    text = label,
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = tokens.mutedForeground,
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(tint)
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text(
                    text = "$count",
                    fontFamily = JetBrainsMonoFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = accent,
                )
            }
        }
    }
}

@Composable
private fun SelectedDayDetailContent(item: DailyAttendanceRecord) {
    val tokens = LocalSkanidaColors.current
    val badgeLabel = recordStatusLabel(item)
    val badgeToken = statusTokenFor(if (item.isLate && item.status == "present") "late" else item.status)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = formatAttendanceDateLabel(item.date),
            fontFamily = ManropeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            color = tokens.foreground,
        )
        StatusBadge(label = badgeLabel, token = badgeToken)
    }

    if (!item.checkInTime.isNullOrBlank() || !item.checkOutTime.isNullOrBlank()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Surface(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                color = tokens.surfaceTinted,
                border = BorderStroke(1.dp, tokens.border),
            ) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Masuk", fontFamily = ManropeFontFamily, fontSize = 11.sp, color = tokens.mutedForeground)
                    Text(
                        text = item.checkInTime?.let { "${formatTimeWib(it)} WIB" } ?: "—",
                        fontFamily = JetBrainsMonoFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = tokens.foreground,
                    )
                }
            }
            Surface(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                color = tokens.surfaceTinted,
                border = BorderStroke(1.dp, tokens.border),
            ) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Pulang", fontFamily = ManropeFontFamily, fontSize = 11.sp, color = tokens.mutedForeground)
                    Text(
                        text = item.checkOutTime?.let { "${formatTimeWib(it)} WIB" } ?: "Belum pulang",
                        fontFamily = JetBrainsMonoFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = if (!item.checkOutTime.isNullOrBlank()) tokens.foreground else tokens.mutedForeground,
                    )
                }
            }
        }
    } else {
        Text(
            text = when {
                item.status == "absent" -> "Tidak hadir pada tanggal ini."
                !item.description.isNullOrBlank() -> item.description
                else -> "Pengajuan izin tercatat."
            },
            fontFamily = ManropeFontFamily,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            color = tokens.mutedForeground,
        )
    }
}

@Composable
private fun IndonesianMonthYearPickerDialog(
    currentMonth: YearMonth,
    maxMonth: YearMonth,
    onDismiss: () -> Unit,
    onSelect: (YearMonth) -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    var selectedYear by remember(currentMonth) { mutableIntStateOf(currentMonth.year) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.card,
        titleContentColor = tokens.foreground,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = { selectedYear -= 1 },
                    enabled = selectedYear > 2020,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Tahun sebelumnya")
                }
                Text(
                    text = selectedYear.toString(),
                    fontFamily = JetBrainsMonoFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = tokens.foreground,
                )
                IconButton(
                    onClick = { selectedYear += 1 },
                    enabled = selectedYear < maxMonth.year,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Tahun berikutnya")
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (row in 0 until 4) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (col in 0 until 3) {
                            val monthNumber = row * 3 + col + 1
                            val ym = YearMonth.of(selectedYear, monthNumber)
                            val disabled = ym.isAfter(maxMonth)
                            val isChosen = ym == currentMonth
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable(enabled = !disabled, role = Role.Button) { onSelect(ym) },
                                shape = RoundedCornerShape(12.dp),
                                color = if (isChosen) tokens.primaryButtonContainer else tokens.muted,
                                border = if (isChosen) null else BorderStroke(1.dp, tokens.border),
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = INDONESIAN_MONTHS_SHORT[monthNumber - 1],
                                        fontFamily = ManropeFontFamily,
                                        fontWeight = if (isChosen) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = when {
                                            isChosen -> Color.White
                                            disabled -> tokens.mutedForeground.copy(alpha = 0.48f)
                                            else -> tokens.foreground
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = tokens.foreground),
            ) {
                Text("Tutup", fontFamily = ManropeFontFamily, fontWeight = FontWeight.SemiBold)
            }
        },
    )
}

private fun recordStatusLabel(item: DailyAttendanceRecord): String = when {
    item.status == "absent" -> "Alpha"
    item.status == "sick" -> "Sakit"
    item.status == "leave" -> formatPermitCategory(item.leaveCategory)
    item.isLate || item.status == "late" -> "Terlambat"
    else -> "Hadir"
}

@Composable
private fun AttendanceRecordRow(item: DailyAttendanceRecord) {
    val tokens = LocalSkanidaColors.current
    val badgeLabel = recordStatusLabel(item)
    val badgeToken = statusTokenFor(if (item.isLate && item.status == "present") "late" else item.status)
    val subtitle = remember(item) {
        when {
            !item.checkInTime.isNullOrBlank() || !item.checkOutTime.isNullOrBlank() ->
                buildString {
                    append("Masuk: ${formatTimeWib(item.checkInTime)}")
                    if (!item.checkOutTime.isNullOrBlank()) {
                        append(" • Pulang: ${formatTimeWib(item.checkOutTime)}")
                    }
                    append(" WIB")
                }
            item.status == "absent" -> "Tidak hadir"
            else -> item.description?.takeIf { it.isNotBlank() } ?: "Pengajuan izin tercatat"
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = formatAttendanceDateLabel(item.date),
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = tokens.foreground,
            )
            Text(
                text = subtitle,
                fontFamily = ManropeFontFamily,
                fontSize = 12.sp,
                color = tokens.mutedForeground,
            )
        }
        StatusBadge(label = badgeLabel, token = badgeToken)
    }
}
