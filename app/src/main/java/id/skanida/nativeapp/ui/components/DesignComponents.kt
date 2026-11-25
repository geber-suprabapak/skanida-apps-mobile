package id.skanida.nativeapp.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import id.skanida.nativeapp.R
import id.skanida.nativeapp.domain.workflow.initialsFromName
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import id.skanida.nativeapp.ui.theme.StatusColorToken
import kotlin.math.roundToInt

@Composable
fun SkanidaScrollScreen(
    modifier: Modifier = Modifier,
    horizontalPadding: Dp = 16.dp,
    topPadding: Dp = 12.dp,
    bottomPadding: Dp = 18.dp,
    spacedBy: Dp = 14.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 680.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = horizontalPadding,
                    end = horizontalPadding,
                    top = topPadding,
                    bottom = bottomPadding,
                ),
            verticalArrangement = Arrangement.spacedBy(spacedBy),
            content = content,
        )
    }
}

@Composable
fun SkanidaLazyScreen(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    spacedBy: Dp = 14.dp,
    content: LazyListScope.() -> Unit,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter,
    ) {
        LazyColumn(
            modifier = Modifier
                .widthIn(max = 680.dp)
                .fillMaxWidth(),
            contentPadding = contentPadding,
            verticalArrangement = Arrangement.spacedBy(spacedBy),
            content = content,
        )
    }
}

@Composable
fun SkanidaCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    containerColor: Color? = null,
    borderColor: Color? = null,
    padding: PaddingValues = PaddingValues(18.dp),
    spacedBy: Dp = 12.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(cornerRadius),
        color = containerColor ?: tokens.card,
        border = BorderStroke(1.dp, borderColor ?: tokens.border),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(padding),
            verticalArrangement = Arrangement.spacedBy(spacedBy),
            content = content,
        )
    }
}

@Composable
fun GuillocheOverlay(modifier: Modifier = Modifier, tint: Color = Color.White.copy(alpha = 0.055f), goldAccent: Color? = null) {
    Spacer(
        modifier = modifier.drawWithCache {
            val step = 22.dp.toPx()
            val stroke = Stroke(width = 1.dp.toPx())
            val linesPath = Path().apply {
                var offset = -size.height
                while (offset < size.width + size.height) {
                    moveTo(offset, 0f)
                    lineTo(offset + size.height, size.height)
                    offset += step
                }
            }
            val center = Offset(size.width * 0.9f, size.height * 0.14f)
            val r0 = 54.dp.toPx()
            val r1 = 86.dp.toPx()
            val r2 = 120.dp.toPx()
            val firstCircleColor = goldAccent ?: tint

            onDrawBehind {
                drawPath(path = linesPath, color = tint, style = stroke)
                drawCircle(color = firstCircleColor, radius = r0, center = center, style = stroke)
                drawCircle(color = tint, radius = r1, center = center, style = stroke)
                drawCircle(color = tint, radius = r2, center = center, style = stroke)
            }
        },
    )
}

@Composable
fun AttendanceArcRing(
    percent: Float,
    ringColor: Color,
    trackColor: Color,
    textColor: Color,
    labelOverride: String? = null,
    modifier: Modifier = Modifier,
) {
    val clamped = percent.coerceIn(0f, 1f)
    Box(
        modifier = modifier
            .size(54.dp)
            .drawWithCache {
                val strokeWidth = 6.dp.toPx()
                val inset = strokeWidth / 2f
                val topLeft = Offset(inset, inset)
                val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                val stroke = Stroke(strokeWidth, cap = StrokeCap.Round)
                val sweep = 360f * clamped
                onDrawBehind {
                    drawArc(
                        color = trackColor,
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = stroke,
                    )
                    if (sweep > 0f) {
                        drawArc(
                            color = ringColor,
                            startAngle = -90f,
                            sweepAngle = sweep,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = stroke,
                        )
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = labelOverride ?: "${(clamped * 100).roundToInt()}%",
            fontFamily = JetBrainsMonoFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = textColor,
        )
    }
}

@Composable
fun StatusBadge(label: String, token: StatusColorToken, modifier: Modifier = Modifier, showDot: Boolean = false) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color = token.container,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            if (showDot) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(token.dot),
                )
            }
            Text(
                text = label,
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                color = token.content,
            )
        }
    }
}

