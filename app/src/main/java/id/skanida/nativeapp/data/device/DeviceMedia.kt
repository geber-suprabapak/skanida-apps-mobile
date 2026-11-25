package id.skanida.nativeapp.data.device

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.location.Location
import android.location.LocationManager
import android.location.LocationRequest
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationCompat
import androidx.core.location.LocationManagerCompat
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.util.UUID
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

internal data class LocationCandidate(
    val provider: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float?,
    val isMock: Boolean,
    val ageMs: Long = 0L,
)

internal object LocationFixPolicy {
    const val PROVIDER_FUSED = "fused"
    const val PROVIDER_GPS = "gps"
    const val PROVIDER_NETWORK = "network"

    const val LIVE_TIMEOUT_MS = 20_000L
    const val REFINEMENT_WINDOW_MS = 3_000L
    const val GOOD_ACCURACY_METERS = 50f
    const val MAX_LAST_KNOWN_AGE_MS = 120_000L

    fun isValidCoordinates(latitude: Double, longitude: Double): Boolean = latitude.isFinite() &&
        longitude.isFinite() &&
        latitude in -90.0..90.0 &&
        longitude in -180.0..180.0

    fun isImmediateFix(candidate: LocationCandidate): Boolean {
        if (candidate.isMock || !isValidCoordinates(candidate.latitude, candidate.longitude)) return false
        val accurateEnough = candidate.accuracyMeters == null || candidate.accuracyMeters <= GOOD_ACCURACY_METERS
        return accurateEnough && (candidate.provider == PROVIDER_FUSED || candidate.provider == PROVIDER_GPS)
    }

    fun isBetter(candidate: LocationCandidate, currentBest: LocationCandidate): Boolean {
        val candidateAcc = candidate.accuracyMeters ?: Float.MAX_VALUE
        val bestAcc = currentBest.accuracyMeters ?: Float.MAX_VALUE
        if (candidateAcc != bestAcc) return candidateAcc < bestAcc
        return providerRank(candidate.provider) < providerRank(currentBest.provider)
    }

    fun isFreshLastKnown(ageMs: Long): Boolean = ageMs in 0L..MAX_LAST_KNOWN_AGE_MS

    private fun providerRank(provider: String): Int = when (provider) {
        PROVIDER_GPS -> 0
        PROVIDER_FUSED -> 1
        PROVIDER_NETWORK -> 2
        else -> 3
    }
}

private data class ProviderFix(val provider: String, val location: Location?)

private fun Location.toCandidate(provider: String, ageMs: Long = 0L): LocationCandidate = LocationCandidate(
    provider = provider,
    latitude = latitude,
    longitude = longitude,
    accuracyMeters = if (hasAccuracy()) accuracy else null,
    isMock = LocationCompat.isMock(this),
    ageMs = ageMs,
)

@SuppressLint("MissingPermission")
private suspend fun requestProviderLocation(context: Context, manager: LocationManager, provider: String): Location? =
    suspendCancellableCoroutine { continuation ->
        val cancellation = CancellationSignal()
        continuation.invokeOnCancellation { cancellation.cancel() }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && provider == LocationManager.FUSED_PROVIDER) {
                val request = LocationRequest.Builder(0)
                    .setQuality(LocationRequest.QUALITY_HIGH_ACCURACY)
                    .setDurationMillis(LocationFixPolicy.LIVE_TIMEOUT_MS)
                    .build()
                manager.getCurrentLocation(
                    provider,
                    request,
                    cancellation,
                    ContextCompat.getMainExecutor(context),
                ) { location ->
                    if (continuation.isActive) continuation.resume(location)
                }
            } else {
                LocationManagerCompat.getCurrentLocation(
                    manager,
                    provider,
                    cancellation,
                    ContextCompat.getMainExecutor(context),
                ) { location ->
                    if (continuation.isActive) continuation.resume(location)
                }
            }
        } catch (_: Exception) {
            if (continuation.isActive) continuation.resume(null)
        }
    }

@SuppressLint("MissingPermission")
private fun findFreshLastKnownLocation(manager: LocationManager, providers: List<String>): Location? {
    val nowElapsedNanos = SystemClock.elapsedRealtimeNanos()
    var bestPair: Pair<Location, LocationCandidate>? = null
    providers.forEach { provider ->
        val cached = runCatching { manager.getLastKnownLocation(provider) }.getOrNull() ?: return@forEach
        val fixNanos = cached.elapsedRealtimeNanos
        val ageMs = if (fixNanos > 0L) (nowElapsedNanos - fixNanos) / 1_000_000L else -1L
        if (LocationFixPolicy.isFreshLastKnown(ageMs)) {
            val candidate = cached.toCandidate(provider, ageMs)
            if (candidate.isMock) {
                throw Exception("Lokasi palsu terdeteksi. Nonaktifkan aplikasi mock location.")
            }
            if (LocationFixPolicy.isValidCoordinates(candidate.latitude, candidate.longitude)) {
                val currentBest = bestPair?.second
                if (currentBest == null || LocationFixPolicy.isBetter(candidate, currentBest)) {
                    bestPair = cached to candidate
                }
            }
        }
    }
    return bestPair?.first
}

