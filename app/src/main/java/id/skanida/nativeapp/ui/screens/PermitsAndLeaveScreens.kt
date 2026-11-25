package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.R
import id.skanida.nativeapp.data.model.PermitRecord
import id.skanida.nativeapp.domain.workflow.ID_LOCALE
import id.skanida.nativeapp.domain.workflow.formatAttendanceDateLabel
import id.skanida.nativeapp.domain.workflow.formatDateKeyWib
import id.skanida.nativeapp.domain.workflow.formatDateTimeWib
import id.skanida.nativeapp.ui.components.KeyValueRow
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.SkanidaLazyScreen
import id.skanida.nativeapp.ui.components.StatusBadge
import id.skanida.nativeapp.ui.components.statusTokenFor
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

private const val MAX_DAILY_SUBMISSIONS = 3

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PermitsScreen(model: MainViewModel) {
    val tokens = LocalSkanidaColors.current
    var selectedPermit by remember { mutableStateOf<PermitRecord?>(null) }

    val todayStr = model.today.toString()
    val sortedPermits = remember(model.permits) {
        model.permits.sortedByDescending { it.createdAt }
    }
    val todayPermits = remember(sortedPermits, todayStr) {
        sortedPermits.filter { formatDateKeyWib(it.date) == todayStr }
    }
    val pendingPermits = remember(sortedPermits) {
        sortedPermits.filter { it.approvalStatus == null || it.approvalStatus == "pending" }
    }
    val historyPermits = remember(sortedPermits) {
        sortedPermits.filter { it.approvalStatus != null && it.approvalStatus != "pending" }
    }

    val todayCount = todayPermits.size
    val hasPendingOrApprovedToday = todayPermits.any {
        it.approvalStatus == "pending" || it.approvalStatus == "approved"
    }
    val canSubmit = !model.permitsLoading &&
        model.permitsError == null &&
        todayCount < MAX_DAILY_SUBMISSIONS &&
        !hasPendingOrApprovedToday

    PullToRefreshBox(
        isRefreshing = model.refreshing,
        onRefresh = { model.refresh(asPullRefresh = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        SkanidaLazyScreen(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 92.dp),
            spacedBy = 14.dp,
        ) {
            item(key = "header") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Perizinan",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 26.sp,
                        color = tokens.foreground,
                        modifier = Modifier.semantics { heading() },
                    )
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = if (canSubmit) tokens.cobaltTint else tokens.error.container,
                    ) {
                        Text(
                            text = if (model.permitsError != null) "—" else "$todayCount/$MAX_DAILY_SUBMISSIONS kuota hari ini",
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = if (canSubmit) tokens.cobaltOnTint else tokens.error.content,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }
            }

            if (model.permitsError != null) {
                item(key = "error") {
                    SkanidaCard(
                        containerColor = tokens.error.container,
                        borderColor = tokens.error.border,
                    ) {
                        Text(
                            text = model.permitsError.orEmpty(),
                            fontFamily = ManropeFontFamily,
                            fontSize = 13.sp,
                            color = tokens.error.content,
                        )
                        SecondaryActionButton(
                            text = "Coba Lagi",
                            onClick = { model.refresh() },
                        )
                    }
                }
            }

            if (!canSubmit && !model.permitsLoading && model.permitsError == null) {
                item(key = "quota-note") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = tokens.surfaceTinted,
                        border = BorderStroke(1.dp, tokens.border),
                    ) {
                        Text(
                            text = if (hasPendingOrApprovedToday) {
                                "Kamu sudah memiliki pengajuan izin aktif untuk hari ini."
                            } else {
                                "Batas maksimal $MAX_DAILY_SUBMISSIONS pengajuan izin hari ini telah tercapai."
                            },
                            fontFamily = ManropeFontFamily,
                            fontSize = 12.sp,
                            color = tokens.mutedForeground,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                        )
                    }
                }
            }

            items(pendingPermits, key = { it.id }) { pending ->
                PendingPermitCard(
                    permit = pending,
                    onClick = { selectedPermit = pending },
                )
            }

            if (sortedPermits.isEmpty() && !model.permitsLoading && model.permitsError == null) {
                item(key = "empty") {
                    SkanidaCard(padding = PaddingValues(28.dp)) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(tokens.muted),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Default.DateRange,
                                    contentDescription = null,
                                    tint = tokens.mutedForeground,
                                    modifier = Modifier.size(28.dp),
                                )
                            }
                            Text(
                                text = "Belum ada pengajuan izin",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = tokens.foreground,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                text = "Jika berhalangan hadir karena sakit atau urusan pribadi, ajukan surat bukti langsung dari sini.",
                                fontFamily = ManropeFontFamily,
                                fontSize = 13.sp,
                                lineHeight = 19.sp,
                                color = tokens.mutedForeground,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }

            if (historyPermits.isNotEmpty()) {
                item(key = "history-label") {
                    Text(
                        text = if (pendingPermits.isNotEmpty()) "Riwayat Keputusan" else "Riwayat Pengajuan",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = tokens.foreground,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                items(historyPermits, key = { it.id }) { permit ->
                    PermitHistoryCard(
                        permit = permit,
                        onClick = { selectedPermit = permit },
                    )
                }
            }
        }
    }

    selectedPermit?.let { permit ->
        PermitDetailSheet(
            permit = permit,
            onDismiss = { selectedPermit = null },
        )
    }
}

