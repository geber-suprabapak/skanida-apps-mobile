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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
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

internal object JwtClaimsParser {
    private val TRUTHY_FLAGS = setOf("true", "1", "yes")

    fun parsePayload(jwt: String?): JSONObject {
        if (jwt.isNullOrBlank()) return JSONObject()
        val firstDot = jwt.indexOf('.')
        if (firstDot < 0) return JSONObject()
        val secondDot = jwt.indexOf('.', firstDot + 1)
        if (secondDot <= firstDot + 1) return JSONObject()
        val payloadPart = jwt.substring(firstDot + 1, secondDot)
        return runCatching {
            val decoded = Base64.decode(payloadPart, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            JSONObject(String(decoded, Charsets.UTF_8))
        }.getOrDefault(JSONObject())
    }

    fun isMustChangePassword(claims: JSONObject): Boolean =
        claims.opt("must_change_password")?.toString()?.lowercase() in TRUTHY_FLAGS
}

class Identity(context: Context) {
    private val appContext = context.applicationContext
    private val store = SessionStore(appContext)
    private val appAuthConfig = AppAuthConfiguration.Builder()
        .setConnectionBuilder(StagingAwareConnectionBuilder)
        .build()
    private val service by lazy { AuthorizationService(appContext, appAuthConfig) }
    private val stateLock = Any()
    private val refreshLock = Mutex()

    @Volatile
    private var stateLoaded = false

    @Volatile
    private var state: AuthState = AuthState()

    @Volatile
    private var generation = 0

    @Volatile
    private var cachedClaimsToken: String? = null

    @Volatile
    private var cachedClaims: JSONObject = JSONObject()

    // Safe to call from a background thread during Application.onCreate so Keystore I/O overlaps Activity launch.
    fun warmUp() {
        ensureLoaded()
    }

    private fun ensureLoaded(): AuthState {
        if (stateLoaded) return state
        synchronized(stateLock) {
            if (!stateLoaded) {
                state = store.read()?.let { runCatching { AuthState.jsonDeserialize(it) }.getOrNull() } ?: AuthState()
                stateLoaded = true
            }
            return state
        }
    }

    val signedIn: Boolean get() = ensureLoaded().isAuthorized

    val claims: JSONObject
        get() {
            val current = ensureLoaded()
            val token = current.idToken ?: current.accessToken ?: ""
            if (token == cachedClaimsToken) return cachedClaims
            val parsed = JwtClaimsParser.parsePayload(token)
            cachedClaimsToken = token
            cachedClaims = parsed
            return parsed
        }

    val userId: String get() = claims.optString("sub")
    val mustChangePassword: Boolean get() = JwtClaimsParser.isMustChangePassword(claims)

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
        // INV-MOBILE-009: Preserve PKCE, offline_access, and prompt=consent so Logto issues refresh tokens.
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
        ensureLoaded()
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
        synchronized(stateLock) {
            state = next
            stateLoaded = true
            cachedClaimsToken = null
        }
        val roles = claims.optJSONArray("roles")
        if (roles == null || (0 until roles.length()).none { roles.optString(it) in ALLOWED_ROLES }) {
            clear()
            error("Akun ini tidak memiliki akses siswa. Hubungi administrator.")
        }
        try {
            val serialized = next.jsonSerializeString()
            withContext(Dispatchers.IO) { store.write(serialized) }
        } catch (failure: Exception) {
            clear()
            throw failure
        }
    }

    suspend fun accessToken(): String {
        val snapshot = ensureLoaded()
        check(snapshot.isAuthorized) { "Sesi tidak valid. Silakan login ulang." }
        val fastToken = snapshot.accessToken
        val fastExpiry = snapshot.accessTokenExpirationTime ?: 0L
        // Fast path avoids Keystore AES-GCM write + SharedPreferences.commit() on every API call.
        if (!fastToken.isNullOrBlank() && fastExpiry > System.currentTimeMillis() + TOKEN_EXPIRY_BUFFER_MS) {
            return fastToken
        }

        return refreshLock.withLock {
            val current = ensureLoaded()
            check(current.isAuthorized) { "Sesi tidak valid. Silakan login ulang." }
            val currentToken = current.accessToken
            val currentExpiry = current.accessTokenExpirationTime ?: 0L
            if (!currentToken.isNullOrBlank() && currentExpiry > System.currentTimeMillis() + TOKEN_EXPIRY_BUFFER_MS) {
                return@withLock currentToken
            }
            if (current.refreshToken.isNullOrBlank()) {
                if (currentToken == null || currentExpiry <= System.currentTimeMillis()) {
                    clear()
                    error("Sesi telah berakhir. Silakan login ulang.")
                }
                return@withLock currentToken
            }

            val previousAccess = current.accessToken
            val previousRefresh = current.refreshToken
            val previousExpiry = current.accessTokenExpirationTime
            val expectedGeneration = generation

            val freshToken = suspendCancellableCoroutine<String> { continuation ->
                current.performActionWithFreshTokens(service, mapOf("resource" to BuildConfig.LOGTO_RESOURCE)) { token, _, error ->
                    if (expectedGeneration != generation) {
                        if (continuation.isActive) continuation.resumeWithException(Exception("Sesi telah berakhir."))
                        return@performActionWithFreshTokens
                    }
                    if (error != null) {
                        if (error.error in TERMINAL_REFRESH_ERRORS) clear()
                        // INV-MOBILE-006: Transient network failures must preserve the encrypted refresh token.
                        if (continuation.isActive) {
                            continuation.resumeWithException(
                                Exception(error.errorDescription ?: "Sesi belum dapat diperbarui. Periksa koneksi."),
                            )
                        }
                    } else if (token != null) {
                        if (continuation.isActive) continuation.resume(token)
                    } else {
                        if (continuation.isActive) {
                            continuation.resumeWithException(Exception("Sesi tidak valid. Silakan login ulang."))
                        }
                    }
                }
            }

            val tokenRotated = current.accessToken != previousAccess ||
                current.refreshToken != previousRefresh ||
                current.accessTokenExpirationTime != previousExpiry
            if (tokenRotated && expectedGeneration == generation) {
                cachedClaimsToken = null
                val serialized = current.jsonSerializeString()
                withContext(Dispatchers.IO) { store.write(serialized) }
            }
            freshToken
        }
    }

    fun logoutIntent(): Intent? {
        val current = ensureLoaded()
        val config = current.authorizationServiceConfiguration ?: return null
        if (config.endSessionEndpoint == null) return null
        return service.getEndSessionRequestIntent(
            EndSessionRequest.Builder(config)
                .setIdTokenHint(current.idToken)
                .setPostLogoutRedirectUri(Uri.parse(BuildConfig.LOGTO_REDIRECT))
                .build(),
        )
    }

    fun clear() {
        synchronized(stateLock) {
            generation++
            state = AuthState()
            stateLoaded = true
            cachedClaimsToken = null
            cachedClaims = JSONObject()
        }
        store.clear()
    }

    private companion object {
        const val TOKEN_EXPIRY_BUFFER_MS = 60_000L
        val ALLOWED_ROLES = setOf("student", "siswa")
        val TERMINAL_REFRESH_ERRORS = setOf("invalid_grant", "invalid_client", "unauthorized_client")
    }
}
