package id.skanida.nativeapp.ui.screens

import android.util.Size as AndroidSize
import android.view.Surface as AndroidSurface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import id.skanida.nativeapp.EnrollmentStep
import id.skanida.nativeapp.MainViewModel
import id.skanida.nativeapp.Page
import id.skanida.nativeapp.R
import id.skanida.nativeapp.data.device.captureFile
import id.skanida.nativeapp.ui.theme.JetBrainsMonoFontFamily
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily
import id.skanida.nativeapp.ui.theme.SkanidaPalette

private val FACE_GUIDE_PAGES = setOf(Page.ATTENDANCE, Page.ENROLLMENT, Page.AVATAR)
private val GUIDE_DASH_EFFECT = PathEffect.dashPathEffect(floatArrayOf(18f, 12f))
private val TARGET_CAPTURE_SIZE = AndroidSize(1280, 960)

@Composable
fun CameraScreen(model: MainViewModel) {
    val isEnrollment = model.page == Page.ENROLLMENT
    val isAttendance = model.page == Page.ATTENDANCE

    if (isAttendance && model.attendanceOutcomeUncertain) {
        AttendanceUncertainScreen(model)
        return
    }

    if (isEnrollment) {
        when (model.enrollmentStep) {
            EnrollmentStep.CONFIRM -> {
                EnrollmentConfirmScreen(model)
                return
            }
            EnrollmentStep.UPLOADING -> {
                EnrollmentUploadingScreen()
                return
            }
            EnrollmentStep.SUCCESS -> {
                EnrollmentSuccessScreen(model)
                return
            }
            EnrollmentStep.UNKNOWN_OUTCOME -> {
                EnrollmentUnknownOutcomeScreen(model)
                return
            }
            EnrollmentStep.CAPTURE -> Unit
        }
    }

    CameraViewfinderContent(model = model, isEnrollment = isEnrollment, isAttendance = isAttendance)
}

