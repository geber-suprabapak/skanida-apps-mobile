package id.skanida.nativeapp

import android.Manifest
import android.content.Intent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { val model: MainViewModel = viewModel(); SkanidaTheme(model.theme) { SkanidaApp(model) } }
    }
}

@Composable private fun SkanidaTheme(theme: String, content: @Composable () -> Unit) {
    val dark = theme == "dark" || (theme == "system" && androidx.compose.foundation.isSystemInDarkTheme())
    val scheme = if (dark) darkColorScheme(primary = Color(0xFF8DB6FF), background = Color(0xFF0F172A), surface = Color(0xFF172033))
        else lightColorScheme(primary = Color(0xFF0066FF), background = Color(0xFFF8FAFC), surface = Color.White)
    MaterialTheme(colorScheme = scheme, content = content)
}

private data class Destination(val page: Page, val title: String, val icon: ImageVector)
private val destinations = listOf(Destination(Page.HOME, "Beranda", Icons.Default.Home), Destination(Page.HISTORY, "Riwayat", Icons.Default.DateRange),
    Destination(Page.PERMITS, "Perizinan", Icons.Default.Edit), Destination(Page.SETTINGS, "Pengaturan", Icons.Default.Settings))
private val labels = mapOf(Page.SIGNUP to "Aktivasi akun", Page.RESET to "Pulihkan password", Page.ACCOUNT to "Kelola akun", Page.PASSWORD to "Ganti password",
    Page.LEAVE to "Ajukan izin", Page.ATTENDANCE to "Presensi", Page.ENROLLMENT to "Daftarkan wajah", Page.ATTACHMENT to "Foto bukti izin", Page.AVATAR to "Foto profil")

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun SkanidaApp(model: MainViewModel) {
    val context = LocalContext.current
    val login = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { model.completeLogin(it.data) }
    val logout = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    var pendingCamera by remember { mutableStateOf<Page?>(null) }
    fun openCamera(page: Page) { when (page) {
        Page.ATTENDANCE -> model.prepareAttendance()
        Page.ENROLLMENT -> model.startEnrollment()
        else -> model.navigate(page)
    } }
    val cameraPermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
        val target = pendingCamera
        pendingCamera = null
        val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val locationGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (target != null && cameraGranted && (target != Page.ATTENDANCE || locationGranted)) openCamera(target)
        else model.showError("Izinkan kamera${if (target == Page.ATTENDANCE) " dan lokasi presisi" else ""} melalui pengaturan aplikasi untuk melanjutkan.")
    }
    val requestCamera: (Page) -> Unit = { target ->
        pendingCamera = target
        val permissions = if (target == Page.ATTENDANCE) arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            else arrayOf(Manifest.permission.CAMERA)
        if (permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
            pendingCamera = null; openCamera(target)
        } else cameraPermissions.launch(permissions)
    }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) model.enableNotifications() else model.showError("Notifikasi belum diizinkan. Kamu dapat mengaktifkannya melalui pengaturan perangkat.")
    }
    val notificationToggle: () -> Unit = {
        if (model.notificationsEnabled) model.disableNotifications()
        else if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        else model.enableNotifications()
    }
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { it?.let { model.importImage(it, true) } }
    val attachmentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { it?.let { model.importImage(it, false) } }
    var askLogout by remember { mutableStateOf(false) }
    var askDiscard by remember { mutableStateOf(false) }
    val topLevel = model.page in destinations.map { it.page }
    val camera = model.page in listOf(Page.ATTENDANCE, Page.ENROLLMENT, Page.ATTACHMENT, Page.AVATAR)
    fun back() {
        if ((model.page == Page.LEAVE && (model.leaveDescription.isNotBlank() || model.attachment != null)) ||
            (model.page == Page.ENROLLMENT && model.photos.isNotEmpty())) askDiscard = true
        else model.back()
    }
    BackHandler(!topLevel && !model.busy) { back() }
    BackHandler(model.busy) { /* Keep an in-flight submission visible until the server replies. */ }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (model.signedIn && !camera && !model.busy && model.page in destinations.map { it.page }) model.refresh()
    }
    val title = if (!model.signedIn && model.page == Page.HOME) "Skanida Apps" else labels[model.page] ?: destinations.firstOrNull { it.page == model.page }?.title ?: "Skanida Apps"
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 600.dp
        Scaffold(
            topBar = {
                TopAppBar(title = { Text(title) }, navigationIcon = {
                    if (!topLevel) IconButton(onClick = { back() }, enabled = !model.busy) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Kembali") }
                }, actions = {
                    if (model.signedIn && topLevel) IconButton(onClick = model::refresh, enabled = !model.busy) { Icon(Icons.Default.Refresh, "Muat ulang") }
                })
            },
            bottomBar = {
                if (model.signedIn && topLevel && !wide) NavigationBar {
                    destinations.forEach { destination -> NavigationBarItem(selected = model.page == destination.page, onClick = { model.navigate(destination.page) },
                        icon = { Icon(destination.icon, null) }, label = { Text(destination.title) }, enabled = !model.busy) }
                }
            }
        ) { padding ->
            Row(Modifier.padding(padding).fillMaxSize().imePadding()) {
                if (model.signedIn && topLevel && wide) NavigationRail {
                    destinations.forEach { destination -> NavigationRailItem(selected = model.page == destination.page, onClick = { model.navigate(destination.page) },
                        icon = { Icon(destination.icon, destination.title) }, label = { Text(destination.title) }, enabled = !model.busy) }
                }
                Column(Modifier.weight(1f).fillMaxHeight()) {
                    if (model.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    model.error?.let { message -> Feedback(message, error = true, onDismiss = model::dismissError) }
                    model.notice?.let { message -> Feedback(message, error = false, onDismiss = model::dismissNotice) }
                    when {
                        model.page == Page.SIGNUP -> SignupScreen(model)
                        model.page == Page.RESET -> ResetScreen(model)
                        !model.signedIn -> WelcomeScreen(model.busy, { model.login(login::launch) }, { model.navigate(Page.SIGNUP) }, { model.navigate(Page.RESET) })
                        camera -> CameraScreen(model)
                        model.page == Page.PASSWORD -> PasswordScreen(model)
                        !model.approved && model.page !in listOf(Page.SETTINGS, Page.ACCOUNT) -> LifecycleScreen(model)
                        model.page == Page.HOME -> HomeScreen(model, { requestCamera(Page.ATTENDANCE) }, { requestCamera(Page.ENROLLMENT) })
                        model.page == Page.HISTORY -> HistoryScreen(model)
                        model.page == Page.PERMITS -> PermitsScreen(model)
                        model.page == Page.LEAVE -> LeaveScreen(model, { attachmentPicker.launch("image/*") }, { requestCamera(Page.ATTACHMENT) })
                        model.page == Page.ACCOUNT -> AccountScreen(model, { avatarPicker.launch("image/*") }, { requestCamera(Page.AVATAR) })
                        model.page == Page.SETTINGS -> SettingsScreen(model, { requestCamera(Page.ENROLLMENT) }, notificationToggle, { askLogout = true })
                    }
                }
            }
        }
    }
    if (askLogout) AlertDialog(onDismissRequest = { askLogout = false }, title = { Text("Keluar dari akun?") }, text = { Text("Kamu perlu login kembali untuk menggunakan Skanida Apps.") },
        confirmButton = { TextButton(onClick = { askLogout = false; model.logout(logout::launch) }) { Text("Keluar") } },
        dismissButton = { TextButton(onClick = { askLogout = false }) { Text("Batal") } })
    if (askDiscard) AlertDialog(onDismissRequest = { askDiscard = false }, title = { Text("Batalkan proses?") }, text = { Text("Data dan foto yang belum dikirim akan dihapus.") },
        confirmButton = { TextButton(onClick = { askDiscard = false; model.leaveDescription = ""; model.back() }) { Text("Batalkan proses") } },
        dismissButton = { TextButton(onClick = { askDiscard = false }) { Text("Lanjutkan") } })
}