@Composable
private fun PendingPermitCard(permit: PermitRecord, onClick: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val rangeText = formatPermitRange(permit)
    val durationLabel = permit.durationDays?.let { " · $it hr" }.orEmpty()

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        color = tokens.card,
        border = BorderStroke(1.5.dp, tokens.warning.content.copy(alpha = 0.5f)),
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(tokens.warning.container),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            painter = painterResource(
                                if (permit.category.equals("sakit", ignoreCase = true)) R.drawable.ic_medical else R.drawable.ic_work,
                            ),
                            contentDescription = null,
                            tint = tokens.warning.content,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column {
                        Text(
                            text = permit.categoryLabel,
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 16.sp,
                            color = tokens.foreground,
                        )
                        Text(
                            text = "$rangeText$durationLabel",
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 11.sp,
                            color = tokens.mutedForeground,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                StatusBadge(label = "Menunggu", token = tokens.warning)
            }

            Text(
                text = permit.description,
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = tokens.mutedForeground,
            )

            Surface(
                shape = RoundedCornerShape(16.dp),
                color = tokens.surfaceTinted,
                border = BorderStroke(1.dp, tokens.border),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PermitProgressStep("Diajukan", done = true, active = false)
                    Box(Modifier.weight(1f).height(2.dp).padding(horizontal = 6.dp).background(tokens.success.content))
                    PermitProgressStep("Ditinjau", done = false, active = true)
                    Box(Modifier.weight(1f).height(2.dp).padding(horizontal = 6.dp).background(tokens.border))
                    PermitProgressStep("Keputusan", done = false, active = false)
                }
            }
        }
    }
}

@Composable
private fun PermitProgressStep(label: String, done: Boolean, active: Boolean) {
    val tokens = LocalSkanidaColors.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(
                    when {
                        done -> tokens.success.content
                        active -> tokens.warning.content
                        else -> tokens.muted
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (done) {
                Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
            }
        }
        Text(
            text = label,
            fontFamily = ManropeFontFamily,
            fontWeight = if (done || active) FontWeight.Bold else FontWeight.Medium,
            fontSize = 11.sp,
            color = if (done || active) tokens.foreground else tokens.mutedForeground,
        )
    }
}