@Composable
fun statusTokenFor(status: String): StatusColorToken {
    val tokens = LocalSkanidaColors.current
    return when (status.lowercase()) {
        "present", "hadir", "approved", "disetujui" -> tokens.success
        "late", "terlambat", "pending", "menunggu" -> tokens.warning
        "sick", "sakit" -> tokens.sick
        "leave", "izin", "pergi", "dispensasi", "cuti", "lainnya" -> tokens.info
        "absent", "alpha", "alpa", "rejected", "ditolak", "gagal" -> tokens.error
        else -> tokens.info
    }
}

@Composable
fun PrimaryBiometricButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: Color? = null,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val tokens = LocalSkanidaColors.current
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 54.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor ?: tokens.primaryButtonContainer,
            contentColor = Color.White,
            disabledContainerColor = tokens.muted,
            disabledContentColor = tokens.mutedForeground,
        ),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
    ) {
        if (leadingIcon != null) {
            leadingIcon()
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = text,
            fontFamily = ManropeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
        )
    }
}

@Composable
fun PrimaryActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    PrimaryBiometricButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        leadingIcon = leadingIcon,
    )
}

@Composable
fun SecondaryActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val tokens = LocalSkanidaColors.current
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, tokens.border),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = tokens.card,
            contentColor = tokens.foreground,
            disabledContentColor = tokens.mutedForeground,
        ),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    ) {
        if (leadingIcon != null) {
            leadingIcon()
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = text,
            fontFamily = ManropeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
        )
    }
}

@Composable
fun DestructiveActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val tokens = LocalSkanidaColors.current
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = tokens.error.container,
            contentColor = tokens.error.content,
            disabledContainerColor = tokens.muted,
            disabledContentColor = tokens.mutedForeground,
        ),
        elevation = ButtonDefaults.buttonElevation(0.dp, 0.dp, 0.dp),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
    ) {
        if (leadingIcon != null) {
            leadingIcon()
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text = text,
            fontFamily = ManropeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
    }
}

@Composable
fun MediaSourcePickerRow(enabled: Boolean, onPickGallery: () -> Unit, onOpenCamera: () -> Unit, modifier: Modifier = Modifier) {
    val tokens = LocalSkanidaColors.current
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(14.dp))
                .clickable(enabled = enabled, role = Role.Button, onClick = onPickGallery),
            shape = RoundedCornerShape(14.dp),
            color = tokens.muted,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
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
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(14.dp))
                .clickable(enabled = enabled, role = Role.Button, onClick = onOpenCamera),
            shape = RoundedCornerShape(14.dp),
            color = tokens.cobaltTint,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
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

@Composable
fun SettingsGroupRow(
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
                .heightIn(min = 64.dp)
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
fun SkanidaConfirmDialog(
    title: String,
    message: String,
    confirmText: String,
    dismissText: String,
    isDestructive: Boolean = true,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.card,
        titleContentColor = tokens.foreground,
        textContentColor = tokens.mutedForeground,
        title = {
            Text(text = title, fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
        },
        text = {
            Text(text = message, fontFamily = ManropeFontFamily)
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = if (isDestructive) tokens.error.content else tokens.biometricBlue,
                ),
            ) {
                Text(confirmText, fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = tokens.foreground),
            ) {
                Text(dismissText, fontFamily = ManropeFontFamily, fontWeight = FontWeight.SemiBold)
            }
        },
    )
}