private fun enabledLocationProviders(manager: LocationManager): List<String> = buildList {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        runCatching {
            manager.hasProvider(LocationManager.FUSED_PROVIDER) &&
                manager.isProviderEnabled(LocationManager.FUSED_PROVIDER)
        }.getOrDefault(false)
    ) {
        add(LocationManager.FUSED_PROVIDER)
    }
    if (runCatching { manager.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false)) {
        add(LocationManager.GPS_PROVIDER)
    }
    if (runCatching { manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false)) {
        add(LocationManager.NETWORK_PROVIDER)
    }
}

private data class LiveLocationOutcome(val location: Location?, val sawInvalidCoordinates: Boolean)

private suspend fun collectBestLiveLocation(channel: Channel<ProviderFix>, providerCount: Int): LiveLocationOutcome {
    var bestLocation: Location? = null
    var bestCandidate: LocationCandidate? = null
    var sawInvalidCoordinates = false
    val overallDeadline = SystemClock.elapsedRealtime() + LocationFixPolicy.LIVE_TIMEOUT_MS
    var refinementDeadline: Long? = null
    var remaining = providerCount
    var done = false

    while (remaining > 0 && !done) {
        val targetDeadline = refinementDeadline?.let { minOf(overallDeadline, it) } ?: overallDeadline
        val waitMs = targetDeadline - SystemClock.elapsedRealtime()
        val result = if (waitMs > 0L) withTimeoutOrNull(waitMs) { channel.receive() } else null
        if (result == null) {
            done = true
        } else {
            remaining--
            val loc = result.location
            if (loc != null) {
                val candidate = loc.toCandidate(result.provider)
                if (candidate.isMock) {
                    throw Exception("Lokasi palsu terdeteksi. Nonaktifkan aplikasi mock location.")
                }
                if (!LocationFixPolicy.isValidCoordinates(candidate.latitude, candidate.longitude)) {
                    sawInvalidCoordinates = true
                } else {
                    if (bestCandidate == null || LocationFixPolicy.isBetter(candidate, bestCandidate)) {
                        bestCandidate = candidate
                        bestLocation = loc
                    }
                    if (LocationFixPolicy.isImmediateFix(candidate)) {
                        done = true
                    } else if (refinementDeadline == null) {
                        refinementDeadline = SystemClock.elapsedRealtime() + LocationFixPolicy.REFINEMENT_WINDOW_MS
                    }
                }
            }
        }
    }
    return LiveLocationOutcome(bestLocation, sawInvalidCoordinates)
}

suspend fun currentLocation(context: Context): Location {
    check(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
        "Izinkan lokasi presisi untuk presensi."
    }
    val manager = context.getSystemService(LocationManager::class.java)
    val providers = enabledLocationProviders(manager)
    check(LocationManagerCompat.isLocationEnabled(manager) && providers.isNotEmpty()) {
        "Aktifkan lokasi perangkat lalu coba lagi."
    }

    return coroutineScope {
        val channel = Channel<ProviderFix>(capacity = providers.size)
        val jobs = providers.map { provider ->
            launch {
                val location = requestProviderLocation(context, manager, provider)
                channel.trySend(ProviderFix(provider, location))
            }
        }
        val outcome = try {
            collectBestLiveLocation(channel, providers.size)
        } finally {
            jobs.forEach { it.cancel() }
            channel.close()
        }

        outcome.location
            ?: findFreshLastKnownLocation(manager, providers)
            ?: if (outcome.sawInvalidCoordinates) {
                throw Exception("Koordinat lokasi tidak valid.")
            } else {
                throw Exception("Lokasi belum ditemukan. Pastikan GPS/lokasi aktif lalu coba lagi di area terbuka.")
            }
    }
}

fun captureFile(context: Context): File = File(context.cacheDir, "capture-${UUID.randomUUID()}.jpg")

suspend fun prepareImage(context: Context, uri: Uri, maxBytes: Long): File = withContext(Dispatchers.IO) {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    check(options.outWidth > 0 && options.outHeight > 0) { "File bukan gambar yang dapat dibaca." }
    options.inSampleSize = 1
    while (maxOf(options.outWidth, options.outHeight) / options.inSampleSize > 2560) {
        options.inSampleSize *= 2
    }
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
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                postScale(-1f, 1f)
                postRotate(270f)
            }
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                postScale(-1f, 1f)
                postRotate(90f)
            }
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
