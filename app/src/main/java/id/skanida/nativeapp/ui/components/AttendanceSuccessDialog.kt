package id.skanida.nativeapp.ui.components

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import id.skanida.nativeapp.domain.workflow.ID_LOCALE
import id.skanida.nativeapp.domain.workflow.PendingAttendanceSuccess
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import id.skanida.nativeapp.ui.theme.SkanidaPalette
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private val CONFETTI_COLORS = listOf(
    Color(0xFF1B5BFF), // Cobalt
    Color(0xFF10B981), // Emerald
    Color(0xFFF59E0B), // Amber Gold
    Color(0xFFF43F5E), // Coral Rose
    Color(0xFF8B5CF6), // Violet
    Color(0xFF06B6D4), // Cyan
    Color(0xFFF0C973), // Soft Gold
    Color(0xFF34D399), // Mint
)

private data class ConfettiParticle(
    val startXFraction: Float,
    val startYFraction: Float,
    val vxFraction: Float,
    val vyFraction: Float,
    val gravityFraction: Float,
    val swayAmplitudeDp: Float,
    val swayFrequency: Float,
    val swayPhase: Float,
    val initialRotation: Float,
    val spinSpeed: Float,
    val flipSpeed: Float,
    val delaySeconds: Float,
    val durationSeconds: Float,
    val widthDp: Float,
    val heightDp: Float,
    val isCircle: Boolean,
    val color: Color,
)

private fun buildConfettiParticles(): List<ConfettiParticle> {
    val rng = Random(System.nanoTime())
    val burst = List(36) {
        val angle = Math.toRadians(rng.nextDouble(-155.0, -25.0))
        val speed = rng.nextDouble(0.32, 0.78)
        val isCircle = rng.nextFloat() < 0.25f
        val w = rng.nextFloat() * 6f + 6f
        ConfettiParticle(
            startXFraction = 0.5f + (rng.nextFloat() - 0.5f) * 0.18f,
            startYFraction = 0.34f + (rng.nextFloat() - 0.5f) * 0.06f,
            vxFraction = (cos(angle) * speed).toFloat(),
            vyFraction = (sin(angle) * speed).toFloat(),
            gravityFraction = rng.nextFloat() * 0.35f + 0.58f,
            swayAmplitudeDp = rng.nextFloat() * 14f + 6f,
            swayFrequency = rng.nextFloat() * 3.5f + 2.0f,
            swayPhase = rng.nextFloat() * 6.28f,
            initialRotation = rng.nextFloat() * 360f,
            spinSpeed = (rng.nextFloat() * 240f + 120f) * if (rng.nextBoolean()) 1f else -1f,
            flipSpeed = rng.nextFloat() * 5.5f + 3.0f,
            delaySeconds = rng.nextFloat() * 0.14f,
            durationSeconds = rng.nextFloat() * 1.1f + 2.5f,
            widthDp = w,
            heightDp = if (isCircle) w else w * (rng.nextFloat() * 0.6f + 0.45f),
            isCircle = isCircle,
            color = CONFETTI_COLORS[rng.nextInt(CONFETTI_COLORS.size)],
        )
    }
    val shower = List(22) {
        val isCircle = rng.nextFloat() < 0.25f
        val w = rng.nextFloat() * 6f + 6f
        ConfettiParticle(
            startXFraction = rng.nextFloat() * 0.96f + 0.02f,
            startYFraction = -0.04f,
            vxFraction = (rng.nextFloat() - 0.5f) * 0.12f,
            vyFraction = rng.nextFloat() * 0.15f + 0.12f,
            gravityFraction = rng.nextFloat() * 0.18f + 0.24f,
            swayAmplitudeDp = rng.nextFloat() * 18f + 10f,
            swayFrequency = rng.nextFloat() * 3.0f + 1.8f,
            swayPhase = rng.nextFloat() * 6.28f,
            initialRotation = rng.nextFloat() * 360f,
            spinSpeed = (rng.nextFloat() * 200f + 90f) * if (rng.nextBoolean()) 1f else -1f,
            flipSpeed = rng.nextFloat() * 4.5f + 2.5f,
            delaySeconds = rng.nextFloat() * 0.65f + 0.1f,
            durationSeconds = rng.nextFloat() * 1.0f + 2.6f,
            widthDp = w,
            heightDp = if (isCircle) w else w * (rng.nextFloat() * 0.55f + 0.45f),
            isCircle = isCircle,
            color = CONFETTI_COLORS[rng.nextInt(CONFETTI_COLORS.size)],
        )
    }
    return burst + shower
}

