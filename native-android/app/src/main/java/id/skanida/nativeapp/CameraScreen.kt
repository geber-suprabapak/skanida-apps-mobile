package id.skanida.nativeapp

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage

@Composable fun CameraScreen(model: MainViewModel) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    val enrollment = model.page == Page.ENROLLMENT
    val purpose = model.page
    val ownerGeneration = remember { model.captureGeneration }
    var front by remember { mutableStateOf(model.page != Page.ATTACHMENT) }
    val previewView = remember { PreviewView(context).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
    var capture by remember { mutableStateOf<ImageCapture?>(null) }
    var capturing by remember { mutableStateOf(false) }
    var cameraError by remember { mutableStateOf<String?>(null) }
    val confirmed = enrollment && model.photos.size == 10

    DisposableEffect(lifecycle, front, confirmed) {
        var disposed = false
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        var preview: Preview? = null
        var imageCapture: ImageCapture? = null
        capture = null
        if (!confirmed) future.addListener({
            if (!disposed) try {
                provider = future.get()
                preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                imageCapture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).setJpegQuality(70).build()
                val selector = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                check(provider!!.hasCamera(selector)) { "Kamera ${if (front) "depan" else "belakang"} tidak tersedia." }
                provider!!.bindToLifecycle(lifecycle, selector, preview, imageCapture)
                capture = imageCapture
                cameraError = null
            } catch (failure: Exception) {
                cameraError = failure.message ?: "Kamera tidak dapat dibuka."
            }
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            disposed = true
            capture = null
            listOfNotNull(preview, imageCapture).forEach { provider?.unbind(it) }
        }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(when { confirmed -> "10 foto siap dikirim"; enrollment -> "Foto ${model.photos.size + 1} dari 10"; model.page == Page.ATTACHMENT -> "Foto bukti pengajuan izin"; model.page == Page.AVATAR -> "Ambil foto profil"; else -> "Verifikasi wajah untuk presensi" }, style = MaterialTheme.typography.titleLarge)
        Text(if (enrollment) "Posisikan wajah di tengah. Variasikan sedikit arah wajah dan gunakan pencahayaan yang cukup." else "Pastikan foto jelas sebelum mengambil gambar.", style = MaterialTheme.typography.bodyMedium)
        cameraError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (confirmed) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                model.photos.chunked(5).forEach { row -> Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEachIndexed { index, file -> AsyncImage(file, "Foto enrollment ${model.photos.indexOf(file) + 1}", Modifier.weight(1f).fillMaxHeight(), contentScale = androidx.compose.ui.layout.ContentScale.Crop) }
                } }
            }
            Button(onClick = model::submitEnrollment, enabled = !model.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text("Kirim 10 foto wajah") }
            OutlinedButton(onClick = model::retakeEnrollment, enabled = !model.busy, modifier = Modifier.fillMaxWidth()) { Text("Ambil ulang semua foto") }
        } else {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
                if (capture == null && cameraError == null) CircularProgressIndicator(Modifier.align(Alignment.Center))
            }
            if (!enrollment) OutlinedButton(onClick = { front = !front }, enabled = !model.busy && !capturing, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Ganti kamera") }
            Button(onClick = {
                val camera = capture
                if (camera != null && !capturing) {
                    capturing = true
                    val file = captureFile(context)
                    camera.targetRotation = previewView.display?.rotation ?: android.view.Surface.ROTATION_0
                    camera.takePicture(ImageCapture.OutputFileOptions.Builder(file).build(), ContextCompat.getMainExecutor(context), object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) { capturing = false; model.captured(file, ownerGeneration, purpose) }
                        override fun onError(exception: ImageCaptureException) { capturing = false; file.delete(); model.showError("Foto gagal diambil. Silakan coba lagi.") }
                    })
                }
            }, enabled = capture != null && !capturing && !model.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
                Text(if (capturing || model.busy) "Memproses foto…" else "Ambil foto")
            }
        }
    }
}
