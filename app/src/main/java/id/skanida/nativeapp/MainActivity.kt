package id.skanida.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import id.skanida.nativeapp.ui.navigation.SkanidaAppHost
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.SkanidaTheme

private val CAMERA_CAPTURE_PAGES = setOf(Page.ATTENDANCE, Page.ATTACHMENT, Page.AVATAR)
private val UNAUTH_SUBPAGES = setOf(Page.SIGNUP, Page.RESET)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val model: MainViewModel = viewModel()
            val isCameraCapture = model.page in CAMERA_CAPTURE_PAGES ||
                (model.page == Page.ENROLLMENT && model.enrollmentStep == EnrollmentStep.CAPTURE)
            val isWelcomeFullBleed = model.sessionReady && !model.signedIn && model.page !in UNAUTH_SUBPAGES
            SkanidaTheme(
                themePreference = model.theme,
                forceDarkSystemBars = isCameraCapture || isWelcomeFullBleed,
            ) {
                if (!model.sessionReady) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(LocalSkanidaColors.current.background),
                    )
                } else {
                    SkanidaAppHost(
                        model = model,
                        isCameraCapture = isCameraCapture,
                        isWelcomeFullBleed = isWelcomeFullBleed,
                    )
                }
            }
        }
    }
}
