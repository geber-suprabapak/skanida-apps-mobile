package id.skanida.nativeapp.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import id.skanida.nativeapp.R

val ManropeFontFamily = FontFamily(
    Font(R.font.manrope_regular, FontWeight.Normal),
    Font(R.font.manrope_medium, FontWeight.Medium),
    Font(R.font.manrope_semibold, FontWeight.SemiBold),
    Font(R.font.manrope_bold, FontWeight.Bold),
    Font(R.font.manrope_extrabold, FontWeight.ExtraBold),
)

val JetBrainsMonoFontFamily = FontFamily(
    Font(R.font.jetbrains_mono_medium, FontWeight.Medium),
    Font(R.font.jetbrains_mono_bold, FontWeight.Bold),
)

object SkanidaPalette {
    val CobaltLight = Color(0xFF1B5BFF)
    val CobaltDark = Color(0xFF4C82FF)
    val CobaltTintLight = Color(0xFFE7F0FF)
    val CobaltTintDark = Color(0xFF192D56)
    val CobaltOnTintLight = Color(0xFF1447CC)
    val CobaltOnTintDark = Color(0xFFA3C3FF)

    val PassTopLight = Color(0xFF0F2147)
    val PassBottomLight = Color(0xFF1A3A75)
    val PassDockLight = Color(0xFF0A1734)
    val PassSubtleLight = Color(0xFFB7C9EB)

    val PassTopDark = Color(0xFF13264D)
    val PassBottomDark = Color(0xFF1D3B75)
    val PassDockDark = Color(0xFF0B1833)
    val PassSubtleDark = Color(0xFFAEC4EC)

    val GoldLight = Color(0xFFE5B95C)
    val GoldTintLight = Color(0x26E5B95C)
    val GoldDark = Color(0xFFF0C973)
    val GoldTintDark = Color(0x28F0C973)

    val CanvasLight = Color(0xFFF2F5FA)
    val SurfaceLight = Color(0xFFFFFFFF)
    val SurfaceTintedLight = Color(0xFFF6F9FF)
    val SurfaceMutedLight = Color(0xFFE8EEF7)
    val BorderLight = Color(0xFFDCE3F0)
    val InkLight = Color(0xFF0E172A)
    val InkMutedLight = Color(0xFF586680)

    val CanvasDark = Color(0xFF070C16)
    val SurfaceDark = Color(0xFF0F1727)
    val SurfaceTintedDark = Color(0xFF142036)
    val SurfaceMutedDark = Color(0xFF18243C)
    val BorderDark = Color(0xFF1F2F4C)
    val InkDark = Color(0xFFF3F6FC)
    val InkMutedDark = Color(0xFF93A4C2)

    val CameraBackdrop = Color(0xFF060A12)

    val SuccessDot = Color(0xFF10B981)
    val SuccessLight = Color(0xFF0A8F62)
    val SuccessTintLight = Color(0xFFE2F6EE)
    val SuccessBorderLight = Color(0xFFA7F3D0)
    val SuccessDark = Color(0xFF34D399)
    val SuccessTintDark = Color(0xFF0E2E25)
    val SuccessBorderDark = Color(0xFF065F46)

    val WarningDot = Color(0xFFD97706)
    val WarningLight = Color(0xFFC26A0A)
    val WarningTintLight = Color(0xFFFFF2DF)
    val WarningBorderLight = Color(0xFFFCD9A8)
    val WarningDark = Color(0xFFFBBF24)
    val WarningTintDark = Color(0xFF32240E)
    val WarningBorderDark = Color(0xFF92400E)

    val SickDot = Color(0xFF7C3AED)
    val SickLight = Color(0xFF6D28D9)
    val SickTintLight = Color(0xFFF0E9FF)
    val SickBorderLight = Color(0xFFDDD6FE)
    val SickDark = Color(0xFFC4B5FD)
    val SickTintDark = Color(0xFF231A3C)
    val SickBorderDark = Color(0xFF6D28D9)

    val InfoDot = Color(0xFF0284C7)
    val InfoLight = Color(0xFF026AA2)
    val InfoTintLight = Color(0xFFE4F2FD)
    val InfoBorderLight = Color(0xFFBAE6FD)
    val InfoDark = Color(0xFF38BDF8)
    val InfoTintDark = Color(0xFF102A3E)
    val InfoBorderDark = Color(0xFF0369A1)

