package id.skanida.nativeapp.ui.navigation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import id.skanida.nativeapp.EnrollmentStep
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.domain.workflow.InputValidation
import id.skanida.nativeapp.domain.workflow.PrecheckState
import id.skanida.nativeapp.domain.workflow.formatAttendanceDateLabel
import id.skanida.nativeapp.domain.workflow.formatDateKeyWib
import id.skanida.nativeapp.ui.components.AttendanceSuccessDialog
import id.skanida.nativeapp.ui.components.FeedbackBanner
import id.skanida.nativeapp.ui.components.OfflineBanner
import id.skanida.nativeapp.ui.components.SkanidaConfirmDialog
import id.skanida.nativeapp.ui.screens.AccountScreen
import id.skanida.nativeapp.ui.screens.AttendancePrecheckDialog
import id.skanida.nativeapp.ui.screens.CameraScreen
import id.skanida.nativeapp.ui.screens.HistoryScreen
import id.skanida.nativeapp.ui.screens.HomeScreen
import id.skanida.nativeapp.ui.screens.LeaveScreen
import id.skanida.nativeapp.ui.screens.LifecycleScreen
import id.skanida.nativeapp.ui.screens.NotificationsScreen
import id.skanida.nativeapp.ui.screens.PasswordScreen
import id.skanida.nativeapp.ui.screens.PermitsScreen
import id.skanida.nativeapp.ui.screens.ResetScreen
import id.skanida.nativeapp.ui.screens.SettingsScreen
import id.skanida.nativeapp.ui.screens.SignupScreen
import id.skanida.nativeapp.ui.screens.WelcomeScreen
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

@Immutable
private data class TopDestination(val page: Page, val title: String, val icon: ImageVector)

private val TOP_DESTINATIONS = listOf(
    TopDestination(Page.HOME, "Beranda", Icons.Default.Home),
    TopDestination(Page.HISTORY, "Riwayat", Icons.Default.DateRange),
    TopDestination(Page.PERMITS, "Perizinan", Icons.Default.Edit),
    TopDestination(Page.SETTINGS, "Pengaturan", Icons.Default.Settings),
)

private val TOP_LEVEL_PAGES = setOf(Page.HOME, Page.HISTORY, Page.PERMITS, Page.SETTINGS)
private val CAMERA_PAGES = setOf(Page.ATTENDANCE, Page.ENROLLMENT, Page.ATTACHMENT, Page.AVATAR)
private val UNAUTH_PAGES = setOf(Page.SIGNUP, Page.RESET)
private val LIFECYCLE_ALLOWED_PAGES = setOf(Page.SETTINGS, Page.ACCOUNT, Page.NOTIFICATIONS)
private val ENROLLMENT_DISCARD_STEPS = setOf(EnrollmentStep.CAPTURE, EnrollmentStep.CONFIRM)