@Composable
private fun ConfettiOverlay(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val animationsEnabled = remember(context) {
        runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        }.getOrDefault(true)
    }
    if (!animationsEnabled) return

    val particles = remember { buildConfettiParticles() }
    val maxTime = remember(particles) { particles.maxOf { it.delaySeconds + it.durationSeconds } }
    var elapsedSeconds by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(particles) {
        var startNanos = -1L
        while (elapsedSeconds < maxTime) {
            withFrameNanos { frameNanos ->
                if (startNanos < 0L) startNanos = frameNanos
                elapsedSeconds = (frameNanos - startNanos) / 1_000_000_000f
            }
        }
    }

    if (elapsedSeconds >= maxTime) return

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val cornerPx = 2.dp.toPx()
        particles.forEach { p ->
            val t = elapsedSeconds - p.delaySeconds
            if (t <= 0f || t >= p.durationSeconds) return@forEach
            val progress = (t / p.durationSeconds).coerceIn(0f, 1f)
            val alpha = if (progress < 0.72f) 1f else ((1f - progress) / 0.28f).coerceIn(0f, 1f)
            val swayPx = sin(t * p.swayFrequency + p.swayPhase) * p.swayAmplitudeDp.dp.toPx()
            val x = p.startXFraction * w + (p.vxFraction * w) * t * (1f - 0.35f * progress) + swayPx
            val y = p.startYFraction * h + (p.vyFraction * h) * t + 0.5f * (p.gravityFraction * h) * t * t
            if (y > h + 40f || x < -40f || x > w + 40f) return@forEach

            val rotationDeg = p.initialRotation + p.spinSpeed * t
            val flipScaleY = (0.25f + 0.75f * kotlin.math.abs(cos(t * p.flipSpeed))).coerceIn(0.25f, 1f)
            val widthPx = p.widthDp.dp.toPx()
            val heightPx = p.heightDp.dp.toPx()
            val tint = p.color.copy(alpha = alpha)

            withTransform({
                translate(left = x, top = y)
                rotate(degrees = rotationDeg, pivot = Offset.Zero)
                scale(scaleX = 1f, scaleY = flipScaleY, pivot = Offset.Zero)
            }) {
                if (p.isCircle) {
                    drawCircle(color = tint, radius = widthPx * 0.45f, center = Offset.Zero)
                } else {
                    drawRoundRect(
                        color = tint,
                        topLeft = Offset(-widthPx / 2f, -heightPx / 2f),
                        size = Size(widthPx, heightPx),
                        cornerRadius = CornerRadius(cornerPx, cornerPx),
                    )
                }
            }
        }
    }
}

@Composable
fun AttendanceSuccessDialog(success: PendingAttendanceSuccess, onDismiss: () -> Unit) {
    val tokens = LocalSkanidaColors.current
    val isCheckout = success.attendanceType == "check_out"
    val title = if (isCheckout) "Berhasil Presensi Pulang" else "Berhasil Presensi Masuk"

    val processingText = when {
        success.processingTimeMs <= 0L -> ""
        success.processingTimeMs < 1000L -> "Diproses dalam ${success.processingTimeMs} ms"
        success.processingTimeMs < 10_000L ->
            String.format(ID_LOCALE, "Diproses dalam %.1f dtk", success.processingTimeMs / 1000.0)
        else -> "Diproses dalam ${(success.processingTimeMs / 1000.0).toInt()} dtk"
    }

    val cardScale = remember { Animatable(0.88f) }
    val badgeScale = remember { Animatable(0.4f) }
    LaunchedEffect(success) {
        cardScale.animateTo(
            targetValue = 1f,
            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow),
        )
    }
    LaunchedEffect(success) {
        badgeScale.animateTo(
            targetValue = 1f,
            animationSpec = spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = Spring.StiffnessMedium),
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.48f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDismiss,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Surface(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .widthIn(max = 380.dp)
                    .fillMaxWidth()
                    .graphicsLayer {
                        scaleX = cardScale.value
                        scaleY = cardScale.value
                    }
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {},
                    ),
                shape = RoundedCornerShape(26.dp),
                color = tokens.card,
                border = BorderStroke(1.dp, tokens.border),
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .graphicsLayer {
                                scaleX = badgeScale.value
                                scaleY = badgeScale.value
                            }
                            .clip(CircleShape)
                            .background(SkanidaPalette.SuccessDot),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(38.dp),
                        )
                    }

                    Text(
                        text = title,
                        fontFamily = ManropeFontFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        textAlign = TextAlign.Center,
                        color = tokens.foreground,
                    )

                    if (success.statusLabel.isNotBlank()) {
                        StatusBadge(
                            label = success.statusLabel,
                            token = statusTokenFor(success.statusLabel),
                        )
                    }

                    Text(
                        text = "\"${success.quote.quote}\" — ${success.quote.author}",
                        fontFamily = ManropeFontFamily,
                        fontSize = 13.sp,
                        lineHeight = 20.sp,
                        textAlign = TextAlign.Center,
                        color = tokens.mutedForeground,
                    )

                    if (processingText.isNotEmpty()) {
                        Text(
                            text = processingText,
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 11.sp,
                            color = tokens.mutedForeground,
                        )
                    }

                    PrimaryBiometricButton(
                        text = "Selesai",
                        onClick = onDismiss,
                    )
                }
            }

            ConfettiOverlay(modifier = Modifier.fillMaxSize())
        }
    }
}