    val ErrorDot = Color(0xFFDC2626)
    val ErrorLight = Color(0xFFCC2936)
    val ErrorTintLight = Color(0xFFFEEAEC)
    val ErrorBorderLight = Color(0xFFFECACA)
    val ErrorDark = Color(0xFFF87171)
    val ErrorTintDark = Color(0xFF35161D)
    val ErrorBorderDark = Color(0xFF991B1B)
}

@Immutable
data class StatusColorToken(val container: Color, val content: Color, val border: Color, val dot: Color,)

@Immutable
data class SkanidaExtendedColors(
    val isDark: Boolean,
    val background: Color,
    val card: Color,
    val surfaceTinted: Color,
    val muted: Color,
    val border: Color,
    val foreground: Color,
    val mutedForeground: Color,
    val passTop: Color,
    val passBottom: Color,
    val passDock: Color,
    val passSubtle: Color,
    val gold: Color,
    val goldTint: Color,
    val biometricBlue: Color,
    val cobaltTint: Color,
    val cobaltOnTint: Color,
    val cameraBackdrop: Color,
    val success: StatusColorToken,
    val warning: StatusColorToken,
    val sick: StatusColorToken,
    val info: StatusColorToken,
    val error: StatusColorToken,
)

private val LightExtendedColors = SkanidaExtendedColors(
    isDark = false,
    background = SkanidaPalette.CanvasLight,
    card = SkanidaPalette.SurfaceLight,
    surfaceTinted = SkanidaPalette.SurfaceTintedLight,
    muted = SkanidaPalette.SurfaceMutedLight,
    border = SkanidaPalette.BorderLight,
    foreground = SkanidaPalette.InkLight,
    mutedForeground = SkanidaPalette.InkMutedLight,
    passTop = SkanidaPalette.PassTopLight,
    passBottom = SkanidaPalette.PassBottomLight,
    passDock = SkanidaPalette.PassDockLight,
    passSubtle = SkanidaPalette.PassSubtleLight,
    gold = SkanidaPalette.GoldLight,
    goldTint = SkanidaPalette.GoldTintLight,
    biometricBlue = SkanidaPalette.CobaltLight,
    cobaltTint = SkanidaPalette.CobaltTintLight,
    cobaltOnTint = SkanidaPalette.CobaltOnTintLight,
    cameraBackdrop = SkanidaPalette.CameraBackdrop,
    success = StatusColorToken(
        container = SkanidaPalette.SuccessTintLight,
        content = SkanidaPalette.SuccessLight,
        border = SkanidaPalette.SuccessBorderLight,
        dot = SkanidaPalette.SuccessDot,
    ),
    warning = StatusColorToken(
        container = SkanidaPalette.WarningTintLight,
        content = SkanidaPalette.WarningLight,
        border = SkanidaPalette.WarningBorderLight,
        dot = SkanidaPalette.WarningDot,
    ),
    sick = StatusColorToken(
        container = SkanidaPalette.SickTintLight,
        content = SkanidaPalette.SickLight,
        border = SkanidaPalette.SickBorderLight,
        dot = SkanidaPalette.SickDot,
    ),
    info = StatusColorToken(
        container = SkanidaPalette.InfoTintLight,
        content = SkanidaPalette.InfoLight,
        border = SkanidaPalette.InfoBorderLight,
        dot = SkanidaPalette.InfoDot,
    ),
    error = StatusColorToken(
        container = SkanidaPalette.ErrorTintLight,
        content = SkanidaPalette.ErrorLight,
        border = SkanidaPalette.ErrorBorderLight,
        dot = SkanidaPalette.ErrorDot,
    ),
)