@Composable
fun OfflineBanner(modifier: Modifier = Modifier) {
    val tokens = LocalSkanidaColors.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = tokens.error.container,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_wifi_off),
                contentDescription = null,
                tint = tokens.error.content,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = "Tidak ada koneksi internet. Beberapa fitur tidak tersedia.",
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = tokens.error.content,
            )
        }
    }
}

@Composable
fun FeedbackBanner(message: String, isError: Boolean, onDismiss: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val token = if (isError) tokens.error else tokens.success
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(16.dp),
        color = token.container,
        border = BorderStroke(1.dp, token.border),
    ) {
        Row(
            modifier = Modifier.padding(start = 14.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = message,
                modifier = Modifier.weight(1f),
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                color = token.content,
            )
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Tutup pesan",
                    tint = token.content,
                )
            }
        }
    }
}

@Composable
fun UserAvatar(
    url: String?,
    fallbackName: String?,
    size: Dp = 56.dp,
    borderColor: Color? = null,
    borderWidth: Dp = 1.5.dp,
    containerColor: Color? = null,
    initialsColor: Color? = null,
    modifier: Modifier = Modifier,
) {
    val tokens = LocalSkanidaColors.current
    val initials = remember(fallbackName) { initialsFromName(fallbackName) }
    val avatarModifier = modifier
        .size(size)
        .clip(CircleShape)
        .border(borderWidth, borderColor ?: tokens.border, CircleShape)

    if (!url.isNullOrBlank()) {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = avatarModifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = avatarModifier.background(containerColor ?: tokens.passTop),
            contentAlignment = Alignment.Center,
        ) {
            if (initials.isNotBlank()) {
                Text(
                    text = initials,
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = (size.value * 0.33f).sp,
                    color = initialsColor ?: Color.White,
                    modifier = Modifier.clearAndSetSemantics {},
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = initialsColor ?: Color.White,
                    modifier = Modifier.size(size / 2),
                )
            }
        }
    }
}

@Composable
fun KeyValueRow(label: String, value: String, mono: Boolean = false, modifier: Modifier = Modifier) {
    val tokens = LocalSkanidaColors.current
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(0.42f),
            fontFamily = ManropeFontFamily,
            fontSize = 13.sp,
            color = tokens.mutedForeground,
        )
        Text(
            text = value.ifBlank { "—" },
            modifier = Modifier.weight(0.58f),
            fontFamily = if (mono) JetBrainsMonoFontFamily else ManropeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = tokens.foreground,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
fun SkanidaTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    enabled: Boolean = true,
    supportingText: String? = null,
) {
    val tokens = LocalSkanidaColors.current
    var visible by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(
            text = label,
            fontFamily = ManropeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = tokens.foreground,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            visualTransformation = if (isPassword && !visible) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (isPassword) KeyboardType.Password else keyboardType,
            ),
            enabled = enabled,
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                fontFamily = ManropeFontFamily,
                color = tokens.foreground,
            ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = tokens.muted.copy(alpha = 0.5f),
                unfocusedContainerColor = tokens.muted.copy(alpha = 0.5f),
                disabledContainerColor = tokens.muted.copy(alpha = 0.3f),
                focusedBorderColor = tokens.biometricBlue,
                unfocusedBorderColor = tokens.border,
            ),
            trailingIcon = if (isPassword) {
                {
                    IconButton(onClick = { visible = !visible }) {
                        Icon(
                            painter = painterResource(
                                if (visible) R.drawable.ic_visibility_off else R.drawable.ic_visibility,
                            ),
                            contentDescription = if (visible) "Sembunyikan $label" else "Lihat $label",
                            tint = tokens.mutedForeground,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            } else {
                null
            },
        )
        if (!supportingText.isNullOrBlank()) {
            Text(
                text = supportingText,
                fontFamily = ManropeFontFamily,
                fontSize = 11.sp,
                color = tokens.mutedForeground,
            )
        }
    }
}