private val PAGE_LABELS = mapOf(
    Page.SIGNUP to "Aktivasi Akun",
    Page.RESET to "Pulihkan Password",
    Page.ACCOUNT to "Kelola Akun",
    Page.NOTIFICATIONS to "Pengaturan Notifikasi",
    Page.PASSWORD to "Ganti Password",
    Page.LEAVE to "Ajukan Izin",
    Page.ATTENDANCE to "Presensi",
    Page.ENROLLMENT to "Pendaftaran Wajah",
    Page.ATTACHMENT to "Foto Bukti Izin",
    Page.AVATAR to "Foto Profil",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SkanidaAppHost(model: MainViewModel, isCameraCapture: Boolean, isWelcomeFullBleed: Boolean) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val loginLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        model.completeLogin(it.data)
    }
    val logoutLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { }

    var pendingPermissionTarget by remember { mutableStateOf<Page?>(null) }

    fun openPermissionTarget(target: Page) {
        when (target) {
            Page.ATTENDANCE -> model.startAttendanceFlow()
            Page.ENROLLMENT -> model.startEnrollment()
            else -> model.navigate(target)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        val target = pendingPermissionTarget
        pendingPermissionTarget = null
        val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val locationGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val needsCamera = target in CAMERA_PAGES
        val needsLocation = target == Page.ATTENDANCE
        val hasCamera = !needsCamera || cameraGranted
        val hasLocation = !needsLocation || locationGranted
        if (target != null && hasCamera && hasLocation) {
            openPermissionTarget(target)
        } else {
            val missingText = if (needsLocation) "kamera dan lokasi presisi" else "kamera"
            model.showError("Izinkan akses $missingText melalui pengaturan aplikasi untuk melanjutkan.")
        }
    }

    val requestPermissionsFor: (Page) -> Unit = remember(context, permissionLauncher, model) {
        { target ->
            val permissions = when (target) {
                Page.ATTENDANCE -> arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                )
                else -> arrayOf(Manifest.permission.CAMERA)
            }
            if (permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
                pendingPermissionTarget = null
                openPermissionTarget(target)
            } else {
                pendingPermissionTarget = target
                permissionLauncher.launch(permissions)
            }
        }
    }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            model.enableNotifications()
        } else {
            model.showError("Notifikasi belum diizinkan. Kamu dapat mengaktifkannya melalui pengaturan perangkat.")
        }
    }

    val toggleNotifications: () -> Unit = remember(context, notificationPermission, model) {
        {
            if (model.notificationsEnabled) {
                model.disableNotifications()
            } else if (
                Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                model.enableNotifications()
            }
        }
    }

    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { model.importImage(it, avatar = true) }
    }
    val attachmentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { model.importImage(it, avatar = false) }
    }

    var askLogout by remember { mutableStateOf(false) }
    var askDiscard by remember { mutableStateOf(false) }

    val isTopLevel = model.page in TOP_LEVEL_PAGES
    val isCameraPage = model.page in CAMERA_PAGES
    val showChildTopBar = !isTopLevel && (model.signedIn || model.page in UNAUTH_PAGES)

    val todayStr = remember(model.serverOffsetMs, model.page) { model.today.toString() }
    val todayPermits = remember(model.permits, todayStr) {
        model.permits.filter { formatDateKeyWib(it.date) == todayStr }
    }
    val canSubmitPermit = !model.permitsLoading &&
        model.permitsError == null &&
        todayPermits.size < InputValidation.MAX_DAILY_PERMITS &&
        todayPermits.none { it.approvalStatus == "pending" || it.approvalStatus == "approved" }

    fun handleBack() {
        val hasLeaveDraft = model.page == Page.LEAVE && (model.leaveDescription.isNotBlank() || model.attachment != null)
        val hasEnrollmentPhotos = model.page == Page.ENROLLMENT &&
            model.photos.isNotEmpty() &&
            model.enrollmentStep in ENROLLMENT_DISCARD_STEPS
        if (hasLeaveDraft || hasEnrollmentPhotos) {
            askDiscard = true
        } else {
            model.back()
        }
    }

    BackHandler(model.page == Page.HOME && model.precheckState is PrecheckState.Checking && !model.criticalSubmissionInFlight) {
        model.cancelAttendancePrecheck()
    }
    BackHandler(model.page != Page.HOME && !model.criticalSubmissionInFlight) { handleBack() }
    BackHandler(model.criticalSubmissionInFlight) { /* Keep in-flight submission visible until the server replies. */ }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        val canAutoRefresh = model.signedIn && isTopLevel && !isCameraPage
        if (canAutoRefresh && !model.busy) {
            model.refresh()
        }
    }

    if (isWelcomeFullBleed) {
        Box(modifier = Modifier.fillMaxSize()) {
            WelcomeScreen(
                busy = model.busy,
                onLogin = { model.login(loginLauncher::launch) },
                onSignup = { model.navigate(Page.SIGNUP) },
                onReset = { model.navigate(Page.RESET) },
            )
            StatusFeedbackOverlay(model = model, applyStatusBarPadding = true)
        }
        return
    }

    val childTitle = PAGE_LABELS[model.page] ?: ""
    val showPrimaryChrome = model.signedIn && isTopLevel && model.approved

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 600.dp
        val showPermitsFab = showPrimaryChrome && model.page == Page.PERMITS && canSubmitPermit
        Scaffold(
            containerColor = if (isCameraCapture) tokens.cameraBackdrop else tokens.background,
            topBar = {
                if (showChildTopBar) {
                    ChildScreenTopBar(
                        title = childTitle,
                        isCameraCapture = isCameraCapture,
                        backEnabled = !model.criticalSubmissionInFlight,
                        trailingDateLabel = if (model.page == Page.LEAVE) formatAttendanceDateLabel(todayStr) else null,
                        onBack = ::handleBack,
                    )
                }
            },
            floatingActionButton = {
                if (showPermitsFab) {
                    ExtendedFloatingActionButton(
                        onClick = { model.navigate(Page.LEAVE) },
                        shape = RoundedCornerShape(18.dp),
                        containerColor = tokens.primaryButtonContainer,
                        contentColor = Color.White,
                        icon = { Icon(Icons.Default.Add, contentDescription = null) },
                        text = {
                            Text(
                                text = "Ajukan Izin",
                                fontFamily = ManropeFontFamily,
                                fontWeight = FontWeight.Bold,
                            )
                        },
                    )
                }
            },
            bottomBar = {
                if (showPrimaryChrome && !wide) {
                    PrimaryBottomBar(
                        currentPage = model.page,
                        enabled = !model.criticalSubmissionInFlight,
                        onSelect = { model.navigate(it) },
                    )
                }
            },
        ) { padding ->
            Row(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .imePadding(),
            ) {
                if (showPrimaryChrome && wide) {
                    PrimaryNavigationRail(
                        currentPage = model.page,
                        enabled = !model.criticalSubmissionInFlight,
                        onSelect = { model.navigate(it) },
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                ) {
                    StatusFeedbackOverlay(model = model, applyStatusBarPadding = false)

                    when {
                        model.page == Page.SIGNUP -> SignupScreen(model)
                        model.page == Page.RESET -> ResetScreen(model)
                        isCameraPage -> CameraScreen(model)
                        model.page == Page.PASSWORD -> PasswordScreen(model)
                        !model.approved && model.page !in LIFECYCLE_ALLOWED_PAGES ->
                            LifecycleScreen(model = model, onLogout = { askLogout = true })
                        model.page == Page.HOME -> HomeScreen(
                            model = model,
                            onStartAttendance = { requestPermissionsFor(Page.ATTENDANCE) },
                            onStartEnrollment = { requestPermissionsFor(Page.ENROLLMENT) },
                        )
                        model.page == Page.HISTORY -> HistoryScreen(model)
                        model.page == Page.PERMITS -> PermitsScreen(model)
                        model.page == Page.LEAVE -> LeaveScreen(
                            model = model,
                            onPickGallery = { attachmentPicker.launch("image/*") },
                            onOpenCamera = { requestPermissionsFor(Page.ATTACHMENT) },
                        )
                        model.page == Page.ACCOUNT -> AccountScreen(
                            model = model,
                            onPickAvatarGallery = { avatarPicker.launch("image/*") },
                            onOpenAvatarCamera = { requestPermissionsFor(Page.AVATAR) },
                            onEnroll = { requestPermissionsFor(Page.ENROLLMENT) },
                        )
                        model.page == Page.NOTIFICATIONS -> NotificationsScreen(
                            model = model,
                            onToggleMaster = toggleNotifications,
                        )
                        model.page == Page.SETTINGS -> SettingsScreen(
                            model = model,
                            onLogoutClick = { askLogout = true },
                        )
                    }
                }
            }
        }
    }

    if (model.page == Page.HOME &&
        (model.precheckState is PrecheckState.Blocked || model.precheckState is PrecheckState.Failed)
    ) {
        AttendancePrecheckDialog(
            state = model.precheckState,
            busy = model.busy,
            onRetry = { requestPermissionsFor(Page.ATTENDANCE) },
            onDismiss = model::dismissPrecheckFeedback,
        )
    }

    model.pendingAttendanceSuccess?.let { success ->
        AttendanceSuccessDialog(
            success = success,
            onDismiss = model::dismissAttendanceSuccess,
        )
    }

    if (askLogout) {
        SkanidaConfirmDialog(
            title = "Keluar dari akun?",
            message = "Kamu perlu masuk kembali dengan akun sekolah untuk mengakses presensi.",
            confirmText = "Keluar",
            dismissText = "Batal",
            onConfirm = {
                askLogout = false
                model.logout(logoutLauncher::launch)
            },
            onDismiss = { askLogout = false },
        )
    }

    if (askDiscard) {
        SkanidaConfirmDialog(
            title = "Batalkan proses?",
            message = "Data dan foto yang belum dikirim akan dihapus.",
            confirmText = "Batalkan proses",
            dismissText = "Lanjutkan",
            onConfirm = {
                askDiscard = false
                model.leaveDescription = ""
                model.back()
            },
            onDismiss = { askDiscard = false },
        )
    }
}