@Composable private fun Feedback(message: String, error: Boolean, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(color = if (error) colors.errorContainer else colors.secondaryContainer, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(message, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, "Tutup pesan") }
        }
    }
}

@Composable private fun Screen(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}

@Composable private fun WelcomeScreen(busy: Boolean, login: () -> Unit, signup: () -> Unit, reset: () -> Unit) = Screen {
    Spacer(Modifier.height(32.dp))
    Surface(color = Color.White, shape = CircleShape, modifier = Modifier.size(120.dp).align(Alignment.CenterHorizontally)) {
        Image(painterResource(R.drawable.skanida_logo), "Logo Skanida Apps", Modifier.padding(8.dp))
    }
    Text("Selamat datang di\nSkanida Apps", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
    Text("Presensi siswa SMKN 2 Buduran. Masuk untuk mencatat kehadiran, melihat riwayat, dan mengajukan izin.", style = MaterialTheme.typography.bodyLarge)
    Button(onClick = login, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Masuk dengan akun sekolah") }
    OutlinedButton(onClick = signup, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Aktivasi akun siswa") }
    TextButton(onClick = reset, enabled = !busy, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Lupa password?") }
}

@Composable private fun LifecycleScreen(model: MainViewModel) = Screen {
    Text(when (model.lifecycle) { "pending" -> "Menunggu persetujuan sekolah"; "rejected" -> "Pendaftaran belum disetujui"; "disabled" -> "Akun dinonaktifkan"; else -> "Akun belum siap" }, style = MaterialTheme.typography.headlineSmall)
    Text("Hubungi administrator sekolah untuk informasi status akun. Data presensi tersedia setelah akun disetujui.")
    Button(onClick = model::refresh, enabled = !model.busy) { Text("Periksa lagi") }
    OutlinedButton(onClick = { model.navigate(Page.SETTINGS) }) { Text("Buka pengaturan") }
}

private fun displayTime(value: String): String = runCatching { Instant.parse(value).atZone(WIB).format(DateTimeFormatter.ofPattern("HH:mm")) }.getOrDefault(value.ifBlank { "—" })
private fun statusLabel(value: String) = when (value.lowercase()) { "present", "hadir" -> "Hadir"; "late", "terlambat" -> "Terlambat"; "absent", "alpha", "alpa" -> "Alpa"; "leave", "izin" -> "Izin"; "sakit", "sick" -> "Sakit"; "pending" -> "Belum presensi"; else -> value.ifBlank { "Belum ada data" } }

@Composable private fun HomeScreen(model: MainViewModel, attendance: () -> Unit, enroll: () -> Unit) = Screen {
    val data = model.dashboard
    val profile = data?.optJSONObject("profile") ?: model.profile
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Avatar(profile?.text("avatar_url"), 56)
        Column(Modifier.weight(1f)) {
            Text(profile?.text("full_name", "Siswa") ?: "Siswa", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(listOfNotNull(profile?.text("class_name")?.takeIf { it.isNotBlank() }, profile?.text("nis")?.takeIf { it.isNotBlank() }).joinToString(" • "), style = MaterialTheme.typography.bodyMedium)
        }
    }
    if (data == null) {
        Text(if (model.busy) "Memuat data presensi…" else "Data belum tersedia. Muat ulang untuk mencoba lagi.")
        if (!model.busy) Button(onClick = model::refresh) { Text("Muat ulang") }
    } else {
        var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
        LaunchedEffect(model.serverOffsetMs) { while (true) { now = System.currentTimeMillis() + model.serverOffsetMs; delay(1000) } }
        val clock = Instant.ofEpochMilli(now).atZone(WIB)
        Text(clock.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", Locale.forLanguageTag("id-ID"))), style = MaterialTheme.typography.bodyLarge)
        Text(clock.format(DateTimeFormatter.ofPattern("HH:mm:ss")) + " WIB", style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Bold)
        val record = data.optJSONObject("attendance") ?: JSONObject()
        Surface(shape = MaterialTheme.shapes.medium, tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(statusLabel(record.text("today_status")), style = MaterialTheme.typography.headlineSmall)
                KeyValue("Presensi masuk", displayTime(record.text("check_in_time")))
                KeyValue("Presensi pulang", displayTime(record.text("check_out_time")))
                if (!record.isNull("total_work_hours")) KeyValue("Durasi", "${record.optDouble("total_work_hours")} jam")
            }
        }
        val action = data.optJSONObject("primary_action") ?: JSONObject()
        Button(onClick = attendance, enabled = action.optBoolean("allowed") && !model.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
            Icon(Icons.Default.Face, null); Spacer(Modifier.width(8.dp)); Text(action.text("label", "Presensi"))
        }
        if (!action.optBoolean("allowed")) Text(action.text("reason_message", "Presensi belum tersedia."), style = MaterialTheme.typography.bodyMedium)
        val face = data.optJSONObject("face")
        if (face?.text("enrollment_status") != "enrolled") OutlinedButton(onClick = enroll, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Daftarkan wajah untuk presensi") }
        if (face?.text("server_status") != "healthy") Text(face?.text("message", "Layanan verifikasi belum siap.") ?: "Layanan verifikasi belum siap.", color = MaterialTheme.colorScheme.error)
        data.optJSONObject("schedule")?.let { schedule ->
            HorizontalDivider()
            Text("Jadwal hari ini", style = MaterialTheme.typography.titleMedium)
            KeyValue("Masuk", "${displayTime(schedule.text("start_check_in_at"))} – ${displayTime(schedule.text("end_check_in_at"))}")
            KeyValue("Pulang", "${displayTime(schedule.text("start_check_out_at"))} – ${displayTime(schedule.text("end_check_out_at"))}")
            KeyValue("Kompensasi", "${schedule.optInt("compensation_minutes")} menit")
        }
        HorizontalDivider()
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { model.navigate(Page.HISTORY) }, modifier = Modifier.weight(1f)) { Text("Riwayat") }
            OutlinedButton(onClick = { model.navigate(Page.LEAVE) }, modifier = Modifier.weight(1f), enabled = !model.busy) { Text("Ajukan izin") }
        }
    }
}

@Composable private fun KeyValue(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Text(value.ifBlank { "—" }, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable private fun Avatar(url: String?, size: Int) {
    if (!url.isNullOrBlank()) AsyncImage(url, "Foto profil", Modifier.size(size.dp).clip(CircleShape), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
    else Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.size(size.dp)) {
        Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, "Foto profil belum tersedia", Modifier.size((size / 2).dp)) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun HistoryScreen(model: MainViewModel) = Screen {
    var pickMonth by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { model.changeMonth(-1) }, enabled = !model.busy) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Bulan sebelumnya") }
        TextButton(onClick = { pickMonth = true }, modifier = Modifier.weight(1f), enabled = !model.busy) { Text(model.month.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.forLanguageTag("id-ID"))), style = MaterialTheme.typography.titleLarge) }
        IconButton(onClick = { model.changeMonth(1) }, enabled = !model.busy && model.month < YearMonth.from(model.today)) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Bulan berikutnya") }
    }
    Row(Modifier.fillMaxWidth()) { listOf("Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab").forEach { Text(it, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center) } }
    val offset = model.month.atDay(1).dayOfWeek.value % 7
    val cells = ((offset + model.month.lengthOfMonth() + 6) / 7) * 7
    for (row in 0 until cells / 7) Row(Modifier.fillMaxWidth()) {
        for (col in 0..6) {
            val day = row * 7 + col - offset + 1
            if (day in 1..model.month.lengthOfMonth()) {
                val date = model.month.atDay(day)
                val selected = model.selectedDate == date
                val record = model.records.firstOrNull { it.text("date") == date.toString() }
                Surface(color = if (selected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent, shape = MaterialTheme.shapes.small,
                    modifier = Modifier.weight(1f).heightIn(min = 52.dp).clickable(enabled = date <= model.today) { model.selectDate(date) }) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Text(day.toString(), fontWeight = if (date == model.today) FontWeight.Bold else FontWeight.Normal)
                        if (record != null) Box(Modifier.padding(top = 4.dp).size(5.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                    }
                }
            } else Spacer(Modifier.weight(1f))
        }
    }
    HorizontalDivider()
    Text(model.selectedDate.format(DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.forLanguageTag("id-ID"))), style = MaterialTheme.typography.titleLarge)
    val daily = model.records.filter { it.text("date") == model.selectedDate.toString() }
    if (daily.isEmpty()) Text(if (model.busy) "Memuat riwayat…" else "Belum ada catatan presensi pada tanggal ini.")
    daily.forEach { record ->
        ListItem(headlineContent = { Text(statusLabel(record.text("status"))) }, supportingContent = {
            val checkIn = record.text("check_in_time")
            val checkOut = record.text("check_out_time")
            Text(if (checkIn.isNotBlank() || checkOut.isNotBlank()) "Masuk: ${displayTime(checkIn)} • Pulang: ${displayTime(checkOut)} WIB" else record.text("description", "Catatan kehadiran"))
        }, leadingContent = { Icon(Icons.Default.CheckCircle, null) })
    }
    if (model.records.isNotEmpty()) {
        Text("Ringkasan bulan ini", style = MaterialTheme.typography.titleMedium)
        model.records.groupBy { it.text("date") }.values.groupingBy { group -> statusLabel(group.first().text("status")) }.eachCount().forEach { (status, count) -> KeyValue(status, "$count hari") }
    }
    if (pickMonth) {
        val picker = rememberDatePickerState(initialSelectedDateMillis = model.month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long) = Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate() <= model.today
                override fun isSelectableYear(year: Int) = year <= model.today.year
            })
        DatePickerDialog(onDismissRequest = { pickMonth = false }, confirmButton = {
            TextButton(onClick = { picker.selectedDateMillis?.let { model.selectMonth(YearMonth.from(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC))) }; pickMonth = false }) { Text("Pilih bulan") }
        }, dismissButton = { TextButton(onClick = { pickMonth = false }) { Text("Batal") } }) { DatePicker(state = picker) }
    }
}