private val DarkExtendedColors = SkanidaExtendedColors(
    isDark = true,
    background = SkanidaPalette.CanvasDark,
    card = SkanidaPalette.SurfaceDark,
    surfaceTinted = SkanidaPalette.SurfaceTintedDark,
    muted = SkanidaPalette.SurfaceMutedDark,
    border = SkanidaPalette.BorderDark,
    foreground = SkanidaPalette.InkDark,
    mutedForeground = SkanidaPalette.InkMutedDark,
    passTop = SkanidaPalette.PassTopDark,
    passBottom = SkanidaPalette.PassBottomDark,
    passDock = SkanidaPalette.PassDockDark,
    passSubtle = SkanidaPalette.PassSubtleDark,
    gold = SkanidaPalette.GoldDark,
    goldTint = SkanidaPalette.GoldTintDark,
    biometricBlue = SkanidaPalette.CobaltDark,
    cobaltTint = SkanidaPalette.CobaltTintDark,
    cobaltOnTint = SkanidaPalette.CobaltOnTintDark,
    cameraBackdrop = SkanidaPalette.CameraBackdrop,
    success = StatusColorToken(
        container = SkanidaPalette.SuccessTintDark,
        content = SkanidaPalette.SuccessDark,
        border = SkanidaPalette.SuccessBorderDark,
        dot = SkanidaPalette.SuccessDark,
    ),
    warning = StatusColorToken(
        container = SkanidaPalette.WarningTintDark,
        content = SkanidaPalette.WarningDark,
        border = SkanidaPalette.WarningBorderDark,
        dot = SkanidaPalette.WarningDark,
    ),
    sick = StatusColorToken(
        container = SkanidaPalette.SickTintDark,
        content = SkanidaPalette.SickDark,
        border = SkanidaPalette.SickBorderDark,
        dot = SkanidaPalette.SickDark,
    ),
    info = StatusColorToken(
        container = SkanidaPalette.InfoTintDark,
        content = SkanidaPalette.InfoDark,
        border = SkanidaPalette.InfoBorderDark,
        dot = SkanidaPalette.InfoDark,
    ),
    error = StatusColorToken(
        container = SkanidaPalette.ErrorTintDark,
        content = SkanidaPalette.ErrorDark,
        border = SkanidaPalette.ErrorBorderDark,
        dot = SkanidaPalette.ErrorDark,
    ),
)

val LocalSkanidaColors = staticCompositionLocalOf { LightExtendedColors }

private val SkanidaTypography = Typography(
    displayMedium = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 36.sp,
        lineHeight = 42.sp,
        letterSpacing = (-0.8).sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.3).sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = ManropeFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 14.sp,
    ),
)

private val SkanidaShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
)

@Composable
fun SkanidaTheme(themePreference: String, forceDarkSystemBars: Boolean = false, content: @Composable () -> Unit,) {
    val isDark = themePreference == "dark" ||
        (themePreference == "system" && isSystemInDarkTheme())
    val extended = if (isDark) DarkExtendedColors else LightExtendedColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            val controller = WindowCompat.getInsetsController(window, view)
            val useDarkBars = isDark || forceDarkSystemBars
            controller.isAppearanceLightStatusBars = !useDarkBars
            controller.isAppearanceLightNavigationBars = !useDarkBars
        }
    }

    val colorScheme = if (isDark) {
        darkColorScheme(
            primary = extended.biometricBlue,
            onPrimary = Color.White,
            primaryContainer = extended.cobaltTint,
            onPrimaryContainer = extended.cobaltOnTint,
            secondary = extended.muted,
            onSecondary = extended.foreground,
            secondaryContainer = extended.cobaltTint,
            onSecondaryContainer = extended.cobaltOnTint,
            background = extended.background,
            onBackground = extended.foreground,
            surface = extended.card,
            onSurface = extended.foreground,
            surfaceVariant = extended.muted,
            onSurfaceVariant = extended.mutedForeground,
            outline = Color(0xFF64748B),
            outlineVariant = extended.border,
            error = extended.error.dot,
            onError = Color.White,
            errorContainer = extended.error.container,
            onErrorContainer = extended.error.content,
        )
    } else {
        lightColorScheme(
            primary = extended.biometricBlue,
            onPrimary = Color.White,
            primaryContainer = extended.cobaltTint,
            onPrimaryContainer = extended.cobaltOnTint,
            secondary = extended.muted,
            onSecondary = extended.foreground,
            secondaryContainer = extended.cobaltTint,
            onSecondaryContainer = extended.cobaltOnTint,
            background = extended.background,
            onBackground = extended.foreground,
            surface = extended.card,
            onSurface = extended.foreground,
            surfaceVariant = extended.muted,
            onSurfaceVariant = extended.mutedForeground,
            outline = Color(0xFF64748B),
            outlineVariant = extended.border,
            error = extended.error.dot,
            onError = Color.White,
            errorContainer = extended.error.container,
            onErrorContainer = extended.error.content,
        )
    }

    CompositionLocalProvider(LocalSkanidaColors provides extended) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = SkanidaTypography,
            shapes = SkanidaShapes,
            content = content,
        )
    }
}