@Composable
private fun StatusFeedbackOverlay(model: MainViewModel, applyStatusBarPadding: Boolean) {
    val tokens = LocalSkanidaColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (applyStatusBarPadding) Modifier.statusBarsPadding() else Modifier),
    ) {
        if (!model.isOnline) OfflineBanner()
        if (model.busy && (!model.refreshing || applyStatusBarPadding)) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = tokens.biometricBlue,
            )
        }
        model.error?.let { message ->
            FeedbackBanner(message = message, isError = true, onDismiss = model::dismissError)
        }
        model.notice?.let { message ->
            FeedbackBanner(message = message, isError = false, onDismiss = model::dismissNotice)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChildScreenTopBar(
    title: String,
    isCameraCapture: Boolean,
    backEnabled: Boolean,
    trailingDateLabel: String?,
    onBack: () -> Unit,
) {
    val tokens = LocalSkanidaColors.current
    TopAppBar(
        colors = if (isCameraCapture) {
            TopAppBarDefaults.topAppBarColors(
                containerColor = tokens.cameraBackdrop,
                titleContentColor = Color.White,
                navigationIconContentColor = Color.White,
            )
        } else {
            TopAppBarDefaults.topAppBarColors(
                containerColor = tokens.background,
                titleContentColor = tokens.foreground,
                navigationIconContentColor = tokens.foreground,
            )
        },
        title = {
            Text(
                text = title,
                fontFamily = ManropeFontFamily,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
            )
        },
        navigationIcon = {
            IconButton(onClick = onBack, enabled = backEnabled) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
            }
        },
        actions = {
            if (trailingDateLabel != null) {
                Surface(
                    modifier = Modifier.padding(end = 14.dp),
                    shape = RoundedCornerShape(999.dp),
                    color = tokens.cobaltTint,
                ) {
                    Text(
                        text = trailingDateLabel,
                        fontFamily = JetBrainsMonoFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = tokens.cobaltOnTint,
                        modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp),
                    )
                }
            }
        },
    )
}

