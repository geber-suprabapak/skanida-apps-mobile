package id.skanida.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import net.openid.appauth.AuthState
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class IdentityLiveSmokeTest {
    @Test fun ownedTestSessionRefreshesAndReadsAstra() = runBlocking {
        val arguments = InstrumentationRegistry.getArguments()
        assumeTrue(arguments.getString("allowOwnedLiveSmoke") == "native-compose-20261013")
        val expectedUser = arguments.getString("expectedUserId").orEmpty()
        check(expectedUser.isNotBlank()) { "Pass the exact owned test identity; never run against an arbitrary session." }
        val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as SkanidaApplication
        assertTrue("The installed session must belong to the explicitly selected test account", app.identity.userId == expectedUser)

        val field = Identity::class.java.getDeclaredField("state").apply { isAccessible = true }
        val state = field.get(app.identity) as AuthState
        assertTrue("Logto must issue the requested offline refresh token", !state.refreshToken.isNullOrBlank())
        val previousToken = state.accessToken
        // Force the real AppAuth refresh path in the test APK; no test hook ships in production.
        state.setNeedsTokenRefresh(true)
        withTimeout(45_000) {
            assertTrue("Profile must be returned by authenticated Astra", app.astra.get("/v1/mobile/profile").text("user_id") == expectedUser)
            assertTrue("Dashboard must include the server-owned primary action", app.astra.get("/v1/mobile/dashboard").has("primary_action"))
            assertTrue("Permit history must use the Astra envelope", app.astra.get("/v1/mobile/permits").has("items"))
        }
        assertTrue("A real refreshed access token must replace the prior token", state.accessToken != previousToken)
        val persisted = AuthState.jsonDeserialize(checkNotNull(SessionStore(app).read()))
        assertTrue("The refreshed session must be persisted encrypted", persisted.accessToken == state.accessToken)
    }
}
