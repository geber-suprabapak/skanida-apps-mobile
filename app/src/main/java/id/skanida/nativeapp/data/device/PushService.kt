package id.skanida.nativeapp.data.device

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import id.skanida.nativeapp.BuildConfig
import id.skanida.nativeapp.MainActivity
import id.skanida.nativeapp.R
import id.skanida.nativeapp.SkanidaApplication
import id.skanida.nativeapp.data.model.json
import id.skanida.nativeapp.data.model.text
import id.skanida.nativeapp.domain.workflow.NotificationChannelPrefs
import id.skanida.nativeapp.domain.workflow.shouldDeliverNotification
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class PushController(private val app: SkanidaApplication) {
    private val lock = Mutex()

    fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            app.getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel("skanida-default", "Notifikasi Skanida", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }
    }

    fun permissionGranted() = NotificationManagerCompat.from(app).areNotificationsEnabled() &&
        (
            Build.VERSION.SDK_INT < 33 ||
                ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            )

    fun registeredForCurrentUser() = app.identity.signedIn &&
        app.preferences.getString("push-owner", "") == app.identity.userId &&
        app.preferences.getBoolean("push:${app.identity.userId}", false)

    fun enabledForCurrentUser() = registeredForCurrentUser() && permissionGranted()

    fun channelPrefs(): NotificationChannelPrefs = NotificationChannelPrefs(
        checkIn = app.preferences.getBoolean("notif_pref_checkin", true),
        checkOut = app.preferences.getBoolean("notif_pref_checkout", true),
        permitUpdates = app.preferences.getBoolean("notif_pref_permits", true),
    )

    fun saveChannelPrefs(prefs: NotificationChannelPrefs) {
        app.preferences.edit()
            .putBoolean("notif_pref_checkin", prefs.checkIn)
            .putBoolean("notif_pref_checkout", prefs.checkOut)
            .putBoolean("notif_pref_permits", prefs.permitUpdates)
            .apply()
    }

    suspend fun enable() = lock.withLock {
        check(permissionGranted()) { "Izinkan notifikasi melalui pengaturan perangkat." }
        withContext(Dispatchers.IO) { app.ensureFirebaseInitialized() }
        check(FirebaseApp.getApps(app).isNotEmpty()) { "Konfigurasi Firebase belum tersedia pada build ini." }
        val user = app.identity.userId
        check(user.isNotBlank()) { "Login terlebih dahulu." }
        if (app.preferences.getBoolean("push-detach-pending", false)) {
            // Retire the previous account's device token before assigning this installation to another account.
            withTimeout(30_000) {
                suspendCancellableCoroutine<Unit> { continuation ->
                    FirebaseMessaging.getInstance().deleteToken()
                        .addOnSuccessListener { if (continuation.isActive) continuation.resume(Unit) }
                        .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
                }
            }
        }
        val deviceToken = withTimeout(30_000) {
            suspendCancellableCoroutine<String> { continuation ->
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
                    .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
            }
        }
        val deviceId = app.preferences.getString("push-installation", null) ?: UUID.randomUUID().toString().also {
            app.preferences.edit().putString("push-installation", it).apply()
        }
        // Astra's existing sender expects Expo tokens. Register FCM through its public API without an Expo runtime.
        val token = withContext(Dispatchers.IO) {
            val body = json(
                "type" to "fcm",
                "deviceId" to deviceId,
                "development" to false,
                "appId" to BuildConfig.APPLICATION_ID,
                "deviceToken" to deviceToken,
                "projectId" to BuildConfig.EXPO_PROJECT_ID,
            )
            val client = app.astra.httpClient.newBuilder()
                .callTimeout(30, TimeUnit.SECONDS)
                .build()
            client.newCall(
                Request.Builder()
                    .url("https://exp.host/--/api/v2/push/getExpoPushToken")
                    .post(body.toString().toRequestBody("application/json".toMediaType()))
                    .build(),
            ).execute().use {
                check(it.isSuccessful) { "Pendaftaran notifikasi gagal (${it.code}). Silakan coba lagi." }
                JSONObject(it.body?.string().orEmpty()).optJSONObject("data")?.text("expoPushToken")
                    ?.takeIf { t -> t.isNotBlank() }
                    ?: error("Layanan notifikasi tidak mengembalikan token.")
            }
        }
        check(user == app.identity.userId) { "Akun berubah. Coba lagi." }
        app.astra.setNotificationToken(token)
        app.preferences.edit()
            .putBoolean("push:$user", true)
            .putBoolean("push-opt-out:$user", false)
            .putString("push-owner", user)
            .putBoolean("push-detach-pending", false)
            .apply()
    }

    fun localLogout() {
        app.preferences.edit().putString("push-owner", "").putBoolean("push-detach-pending", true).apply()
        NotificationManagerCompat.from(app).cancelAll()
    }

    suspend fun disable() = lock.withLock {
        val user = app.identity.userId
        app.astra.setNotificationToken(null)
        app.preferences.edit()
            .putBoolean("push:$user", false)
            .putBoolean("push-opt-out:$user", true)
            .apply()
        NotificationManagerCompat.from(app).cancelAll()
    }

    suspend fun clearRevokedPermission() {
        // Keep the user's app opt-in so restoring OS permission can be reconciled.
        app.astra.setNotificationToken(null)
        app.preferences.edit().putBoolean("push:${app.identity.userId}", false).apply()
    }

    suspend fun reconcile(): Boolean {
        val stored = app.astra.getNotificationToken()
        val optedOut = app.preferences.getBoolean("push-opt-out:${app.identity.userId}", false)
        val needsRegistration = !registeredForCurrentUser() || stored.isBlank()
        if (!permissionGranted() && stored.isNotBlank()) {
            clearRevokedPermission()
        } else if (permissionGranted() && !optedOut && needsRegistration) {
            enable()
        }
        return enabledForCurrentUser()
    }
}

class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val app = application as SkanidaApplication
        if (app.push.enabledForCurrentUser()) app.scope.launch { runCatching { app.push.enable() } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val app = application as SkanidaApplication
        if (!app.push.enabledForCurrentUser()) return
        val payload = runCatching { JSONObject(message.data["body"].orEmpty()) }.getOrDefault(JSONObject())
        val title = message.notification?.title ?: message.data["title"] ?: payload.text("title", "Skanida Apps")
        val body = message.notification?.body ?: message.data["message"] ?: payload.text("body")
        val type = message.data["type"] ?: payload.text("type")
        if (!shouldDeliverNotification(app.push.channelPrefs(), type = type, title = title, body = body)) {
            return
        }
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, "skanida-default")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        if (app.push.permissionGranted()) {
            try {
                NotificationManagerCompat.from(this)
                    .notify(message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(), notification)
            } catch (_: SecurityException) {
                // Permission can be revoked between the check and delivery.
                return
            }
        }
    }
}