@Composable private fun PermitsScreen(model: MainViewModel) = Screen {
    Button(onClick = { model.navigate(Page.LEAVE) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text("Ajukan izin") }
    if (model.permits.isEmpty()) Text(if (model.busy) "Memuat pengajuan izin…" else "Belum ada pengajuan izin.")
    model.permits.sortedByDescending { it.text("created_at") }.forEach { permit ->
        PermitRow(permit)
        HorizontalDivider()
    }
}

@Composable private fun PermitRow(permit: JSONObject) {
    var expanded by remember { mutableStateOf(false) }
    val category = when (permit.text("category")) { "sakit" -> "Sakit"; "pergi" -> "Izin (Pergi)"; "dispensasi" -> "Dispensasi"; "lainnya" -> "Izin (Lainnya)"; "cuti" -> "Cuti"; else -> "Izin" }
    val status = when (permit.text("approval_status")) { "approved" -> "Disetujui"; "rejected" -> "Ditolak"; else -> "Menunggu persetujuan" }
    Column(Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$category • $status", style = MaterialTheme.typography.titleMedium)
        val start = permit.text("requested_start_date", permit.text("date"))
        val end = permit.text("effective_end_date")
        Text(if (end.isNotBlank() && end != start) "$start sampai $end" else start, style = MaterialTheme.typography.bodyMedium)
        Text(permit.text("description"), style = MaterialTheme.typography.bodyLarge)
        if (permit.text("rejection_reason").isNotBlank()) Text("Alasan penolakan: ${permit.text("rejection_reason")}", color = MaterialTheme.colorScheme.error)
        if (expanded) {
            KeyValue("Tanggal pengajuan", permit.text("created_at", permit.text("date")))
            if (!permit.isNull("duration_days")) KeyValue("Durasi", "${permit.optInt("duration_days")} hari")
            if (permit.text("original_end_date").isNotBlank()) KeyValue("Akhir izin semula", permit.text("original_end_date"))
            if (permit.text("attachment_url").isNotBlank()) AsyncImage(permit.text("attachment_url"), "Bukti pengajuan izin", Modifier.fillMaxWidth().heightIn(max = 320.dp))
        }
        Text(if (expanded) "Tutup detail" else "Lihat detail", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable private fun LeaveScreen(model: MainViewModel, gallery: () -> Unit, camera: () -> Unit) = Screen {
    Text("Izin untuk ${model.today}", style = MaterialTheme.typography.titleLarge)
    Text("Pilih kategori dan sertakan bukti. Pengajuan akan diperiksa oleh sekolah.")
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        FilterChip(selected = model.leaveCategory == "sakit", onClick = { model.leaveCategory = "sakit" }, label = { Text("Sakit") }, enabled = !model.busy)
        FilterChip(selected = model.leaveCategory == "pergi", onClick = { model.leaveCategory = "pergi" }, label = { Text("Izin (Pergi)") }, enabled = !model.busy)
    }
    OutlinedTextField(value = model.leaveDescription, onValueChange = { model.leaveDescription = it.take(500) }, label = { Text("Keterangan izin") },
        supportingText = { Text("${model.leaveDescription.length}/500 • minimal 10 karakter") }, minLines = 4, modifier = Modifier.fillMaxWidth(), enabled = !model.busy)
    model.attachment?.let {
        AsyncImage(it, "Foto bukti izin", Modifier.fillMaxWidth().height(200.dp))
        TextButton(onClick = model::removeAttachment, enabled = !model.busy) { Text("Hapus foto") }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = gallery, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Pilih foto") }
        OutlinedButton(onClick = camera, enabled = !model.busy, modifier = Modifier.weight(1f)) { Text("Ambil foto") }
    }
    Button(onClick = model::submitLeave, enabled = !model.busy && model.attachment != null && model.leaveDescription.trim().length in 10..500,
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Kirim pengajuan") }
}

@Composable private fun SettingsScreen(model: MainViewModel, enroll: () -> Unit, notifications: () -> Unit, logout: () -> Unit) = Screen {
    val context = LocalContext.current
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Avatar(model.profile?.text("avatar_url"), 64)
        Column(Modifier.weight(1f)) { Text(model.profile?.text("full_name", "Akun siswa") ?: "Akun siswa", style = MaterialTheme.typography.titleLarge); Text(model.profile?.text("email").orEmpty()) }
    }
    TextButton(onClick = {
        val id = model.profile?.text("nis")?.takeIf { it.isNotBlank() } ?: model.identity.userId
        context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("NIS Skanida", id))
        model.showNotice("ID berhasil disalin.")
    }) { Text("Salin ID: ${model.profile?.text("nis")?.takeIf { it.isNotBlank() } ?: model.identity.userId}") }
    SettingsAction("Kelola akun", "Profil, NIS, kelas, dan foto profil", Icons.Default.Person, !model.busy) { model.navigate(Page.ACCOUNT) }
    SettingsAction("Ganti password", "Amankan akun sekolahmu", Icons.Default.Lock, !model.busy) { model.navigate(Page.PASSWORD) }
    SettingsAction("Pendaftaran wajah", "Ambil 10 foto untuk verifikasi presensi", Icons.Default.Face, !model.busy && model.approved, enroll)
    HorizontalDivider()
    Text("Tampilan", style = MaterialTheme.typography.titleMedium)
    listOf("system" to "Ikuti perangkat", "light" to "Terang", "dark" to "Gelap").forEach { (value, label) ->
        Row(Modifier.fillMaxWidth().clickable { model.updateTheme(value) }, verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = model.theme == value, onClick = { model.updateTheme(value) }); Text(label)
        }
    }
    HorizontalDivider()
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text("Notifikasi", style = MaterialTheme.typography.titleMedium); Text(if (model.notificationsEnabled) "Aktif untuk akun ini" else "Aktifkan kabar presensi dan perizinan", style = MaterialTheme.typography.bodyMedium) }
        Switch(checked = model.notificationsEnabled, onCheckedChange = { notifications() }, enabled = !model.busy, modifier = Modifier.semantics { contentDescription = "Notifikasi" })
    }
    TextButton(onClick = { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))) }) { Text("Pengaturan izin perangkat") }
    HorizontalDivider()
    KeyValue("Versi aplikasi", BuildConfig.VERSION_NAME)
    Text("Pembaruan versi native dipasang melalui APK baru dari sekolah.", style = MaterialTheme.typography.bodyMedium)
    Text("Skanida Apps • SMKN 2 Buduran", style = MaterialTheme.typography.bodyMedium)
    OutlinedButton(onClick = logout, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Keluar dari akun") }
}

