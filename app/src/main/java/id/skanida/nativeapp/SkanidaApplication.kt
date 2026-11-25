package id.skanida.nativeapp

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import id.skanida.nativeapp.data.api.Astra
import id.skanida.nativeapp.data.auth.Identity
import id.skanida.nativeapp.data.device.NetworkMonitor
import id.skanida.nativeapp.data.device.PushController
import id.skanida.nativeapp.data.device.cleanupStaleCaptures
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class SkanidaApplication :
    Application(),
    ImageLoaderFactory {
    val identity by lazy { Identity(this) }
    val astra by lazy { Astra(identity) }
    val preferences by lazy { getSharedPreferences("settings", Context.MODE_PRIVATE) }
    val push by lazy { PushController(this) }
    val networkMonitor by lazy { NetworkMonitor(this) }
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    val isLowRamDevice: Boolean by lazy {
        getSystemService(ActivityManager::class.java)?.isLowRamDevice == true
    }

    @Volatile
    private var firebaseInitialized = false

    override fun onCreate() {
        super.onCreate()
        // Move Keystore decrypt, Firebase init, notification channel setup, and cache cleanup off the main thread.
        scope.launch(Dispatchers.IO) {
            identity.warmUp()
            ensureFirebaseInitialized()
            push.createChannel()
            cleanupStaleCaptures(cacheDir)
        }
    }

    @Synchronized
    fun ensureFirebaseInitialized() {
        if (firebaseInitialized) return
        if (BuildConfig.FIREBASE_APP_ID.isNotBlank() && FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(
                this,
                FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build(),
            )
        }
        firebaseInitialized = true
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .okHttpClient { astra.httpClient }
        .allowRgb565(true)
        .crossfade(if (isLowRamDevice) 0 else 120)
        .memoryCache {
            MemoryCache.Builder(this)
                .maxSizePercent(if (isLowRamDevice) 0.10 else 0.15)
                .build()
        }
        .diskCache {
            DiskCache.Builder()
                .directory(File(cacheDir, "image_cache"))
                .maxSizeBytes(20L * 1024 * 1024)
                .build()
        }
        .build()
}