@Composable
private fun PrimaryBottomBar(currentPage: Page, enabled: Boolean, onSelect: (Page) -> Unit) {
    val tokens = LocalSkanidaColors.current
    Surface(color = tokens.card, tonalElevation = 0.dp) {
        Column {
            HorizontalDivider(color = tokens.border, thickness = 1.dp)
            NavigationBar(containerColor = tokens.card, tonalElevation = 0.dp) {
                TOP_DESTINATIONS.forEach { destination ->
                    val selected = currentPage == destination.page
                    NavigationBarItem(
                        selected = selected,
                        onClick = { onSelect(destination.page) },
                        icon = { Icon(destination.icon, contentDescription = null) },
                        label = {
                            Text(
                                text = destination.title,
                                fontFamily = ManropeFontFamily,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 11.sp,
                            )
                        },
                        enabled = enabled,
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = tokens.cobaltOnTint,
                            selectedTextColor = tokens.cobaltOnTint,
                            indicatorColor = tokens.cobaltTint,
                            unselectedIconColor = tokens.mutedForeground,
                            unselectedTextColor = tokens.mutedForeground,
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun PrimaryNavigationRail(currentPage: Page, enabled: Boolean, onSelect: (Page) -> Unit) {
    val tokens = LocalSkanidaColors.current
    NavigationRail(containerColor = tokens.card) {
        TOP_DESTINATIONS.forEach { destination ->
            val selected = currentPage == destination.page
            NavigationRailItem(
                selected = selected,
                onClick = { onSelect(destination.page) },
                icon = { Icon(destination.icon, contentDescription = destination.title) },
                label = {
                    Text(
                        text = destination.title,
                        fontFamily = ManropeFontFamily,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 11.sp,
                    )
                },
                enabled = enabled,
                colors = NavigationRailItemDefaults.colors(
                    selectedIconColor = tokens.cobaltOnTint,
                    selectedTextColor = tokens.cobaltOnTint,
                    indicatorColor = tokens.cobaltTint,
                    unselectedIconColor = tokens.mutedForeground,
                    unselectedTextColor = tokens.mutedForeground,
                ),
            )
        }
    }
}
