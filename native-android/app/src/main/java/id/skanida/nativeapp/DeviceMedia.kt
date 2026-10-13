package id.skanida.nativeapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.core.location.LocationCompat
import androidx.core.location.LocationManagerCompat
import android.os.CancellationSignal
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.io.File
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

suspend fun currentLocation(context: Context): Location = withTimeout(30_000) {
    check(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
        "Izinkan lokasi presisi untuk presensi."
    }
    val manager = context.getSystemService(LocationManager::class.java)
    val provider = when {
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
        manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
        else -> error("Aktifkan lokasi perangkat lalu coba lagi.")
    }
    suspendCancellableCoroutine { continuation ->
        val cancellation = CancellationSignal()
        continuation.invokeOnCancellation { cancellation.cancel() }
        LocationManagerCompat.getCurrentLocation(manager, provider, cancellation, ContextCompat.getMainExecutor(context)) { location ->
            if (continuation.isActive) {
                if (location == null) continuation.resumeWithException(Exception("Lokasi belum ditemukan. Coba lagi di area terbuka."))
                else if (LocationCompat.isMock(location)) continuation.resumeWithException(Exception("Lokasi palsu terdeteksi. Nonaktifkan aplikasi mock location."))
                else if (!location.latitude.isFinite() || !location.longitude.isFinite() || location.latitude !in -90.0..90.0 || location.longitude !in -180.0..180.0)
                    continuation.resumeWithException(Exception("Koordinat lokasi tidak valid."))
                else continuation.resume(location)
            }
        }
    }
}

fun captureFile(context: Context): File = File(context.cacheDir, "capture-${UUID.randomUUID()}.jpg")

suspend fun prepareImage(context: Context, uri: Uri, maxBytes: Long): File = withContext(Dispatchers.IO) {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    check(options.outWidth > 0 && options.outHeight > 0) { "File bukan gambar yang dapat dibaca." }
    options.inSampleSize = 1
    while (maxOf(options.outWidth, options.outHeight) / options.inSampleSize > 2560) options.inSampleSize *= 2
    options.inJustDecodeBounds = false
    val decoded = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        ?: error("Gambar tidak dapat dibaca.")
    val orientation = context.contentResolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } ?: ExifInterface.ORIENTATION_NORMAL
    val matrix = Matrix().apply {
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { postScale(-1f, 1f); postRotate(270f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { postScale(-1f, 1f); postRotate(90f) }
        }
    }
    val ratio = minOf(1f, 1280f / maxOf(decoded.width, decoded.height))
    matrix.postScale(ratio, ratio)
    val bitmap = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    val file = captureFile(context)
    try {
        file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 70, it)) }
        check(file.length() in 1..maxBytes) { "Ukuran foto terlalu besar. Ambil ulang foto." }
        file
    } catch (failure: Exception) {
        file.delete()
        throw failure
    } finally {
        if (bitmap !== decoded) bitmap.recycle()
        decoded.recycle()
    }
}
