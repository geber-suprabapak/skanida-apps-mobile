package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.R
import id.skanida.nativeapp.domain.workflow.ID_LOCALE
import id.skanida.nativeapp.domain.workflow.InputValidation
import id.skanida.nativeapp.ui.components.MediaSourcePickerRow
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.components.StatusBadge
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

@Immutable
private data class LeaveCategoryOption(val key: String, val title: String, val subtitle: String)

private val LEAVE_CATEGORIES = listOf(
    LeaveCategoryOption("sakit", "Sakit", "Surat dokter"),
    LeaveCategoryOption("pergi", "Izin (Pergi)", "Urusan keluarga"),
)

private val DASHED_UPLOAD_EFFECT = PathEffect.dashPathEffect(floatArrayOf(12f, 10f))

@Composable
fun LeaveScreen(model: MainViewModel, onPickGallery: () -> Unit, onOpenCamera: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val trimmedLength = model.leaveDescription.trim().length
    val noteOk = trimmedLength in InputValidation.MIN_LEAVE_DESCRIPTION..InputValidation.MAX_LEAVE_DESCRIPTION
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
                    LEAVE_CATEGORIES.forEach { option ->
                        val selected = model.leaveCategory == option.key
                        val isSakit = option.key == "sakit"
                        val accent = if (isSakit) tokens.sick.content else tokens.info.content
                        val tint = if (isSakit) tokens.sick.container else tokens.info.container
                        val iconRes = if (isSakit) R.drawable.ic_medical else R.drawable.ic_work
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(20.dp))
                                .selectable(
                                    selected = selected,
                                    enabled = !model.busy,
                                    role = Role.RadioButton,
                                    onClick = { model.leaveCategory = option.key },
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
                                    text = option.title,
                                    fontFamily = ManropeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = tokens.foreground,
                                )
                                Text(
                                    text = option.subtitle,
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
                        onValueChange = { model.leaveDescription = it.take(InputValidation.MAX_LEAVE_DESCRIPTION) },
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
                            .heightIn(min = 112.dp),
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
                            text = "${model.leaveDescription.length}/${InputValidation.MAX_LEAVE_DESCRIPTION}",
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
                        val sizeLabel = remember(model.attachmentSizeBytes) {
                            val sizeKb = model.attachmentSizeBytes / 1024.0
                            if (sizeKb >= 1024.0) {
                                String.format(ID_LOCALE, "%.2f MB", sizeKb / 1024.0)
                            } else {
                                "${sizeKb.toInt()} KB"
                            }
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
                                .background(tokens.surfaceTinted)
                                .drawWithCache {
                                    val cornerRadius = CornerRadius(16.dp.toPx())
                                    val stroke = Stroke(width = 1.5.dp.toPx(), pathEffect = DASHED_UPLOAD_EFFECT)
                                    val borderColor = tokens.border
                                    onDrawBehind {
                                        drawRoundRect(color = borderColor, cornerRadius = cornerRadius, style = stroke)
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
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

                    MediaSourcePickerRow(
                        enabled = !model.busy,
                        onPickGallery = onPickGallery,
                        onOpenCamera = onOpenCamera,
                    )
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
                        .heightIn(min = 54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (tokens.isDark) tokens.primaryButtonContainer else tokens.passTop,
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
