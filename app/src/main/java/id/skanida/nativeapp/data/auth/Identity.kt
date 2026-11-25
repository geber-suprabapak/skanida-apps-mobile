package id.skanida.nativeapp.data.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import id.skanida.nativeapp.BuildConfig
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.openid.appauth.AppAuthConfiguration
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.EndSessionRequest
import net.openid.appauth.ResponseTypeValues
import net.openid.appauth.TokenResponse
import net.openid.appauth.connectivity.ConnectionBuilder
import net.openid.appauth.connectivity.DefaultConnectionBuilder
import org.json.JSONObject

private object StagingAwareConnectionBuilder : ConnectionBuilder {
    private val timeoutMs = TimeUnit.SECONDS.toMillis(15).toInt()

    override fun openConnection(uri: Uri): HttpURLConnection {
        if (BuildConfig.ALLOW_INSECURE_HTTP && uri.scheme.equals("http", ignoreCase = true)) {
            val conn = URL(uri.toString()).openConnection() as HttpURLConnection
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.instanceFollowRedirects = false
            return conn
        }
        return DefaultConnectionBuilder.INSTANCE.openConnection(uri)
    }
}

class Identity(context: Context) {
    private val store = SessionStore(context)
    private val appAuthConfig = AppAuthConfiguration.Builder()
        .setConnectionBuilder(StagingAwareConnectionBuilder)
        .build()
    private val service = AuthorizationService(context, appAuthConfig)
    private var state = store.read()?.let { runCatching { AuthState.jsonDeserialize(it) }.getOrNull() } ?: AuthState()
    private val refreshLock = Mutex()
    private var generation = 0

    val signedIn get() = state.isAuthorized
    val claims: JSONObject
        get() = runCatching {
            val token = state.idToken ?: state.accessToken ?: ""
            JSONObject(String(Base64.decode(token.split('.')[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)))
        }.getOrDefault(JSONObject())
    val userId get() = claims.optString("sub")
    val mustChangePassword get() = claims.opt("must_change_password")?.toString() in listOf("true", "1", "yes")

    suspend fun loginIntent(): Intent {
        val discoveryUri = Uri.parse("${BuildConfig.LOGTO_URL.trimEnd('/')}/oidc/.well-known/openid-configuration")
        val config = suspendCancellableCoroutine<AuthorizationServiceConfiguration> { continuation ->
            AuthorizationServiceConfiguration.fetchFromUrl(
                discoveryUri,
                { config, error ->
                    if (continuation.isActive) {
                        if (config != null) {
                            continuation.resume(config)
                        } else {
                            continuation.resumeWithException(Exception(error?.errorDescription ?: "Layanan login tidak tersedia."))
                        }
                    }
                },
                StagingAwareConnectionBuilder,
            )
        }
        val request = AuthorizationRequest.Builder(
            config,
            BuildConfig.LOGTO_CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(BuildConfig.LOGTO_REDIRECT),
        )
            .setScopes("openid", "profile", "email", "roles", "offline_access", "mobile:access")
            .setPrompt("consent")
            .setAdditionalParameters(mapOf("resource" to BuildConfig.LOGTO_RESOURCE))
            .build()
        return service.getAuthorizationRequestIntent(request)
    }

    suspend fun completeLogin(intent: Intent) {
        val response = AuthorizationResponse.fromIntent(intent)
            ?: throw Exception(AuthorizationException.fromIntent(intent)?.errorDescription ?: "Login dibatalkan. Silakan coba lagi.")
        val pendingGeneration = generation
        val token = suspendCancellableCoroutine<TokenResponse> { continuation ->
            service.performTokenRequest(response.createTokenExchangeRequest(mapOf("resource" to BuildConfig.LOGTO_RESOURCE))) {
                    token,
                    error,
                ->
                if (continuation.isActive) {
                    if (token != null) {
                        continuation.resume(token)
                    } else {
                        continuation.resumeWithException(Exception(error?.errorDescription ?: "Login gagal."))
                    }
                }
            }
        }
        check(pendingGeneration == generation) { "Login dibatalkan." }
        val next = AuthState(response, token, null)
        check(next.isAuthorized) { "Identity provider tidak mengembalikan sesi." }
        state = next
        val roles = claims.optJSONArray("roles")
        if (roles == null || (0 until roles.length()).none { roles.optString(it) in listOf("student", "siswa") }) {
            clear()
            error("Akun ini tidak memiliki akses siswa. Hubungi administrator.")
        }
        try {
            store.write(state.jsonSerializeString())
        } catch (failure: Exception) {
            clear()
            throw failure
        }
    }

    suspend fun accessToken(): String = refreshLock.withLock {
        check(signedIn) { "Sesi tidak valid. Silakan login ulang." }
        if (state.refreshToken.isNullOrBlank()) {
            val token = state.accessToken
            if (token == null || (state.accessTokenExpirationTime ?: 0L) <= System.currentTimeMillis()) {
                clear()
                error("Sesi telah berakhir. Silakan login ulang.")
            }
            return@withLock token
        }
        val current = state
        val expectedGeneration = generation
        suspendCancellableCoroutine { continuation ->
            current.performActionWithFreshTokens(service, mapOf("resource" to BuildConfig.LOGTO_RESOURCE)) { token, _, error ->
                if (expectedGeneration != generation) {
                    if (continuation.isActive) continuation.resumeWithException(Exception("Sesi telah berakhir."))
                    return@performActionWithFreshTokens
                }
                if (error != null) {
                    if (error.error in setOf("invalid_grant", "invalid_client", "unauthorized_client")) clear()
                    // Transient network failures must preserve the encrypted refresh token.
                    if (continuation.isActive) {
                        continuation.resumeWithException(
                            Exception(error.errorDescription ?: "Sesi belum dapat diperbarui. Periksa koneksi."),
                        )
                    }
                } else {
                    try {
                        store.write(current.jsonSerializeString())
                        if (continuation.isActive) {
                            if (token != null) {
                                continuation.resume(token)
                            } else {
                                continuation.resumeWithException(Exception("Sesi tidak valid. Silakan login ulang."))
                            }
                        }
                    } catch (failure: Exception) {
                        if (continuation.isActive) continuation.resumeWithException(failure)
                    }
                }
            }
        }
    }

    fun logoutIntent(): Intent? {
        val config = state.authorizationServiceConfiguration ?: return null
        if (config.endSessionEndpoint == null) return null
        return service.getEndSessionRequestIntent(
            EndSessionRequest.Builder(config)
                .setIdTokenHint(state.idToken)
                .setPostLogoutRedirectUri(Uri.parse(BuildConfig.LOGTO_REDIRECT))
                .build(),
        )
    }

    fun clear() {
        generation++
        state = AuthState()
        store.clear()
    }
}