@Composable private fun SettingsAction(title: String, subtitle: String, icon: ImageVector, enabled: Boolean, action: () -> Unit) {
    ListItem(headlineContent = { Text(title) }, supportingContent = { Text(subtitle) }, leadingContent = { Icon(icon, null) },
        trailingContent = { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null) }, modifier = Modifier.clickable(enabled = enabled, onClick = action))
}

@Composable private fun AccountScreen(model: MainViewModel, avatar: () -> Unit, camera: () -> Unit) = Screen {
    var clearPhoto by remember { mutableStateOf(false) }
    val profile = model.profile
    Avatar(profile?.text("avatar_url"), 96)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = avatar, enabled = !model.busy) { Text("Ganti foto") }
        OutlinedButton(onClick = camera, enabled = !model.busy) { Text("Ambil foto") }
    }
    if (!profile?.text("avatar_url").isNullOrBlank()) TextButton(onClick = { clearPhoto = true }, enabled = !model.busy) { Text("Hapus foto") }
    listOf("Nama lengkap" to "full_name", "NIS" to "nis", "Kelas" to "class_name", "Nomor absen" to "absence_number", "Email" to "email", "Jenis kelamin" to "gender").forEach { (label, field) -> KeyValue(label, profile?.text(field).orEmpty()) }
    Text("Untuk perubahan data siswa, hubungi administrator sekolah.", style = MaterialTheme.typography.bodyMedium)
    HorizontalDivider()
    Text("Verifikasi wajah", style = MaterialTheme.typography.titleMedium)
    model.enrollmentStatus?.let {
        KeyValue("Pendaftaran wajah", if (it.text("status") == "enrolled") "Sudah terdaftar" else "Belum terdaftar")
        if (it.text("status") == "enrolled") KeyValue("Data wajah", it.optInt("embeddingCount").toString())
    }
    KeyValue("Server verifikasi", if (model.dashboard?.optJSONObject("face")?.text("server_status") == "healthy") "Siap digunakan" else "Belum siap / belum diperiksa")
    if (clearPhoto) AlertDialog(onDismissRequest = { clearPhoto = false }, title = { Text("Hapus foto profil?") }, text = { Text("Foto profilmu akan dihapus dari akun.") },
        confirmButton = { TextButton(onClick = { clearPhoto = false; model.clearAvatar() }) { Text("Hapus") } },
        dismissButton = { TextButton(onClick = { clearPhoto = false }) { Text("Batal") } })
}

