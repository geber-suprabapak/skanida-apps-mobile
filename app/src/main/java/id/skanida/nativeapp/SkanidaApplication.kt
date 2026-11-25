package id.skanida.nativeapp

import android.app.Application
import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import id.skanida.nativeapp.data.api.Astra
import id.skanida.nativeapp.data.auth.Identity
import id.skanida.nativeapp.data.device.NetworkMonitor
import id.skanida.nativeapp.data.device.PushController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class SkanidaApplication : Application() {
    val identity by lazy { Identity(this) }
    val astra by lazy { Astra(identity) }
    val preferences by lazy { getSharedPreferences("settings", Context.MODE_PRIVATE) }
    val push by lazy { PushController(this) }
    val networkMonitor by lazy { NetworkMonitor(this) }
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun onCreate() {
        super.onCreate()
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
        push.createChannel()
    }
}
