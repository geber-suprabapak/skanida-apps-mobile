package id.skanida.nativeapp

import id.skanida.nativeapp.data.device.LocationCandidate
import id.skanida.nativeapp.data.device.LocationFixPolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocationFixPolicyTest {
    @Test
    fun rejectsMockAndOutOfRangeCoordinates() {
        assertFalse(LocationFixPolicy.isValidCoordinates(Double.NaN, 110.22))
        assertFalse(LocationFixPolicy.isValidCoordinates(-91.0, 110.22))
        assertFalse(LocationFixPolicy.isValidCoordinates(-7.47, 181.0))
        assertTrue(LocationFixPolicy.isValidCoordinates(-7.4706, 110.2178))

        val mockedFused = LocationCandidate(
            provider = LocationFixPolicy.PROVIDER_FUSED,
            latitude = -7.4706,
            longitude = 110.2178,
            accuracyMeters = 10f,
            isMock = true,
        )
        assertFalse(LocationFixPolicy.isImmediateFix(mockedFused))
    }

    @Test
    fun acceptsAccurateFusedOrGpsImmediatelyAndRefinesNetworkOrCoarseFixes() {
        val fusedAccurate = LocationCandidate(
            provider = LocationFixPolicy.PROVIDER_FUSED,
            latitude = -7.4706,
            longitude = 110.2178,
            accuracyMeters = 18f,
            isMock = false,
        )
        val gpsAccurate = fusedAccurate.copy(provider = LocationFixPolicy.PROVIDER_GPS, accuracyMeters = 12f)
        val networkWifi = fusedAccurate.copy(provider = LocationFixPolicy.PROVIDER_NETWORK, accuracyMeters = 25f)
        val fusedCoarse = fusedAccurate.copy(accuracyMeters = 120f)

        assertTrue(LocationFixPolicy.isImmediateFix(fusedAccurate))
        assertTrue(LocationFixPolicy.isImmediateFix(gpsAccurate))
        assertFalse(LocationFixPolicy.isImmediateFix(networkWifi))
        assertFalse(LocationFixPolicy.isImmediateFix(fusedCoarse))
    }

    @Test
    fun prefersTighterAccuracyAndRespectsFreshLastKnownWindow() {
        val cellFix = LocationCandidate(
            provider = LocationFixPolicy.PROVIDER_NETWORK,
            latitude = -7.47,
            longitude = 110.22,
            accuracyMeters = 250f,
            isMock = false,
        )
        val fusedFix = cellFix.copy(provider = LocationFixPolicy.PROVIDER_FUSED, accuracyMeters = 22f)
        val gpsTie = fusedFix.copy(provider = LocationFixPolicy.PROVIDER_GPS, accuracyMeters = 22f)

        assertTrue(LocationFixPolicy.isBetter(fusedFix, cellFix))
        assertFalse(LocationFixPolicy.isBetter(cellFix, fusedFix))
        assertTrue(LocationFixPolicy.isBetter(gpsTie, fusedFix))

        assertTrue(LocationFixPolicy.isFreshLastKnown(0L))
        assertTrue(LocationFixPolicy.isFreshLastKnown(120_000L))
        assertFalse(LocationFixPolicy.isFreshLastKnown(-1L))
        assertFalse(LocationFixPolicy.isFreshLastKnown(120_001L))
    }
}