@Composable private fun Input(label: String, value: String, update: (String) -> Unit, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, enabled: Boolean = true) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(value = value, onValueChange = update, label = { Text(label) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
        visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard), enabled = enabled,
        trailingIcon = if (password) ({ TextButton(onClick = { visible = !visible }) { Text(if (visible) "Sembunyikan" else "Lihat") } }) else null)
}

@Composable private fun SignupScreen(model: MainViewModel) = Screen {
    var nis by rememberSaveable { mutableStateOf("") }; var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }; var confirm by remember { mutableStateOf("") }
    Text("Aktivasi akun siswa", style = MaterialTheme.typography.headlineSmall)
    Text("Gunakan NIS yang terdaftar di sekolah. Akun aktif setelah mendapat persetujuan sekolah.")
    Input("NIS", nis, { nis = it }, keyboard = KeyboardType.Number, enabled = !model.busy)
    Input("Email", email, { email = it }, keyboard = KeyboardType.Email, enabled = !model.busy)
    Input("Password", password, { password = it }, password = true, enabled = !model.busy)
    Text("Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.", style = MaterialTheme.typography.bodySmall)
    Input("Konfirmasi password", confirm, { confirm = it }, password = true, enabled = !model.busy)
    Button(onClick = { model.signup(nis, email, password, confirm) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Kirim pendaftaran") }
}

@Composable private fun ResetScreen(model: MainViewModel) = Screen {
    var nis by rememberSaveable { mutableStateOf("") }; var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }; var confirm by remember { mutableStateOf("") }
    Text("Pulihkan akses akun", style = MaterialTheme.typography.headlineSmall)
    Text("Masukkan kode pemulihan yang diberikan administrator sekolah.")
    Input("NIS", nis, { nis = it }, keyboard = KeyboardType.Number, enabled = !model.busy)
    Input("Kode pemulihan", code, { code = it }, enabled = !model.busy)
    Input("Password baru", password, { password = it }, password = true, enabled = !model.busy)
    Input("Konfirmasi password baru", confirm, { confirm = it }, password = true, enabled = !model.busy)
    Button(onClick = { model.resetPassword(nis, code, password, confirm) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Perbarui password") }
}

@Composable private fun PasswordScreen(model: MainViewModel) = Screen {
    var current by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var confirm by remember { mutableStateOf("") }
    Text("Ganti password akun", style = MaterialTheme.typography.headlineSmall)
    if (model.identity.mustChangePassword) Text("Kamu perlu mengganti password sebelum melanjutkan.")
    Input("Password saat ini", current, { current = it }, password = true, enabled = !model.busy)
    Input("Password baru", password, { password = it }, password = true, enabled = !model.busy)
    Input("Konfirmasi password baru", confirm, { confirm = it }, password = true, enabled = !model.busy)
    Button(onClick = { model.changePassword(current, password, confirm) }, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Simpan password baru") }
}