@Composable
private fun PermitHistoryCard(permit: PermitRecord, onClick: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val isSakit = permit.category.equals("sakit", ignoreCase = true)
    val statusLabel = when (permit.approvalStatus) {
        "approved" -> "Disetujui"
        "rejected" -> "Ditolak"
        else -> "Menunggu"
    }
    val statusToken = statusTokenFor(permit.approvalStatus ?: "pending")

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .clickable(role = Role.Button, onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = tokens.card,
        border = BorderStroke(1.dp, tokens.border),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSakit) tokens.sick.container else tokens.info.container),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(if (isSakit) R.drawable.ic_medical else R.drawable.ic_work),
                        contentDescription = null,
                        tint = if (isSakit) tokens.sick.content else tokens.info.content,
                        modifier = Modifier.size(19.dp),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        text = permit.categoryLabel,
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = tokens.foreground,
                    )
                    Text(
                        text = formatPermitRange(permit),
                        fontFamily = JetBrainsMonoFontFamily,
                        fontSize = 11.sp,
                        color = tokens.mutedForeground,
                    )
                }
                StatusBadge(label = statusLabel, token = statusToken)
            }
            Text(
                text = permit.description,
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = tokens.mutedForeground,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PermitDetailSheet(permit: PermitRecord, onDismiss: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val statusLabel = when (permit.approvalStatus) {
        "approved" -> "Disetujui"
        "rejected" -> "Ditolak"
        else -> "Menunggu"
    }
    val statusToken = statusTokenFor(permit.approvalStatus ?: "pending")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = tokens.card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(start = 20.dp, end = 20.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Detail Pengajuan Izin",
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp,
                    color = tokens.foreground,
                )
                StatusBadge(label = statusLabel, token = statusToken)
            }

            Surface(
                shape = RoundedCornerShape(18.dp),
                color = tokens.surfaceTinted,
                border = BorderStroke(1.dp, tokens.border),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    KeyValueRow("Kategori", permit.categoryLabel)
                    KeyValueRow("Tanggal", formatPermitRange(permit), mono = true)
                    KeyValueRow("Mulai", formatAttendanceDateLabel(permit.requestedStartDate), mono = true)
                    KeyValueRow(
                        "Akhir efektif",
                        permit.effectiveEndDate?.let { formatAttendanceDateLabel(it) } ?: "Belum ditetapkan",
                        mono = permit.effectiveEndDate != null,
                    )
                    KeyValueRow("Durasi", "${permit.durationDays ?: 1} hari", mono = true)
                    KeyValueRow("Diajukan", "${formatDateTimeWib(permit.createdAt)} WIB", mono = true)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Keterangan",
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = tokens.foreground,
                )
                Text(
                    text = permit.description,
                    fontFamily = ManropeFontFamily,
                    fontSize = 13.sp,
                    lineHeight = 20.sp,
                    color = tokens.mutedForeground,
                )
            }

            if (permit.approvalStatus == "rejected" && !permit.rejectionReason.isNullOrBlank()) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = tokens.error.container,
                    border = BorderStroke(1.dp, tokens.error.border),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Alasan Ditolak",
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = tokens.error.content,
                        )
                        Text(
                            text = permit.rejectionReason,
                            fontFamily = ManropeFontFamily,
                            fontSize = 13.sp,
                            color = tokens.error.content,
                        )
                        permit.rejectedAt?.let { rejectedAt ->
                            Text(
                                text = "${formatDateTimeWib(rejectedAt)} WIB",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = tokens.error.content.copy(alpha = 0.85f),
                            )
                        }
                    }
                }
            }

            if (!permit.attachmentUrl.isNullOrBlank()) {
                AsyncImage(
                    model = permit.attachmentUrl,
                    contentDescription = "Foto bukti pengajuan izin",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .border(1.dp, tokens.border, RoundedCornerShape(16.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
        }
    }
}

private fun formatPermitRange(permit: PermitRecord): String {
    val start = formatAttendanceDateLabel(permit.requestedStartDate.ifBlank { permit.date })
    val endRaw = permit.effectiveEndDate ?: permit.originalEndDate
    val end = endRaw?.let { formatAttendanceDateLabel(it) }
    return if (!end.isNullOrBlank() && end != start) "$start – $end" else start
}

@Composable
fun LeaveScreen(model: MainViewModel, onPickGallery: () -> Unit, onOpenCamera: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val trimmedLength = model.leaveDescription.trim().length
    val noteOk = trimmedLength in 10..500
    val hasAttachment = model.attachment != null
    val canSubmit = !model.busy && noteOk && hasAttachment && model.isOnline

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item(key = "categories") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectableGroup(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    listOf(
                        Triple("sakit", "Sakit", "Surat dokter"),
                        Triple("pergi", "Izin (Pergi)", "Urusan keluarga"),
                    ).forEach { (key, title, subtitle) ->
                        val selected = model.leaveCategory == key
                        val accent = if (key == "sakit") tokens.sick.content else tokens.info.content
                        val tint = if (key == "sakit") tokens.sick.container else tokens.info.container
                        val iconRes = if (key == "sakit") R.drawable.ic_medical else R.drawable.ic_work
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(20.dp))
                                .selectable(
                                    selected = selected,
                                    enabled = !model.busy,
                                    role = Role.RadioButton,
                                    onClick = { model.leaveCategory = key },
                                ),
                            shape = RoundedCornerShape(20.dp),
                            color = if (selected) tint else tokens.card,
                            border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) accent else tokens.border),
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(RoundedCornerShape(11.dp))
                                            .background(if (selected) accent.copy(alpha = 0.18f) else tint),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            painter = painterResource(iconRes),
                                            contentDescription = null,
                                            tint = accent,
                                            modifier = Modifier.size(19.dp),
                                        )
                                    }
                                    if (selected) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = accent,
                                            modifier = Modifier.size(20.dp),
                                        )
                                    }
                                }
                                Text(
                                    text = title,
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = tokens.foreground,
                                )
                                Text(
                                    text = subtitle,
                                    fontFamily = ManropeFontFamily,
                                    fontSize = 12.sp,
                                    color = tokens.mutedForeground,
                                )
                            }
                        }
                    }
                }
            }

            item(key = "description") {
                SkanidaCard(cornerRadius = 22.dp, padding = PaddingValues(16.dp), spacedBy = 10.dp) {
                    Text(
                        text = "Keterangan",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = tokens.foreground,
                    )
                    OutlinedTextField(
                        value = model.leaveDescription,
                        onValueChange = { model.leaveDescription = it.take(500) },
                        placeholder = {
                            Text(
                                text = "Tuliskan alasan izin minimal 10 karakter...",
                                fontFamily = ManropeFontFamily,
                                fontSize = 13.sp,
                                color = tokens.mutedForeground,
                            )
                        },
                        enabled = !model.busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(112.dp),
                        shape = RoundedCornerShape(16.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(
                            fontFamily = ManropeFontFamily,
                            color = tokens.foreground,
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = tokens.muted.copy(alpha = 0.55f),
                            unfocusedContainerColor = tokens.muted.copy(alpha = 0.55f),
                            focusedBorderColor = tokens.biometricBlue,
                            unfocusedBorderColor = Color.Transparent,
                        ),
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            text = if (noteOk) "Memenuhi syarat" else "Minimal 10 karakter",
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = if (noteOk) tokens.success.content else tokens.mutedForeground,
                        )
                        Text(
                            text = "${model.leaveDescription.length}/500",
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 12.sp,
                            color = tokens.mutedForeground,
                        )
                    }
                }
            }

            item(key = "attachment") {
                SkanidaCard(cornerRadius = 22.dp, padding = PaddingValues(16.dp), spacedBy = 12.dp) {
                    Text(
                        text = "Foto Bukti Pendukung",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = tokens.foreground,
                    )
                    val file = model.attachment
                    if (file != null) {
                        AsyncImage(
                            model = file,
                            contentDescription = "Foto bukti izin",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .border(1.dp, tokens.border, RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Crop,
                        )
                        val sizeKb = file.length() / 1024.0
                        val sizeLabel = if (sizeKb >= 1024.0) {
                            String.format(ID_LOCALE, "%.2f MB", sizeKb / 1024.0)
                        } else {
                            "${sizeKb.toInt()} KB"
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            StatusBadge(label = "Terlampir · $sizeLabel", token = tokens.success)
                            TextButton(onClick = model::removeAttachment, enabled = !model.busy) {
                                Icon(
                                    painter = painterResource(R.drawable.ic_delete),
                                    contentDescription = null,
                                    tint = tokens.error.content,
                                    modifier = Modifier.size(16.dp),
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    text = "Hapus",
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    color = tokens.error.content,
                                )
                            }
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(104.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(tokens.surfaceTinted),
                            contentAlignment = Alignment.Center,
                        ) {
                            Canvas(Modifier.fillMaxSize()) {
                                drawRoundRect(
                                    color = tokens.border,
                                    cornerRadius = CornerRadius(16.dp.toPx()),
                                    style = Stroke(
                                        width = 1.5.dp.toPx(),
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f)),
                                    ),
                                )
                            }
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(5.dp),
                                modifier = Modifier.padding(horizontal = 16.dp),
                            ) {
                                Icon(
                                    painter = painterResource(R.drawable.ic_upload),
                                    contentDescription = null,
                                    tint = tokens.biometricBlue,
                                    modifier = Modifier.size(26.dp),
                                )
                                Text(
                                    text = "Unggah surat dokter atau bukti pendukung",
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = tokens.foreground,
                                    textAlign = TextAlign.Center,
                                )
                                Text(
                                    text = "JPG/PNG · Maks. 10 MB",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = tokens.mutedForeground,
                                )
                            }
                        }
                    }

                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .clickable(enabled = !model.busy, role = Role.Button, onClick = onPickGallery),
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
                                .clickable(enabled = !model.busy, role = Role.Button, onClick = onOpenCamera),
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
                }
            }
        }

        Surface(color = tokens.card, border = BorderStroke(1.dp, tokens.border)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Button(
                    onClick = model::submitLeave,
                    enabled = canSubmit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (tokens.isDark) tokens.biometricBlue else tokens.passTop,
                        contentColor = Color.White,
                        disabledContainerColor = tokens.muted,
                        disabledContentColor = tokens.mutedForeground,
                    ),
                ) {
                    Text(
                        text = "Kirim Pengajuan Izin",
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
            }
        }
    }
}
