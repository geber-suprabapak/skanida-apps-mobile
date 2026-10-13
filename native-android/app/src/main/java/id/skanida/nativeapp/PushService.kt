package id.skanida.nativeapp

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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PushController(private val app: SkanidaApplication) {
    private val lock = Mutex()
    fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) app.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel("skanida-default", "Notifikasi Skanida", NotificationManager.IMPORTANCE_DEFAULT))
    }
    fun permissionGranted() = NotificationManagerCompat.from(app).areNotificationsEnabled() &&
        (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    fun registeredForCurrentUser() = app.identity.signedIn && app.preferences.getString("push-owner", "") == app.identity.userId && app.preferences.getBoolean("push:${app.identity.userId}", false)
    fun enabledForCurrentUser() = registeredForCurrentUser() && permissionGranted()

    suspend fun enable() = lock.withLock {
        check(permissionGranted()) { "Izinkan notifikasi melalui pengaturan perangkat." }
        check(FirebaseApp.getApps(app).isNotEmpty()) { "Konfigurasi Firebase belum tersedia pada build ini." }
        val user = app.identity.userId
        check(user.isNotBlank()) { "Login terlebih dahulu." }
        if (app.preferences.getBoolean("push-detach-pending", false)) {
            // Retire the previous account's device token before assigning this installation to another account.
            withTimeout(30_000) { suspendCancellableCoroutine<Unit> { continuation ->
                FirebaseMessaging.getInstance().deleteToken().addOnSuccessListener { if (continuation.isActive) continuation.resume(Unit) }
                    .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
            } }
        }
        val deviceToken = withTimeout(30_000) { suspendCancellableCoroutine<String> { continuation ->
            FirebaseMessaging.getInstance().token.addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
                .addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
        } }
        val deviceId = app.preferences.getString("push-installation", null) ?: UUID.randomUUID().toString().also {
            app.preferences.edit().putString("push-installation", it).apply()
        }
        // Astra's existing sender expects Expo tokens. Register FCM through its public API without an Expo runtime.
        val token = withContext(Dispatchers.IO) {
            val body = json("type" to "fcm", "deviceId" to deviceId, "development" to false,
                "appId" to BuildConfig.APPLICATION_ID, "deviceToken" to deviceToken, "projectId" to BuildConfig.EXPO_PROJECT_ID)
            val client = OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).build()
            client.newCall(Request.Builder().url("https://exp.host/--/api/v2/push/getExpoPushToken")
                .post(body.toString().toRequestBody("application/json".toMediaType())).build()).execute().use {
                check(it.isSuccessful) { "Pendaftaran notifikasi gagal (${it.code}). Silakan coba lagi." }
                JSONObject(it.body?.string().orEmpty()).optJSONObject("data")?.text("expoPushToken")?.takeIf { it.isNotBlank() }
                    ?: error("Layanan notifikasi tidak mengembalikan token.")
            }
        }
        check(user == app.identity.userId) { "Akun berubah. Coba lagi." }
        app.astra.send("/v1/mobile/notifications/token", json("token" to token), "PATCH")
        app.preferences.edit().putBoolean("push:$user", true).putBoolean("push-opt-out:$user", false)
            .putString("push-owner", user).putBoolean("push-detach-pending", false).apply()
    }
    fun localLogout() {
        app.preferences.edit().putString("push-owner", "").putBoolean("push-detach-pending", true).apply()
        NotificationManagerCompat.from(app).cancelAll()
    }

    suspend fun disable() = lock.withLock {
        val user = app.identity.userId
        app.astra.send("/v1/mobile/notifications/token", json("token" to null), "PATCH")
        app.preferences.edit().putBoolean("push:$user", false).putBoolean("push-opt-out:$user", true).apply()
        NotificationManagerCompat.from(app).cancelAll()
    }
    suspend fun clearRevokedPermission() {
        // Keep the user's app opt-in so restoring OS permission can be reconciled.
        app.astra.send("/v1/mobile/notifications/token", json("token" to null), "PATCH")
        app.preferences.edit().putBoolean("push:${app.identity.userId}", false).apply()
    }
    suspend fun reconcile(): Boolean {
        val stored = app.astra.get("/v1/mobile/notifications/token").text("notification_token")
        if (!permissionGranted() && stored.isNotBlank()) clearRevokedPermission()
        else if (permissionGranted() && !app.preferences.getBoolean("push-opt-out:${app.identity.userId}", false) &&
            (!registeredForCurrentUser() || stored.isBlank())) enable()
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
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, "skanida-default").setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true).setContentIntent(pending).build()
        if (app.push.permissionGranted()) {
            try {
                NotificationManagerCompat.from(this).notify(message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(), notification)
            } catch (_: SecurityException) {
                // Permission can be revoked between the check and delivery.
                return
            }
        }
    }
}