@Composable
private fun CameraViewfinderContent(model: MainViewModel, isEnrollment: Boolean, isAttendance: Boolean) {
    val tokens = LocalSkanidaColors.current
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current

    val purpose = model.page
    val ownerGeneration = remember { model.captureGeneration }
    var front by remember { mutableStateOf(model.page != Page.ATTACHMENT) }
    val previewView = remember {
        PreviewView(context).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE }
    }
    var capture by remember { mutableStateOf<ImageCapture?>(null) }
    var capturing by remember { mutableStateOf(false) }
    var frozenFrame by remember { mutableStateOf<ImageBitmap?>(null) }
    var cameraError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(capturing, model.busy) {
        if (!capturing && !model.busy) {
            frozenFrame = null
        }
    }

    DisposableEffect(lifecycle, front) {
        var disposed = false
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        var preview: Preview? = null
        var imageCapture: ImageCapture? = null
        capture = null
        frozenFrame = null
        future.addListener({
            if (!disposed) {
                try {
                    provider = future.get()
                    preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                    // Bound capture resolution near 1280px so older phones skip 12–48 MP full-sensor JPEG encoding.
                    val captureResolution = ResolutionSelector.Builder()
                        .setResolutionStrategy(
                            ResolutionStrategy(
                                TARGET_CAPTURE_SIZE,
                                ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                            ),
                        )
                        .build()
                    imageCapture = ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .setResolutionSelector(captureResolution)
                        .setJpegQuality(70)
                        .build()
                    val selector = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                    check(provider!!.hasCamera(selector)) {
                        "Kamera ${if (front) "depan" else "belakang"} tidak tersedia."
                    }
                    provider!!.bindToLifecycle(lifecycle, selector, preview, imageCapture)
                    capture = imageCapture
                    cameraError = null
                } catch (failure: Exception) {
                    cameraError = failure.message ?: "Kamera tidak dapat dibuka."
                }
            }
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            disposed = true
            capture = null
            frozenFrame = null
            listOfNotNull(preview, imageCapture).forEach { provider?.unbind(it) }
        }
    }

    val isFaceGuide = model.page in FACE_GUIDE_PAGES
    val instructionCopy = when (model.page) {
        Page.ENROLLMENT -> "Posisikan wajah di dalam bingkai oval. Variasikan sedikit arah wajah dengan pencahayaan cukup."
        Page.ATTENDANCE -> "Posisikan wajah di dalam bingkai oval dengan pencahayaan cukup untuk verifikasi presensi."
        Page.ATTACHMENT -> "Arahkan kamera ke surat dokter atau bukti izin hingga tulisan terbaca jelas."
        Page.AVATAR -> "Posisikan wajah di tengah bingkai untuk foto profil akunmu."
        else -> "Pastikan objek terlihat jelas di dalam bingkai sebelum mengambil foto."
    }
    val processingActive = capturing || model.busy

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.cameraBackdrop)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = RoundedCornerShape(999.dp),
                color = Color.White.copy(alpha = 0.14f),
            ) {
                Text(
                    text = when {
                        isEnrollment -> "Foto ${model.photos.size + 1} / 10"
                        model.page == Page.ATTACHMENT -> "Foto Bukti Izin"
                        model.page == Page.AVATAR -> "Foto Profil"
                        else -> "Verifikasi Wajah Presensi"
                    },
                    fontFamily = if (isEnrollment) JetBrainsMonoFontFamily else ManropeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
            if (isEnrollment && model.photos.isNotEmpty()) {
                TextButton(
                    onClick = model::undoLastEnrollmentPhoto,
                    enabled = !processingActive,
                    modifier = Modifier.heightIn(min = 48.dp),
                    colors = ButtonDefaults.textButtonColors(contentColor = tokens.gold),
                ) {
                    Text("Ulangi terakhir", fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold)
                }
            } else if (!isEnrollment) {
                IconButton(
                    onClick = { front = !front },
                    enabled = !processingActive,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.16f)),
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_flip_camera),
                        contentDescription = "Ganti kamera",
                        tint = Color.White,
                    )
                }
            }
        }

        if (isEnrollment) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                for (index in 0 until 10) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(5.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                when {
                                    index < model.photos.size -> SkanidaPalette.SuccessDot
                                    index == model.photos.size -> tokens.biometricBlue
                                    else -> Color.White.copy(alpha = 0.2f)
                                },
                            ),
                    )
                }
            }
        }

        Text(
            text = instructionCopy,
            fontFamily = ManropeFontFamily,
            fontSize = 13.sp,
            color = Color.White.copy(alpha = 0.85f),
        )

        if (isAttendance && !model.attendanceSubmitError.isNullOrBlank()) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = tokens.error.container,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = model.attendanceSubmitError.orEmpty(),
                    fontFamily = ManropeFontFamily,
                    fontSize = 13.sp,
                    color = tokens.error.content,
                    modifier = Modifier.padding(12.dp),
                )
            }
        }

        cameraError?.let {
            Text(
                text = it,
                fontFamily = ManropeFontFamily,
                fontSize = 13.sp,
                color = tokens.error.dot,
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(SkanidaPalette.InkLight),
        ) {
            AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
            frozenFrame?.let { locked ->
                Image(
                    bitmap = locked,
                    contentDescription = "Foto terambil",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            CameraGuideOverlay(
                isFaceGuide = isFaceGuide,
                isLocked = processingActive,
                modifier = Modifier.fillMaxSize(),
            )
            if (processingActive) {
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 16.dp),
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xCC0F172A),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                        )
                        Text(
                            text = when (model.page) {
                                Page.ATTENDANCE -> "Memverifikasi wajah..."
                                Page.AVATAR -> "Mengunggah foto profil..."
                                else -> "Memproses foto..."
                            },
                            fontFamily = ManropeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = Color.White,
                        )
                    }
                }
            }
            if (capture == null && cameraError == null) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = tokens.biometricBlue,
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            val ready = capture != null && !processingActive
            val shutterLabel = if (processingActive) "Memproses foto" else "Ambil foto"
            Box(
                modifier = Modifier
                    .size(78.dp)
                    .clip(CircleShape)
                    .border(4.dp, Color.White, CircleShape)
                    .padding(6.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            processingActive -> SkanidaPalette.SuccessDot
                            ready -> tokens.primaryButtonContainer
                            else -> Color.White.copy(alpha = 0.2f)
                        },
                    )
                    .semantics(mergeDescendants = true) {
                        contentDescription = shutterLabel
                    }
                    .clickable(enabled = ready, role = Role.Button) {
                        val camera = capture
                        if (camera != null && !capturing) {
                            frozenFrame = runCatching { previewView.bitmap?.asImageBitmap() }.getOrNull()
                            capturing = true
                            val file = captureFile(context)
                            camera.targetRotation = previewView.display?.rotation ?: AndroidSurface.ROTATION_0
                            camera.takePicture(
                                ImageCapture.OutputFileOptions.Builder(file).build(),
                                ContextCompat.getMainExecutor(context),
                                object : ImageCapture.OnImageSavedCallback {
                                    override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                        model.captured(file, ownerGeneration, purpose)
                                        capturing = false
                                    }

                                    override fun onError(exception: ImageCaptureException) {
                                        capturing = false
                                        frozenFrame = null
                                        file.delete()
                                        model.showError("Foto gagal diambil. Silakan coba lagi.")
                                    }
                                },
                            )
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                if (processingActive) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(28.dp),
                        strokeWidth = 3.dp,
                    )
                } else {
                    Icon(
                        painter = painterResource(R.drawable.ic_camera),
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(28.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun CameraGuideOverlay(isFaceGuide: Boolean, isLocked: Boolean, modifier: Modifier = Modifier) {
    Spacer(
        modifier = modifier.drawWithCache {
            val strokePx = 3.dp.toPx()
            val inset = 28.dp.toPx()
            val corner = 32.dp.toPx()
            val ovalW = size.width * 0.68f
            val ovalH = (ovalW * 1.28f).coerceAtMost(size.height * 0.72f)
            val ovalTopLeft = Offset((size.width - ovalW) / 2f, (size.height - ovalH) / 2f)
            val ovalSize = Size(ovalW, ovalH)
            val ovalColor = if (isLocked) SkanidaPalette.SuccessDot else SkanidaPalette.CobaltDark
            val ovalStroke = Stroke(
                width = strokePx,
                pathEffect = if (isLocked) null else GUIDE_DASH_EFFECT,
            )
            val docColor = Color.White.copy(alpha = 0.9f)

            onDrawBehind {
                if (isFaceGuide) {
                    drawOval(
                        color = ovalColor,
                        topLeft = ovalTopLeft,
                        size = ovalSize,
                        style = ovalStroke,
                    )
                } else {
                    drawLine(docColor, Offset(inset, inset), Offset(inset + corner, inset), strokePx)
                    drawLine(docColor, Offset(inset, inset), Offset(inset, inset + corner), strokePx)
                    drawLine(docColor, Offset(size.width - inset, inset), Offset(size.width - inset - corner, inset), strokePx)
                    drawLine(docColor, Offset(size.width - inset, inset), Offset(size.width - inset, inset + corner), strokePx)
                    drawLine(docColor, Offset(inset, size.height - inset), Offset(inset + corner, size.height - inset), strokePx)
                    drawLine(docColor, Offset(inset, size.height - inset), Offset(inset, size.height - inset - corner), strokePx)
                    drawLine(
                        docColor,
                        Offset(size.width - inset, size.height - inset),
                        Offset(size.width - inset - corner, size.height - inset),
                        strokePx,
                    )
                    drawLine(
                        docColor,
                        Offset(size.width - inset, size.height - inset),
                        Offset(size.width - inset, size.height - inset - corner),
                        strokePx,
                    )
                }
            }
        },
    )
}
