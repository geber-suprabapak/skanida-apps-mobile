package id.skanida.nativeapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import id.skanida.nativeapp.R
import id.skanida.nativeapp.domain.workflow.AbsenceStatusIcon
import id.skanida.nativeapp.domain.workflow.AbsenceStatusTone
import id.skanida.nativeapp.domain.workflow.PrecheckState
import id.skanida.nativeapp.domain.workflow.resolveAbsenceStatusMeta
import id.skanida.nativeapp.ui.components.PrimaryBiometricButton
import id.skanida.nativeapp.ui.components.SecondaryActionButton
import id.skanida.nativeapp.ui.components.SkanidaCard
import id.skanida.nativeapp.ui.theme.LocalSkanidaColors
import id.skanida.nativeapp.ui.theme.ManropeFontFamily

@Composable
fun AttendancePrecheckDialog(state: PrecheckState, busy: Boolean, onRetry: () -> Unit, onDismiss: () -> Unit,) {
    val tokens = LocalSkanidaColors.current
    val blockedState = state as? PrecheckState.Blocked
    val failedState = state as? PrecheckState.Failed
    val meta = resolveAbsenceStatusMeta(
        isLoading = false,
        errorMessage = failedState?.message,
        precheck = blockedState?.precheck,
    )

    val statusColor = when (meta.tone) {
        AbsenceStatusTone.SUCCESS -> tokens.success
        AbsenceStatusTone.WARNING -> tokens.warning
        AbsenceStatusTone.ERROR -> tokens.error
        AbsenceStatusTone.LOADING, AbsenceStatusTone.INFO -> tokens.info
    }

    Dialog(onDismissRequest = onDismiss) {
        SkanidaCard(
            cornerRadius = 28.dp,
            padding = PaddingValues(24.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(statusColor.container),
                    contentAlignment = Alignment.Center,
                ) {
                    when (meta.icon) {
                        AbsenceStatusIcon.LOADER -> CircularProgressIndicator(
                            modifier = Modifier.size(34.dp),
                            color = tokens.biometricBlue,
                        )
                        AbsenceStatusIcon.CHECK_CIRCLE -> Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = statusColor.content,
                            modifier = Modifier.size(38.dp),
                        )
                        AbsenceStatusIcon.CLOCK -> Icon(
                            painter = painterResource(R.drawable.ic_clock),
                            contentDescription = null,
                            tint = statusColor.content,
                            modifier = Modifier.size(38.dp),
                        )
                        AbsenceStatusIcon.MAP_PIN_OFF -> Icon(
                            painter = painterResource(R.drawable.ic_location_off),
                            contentDescription = null,
                            tint = statusColor.content,
                            modifier = Modifier.size(38.dp),
                        )
                        AbsenceStatusIcon.HELP_CIRCLE -> Icon(
                            painter = painterResource(
                                if (blockedState != null) R.drawable.ic_cancel else R.drawable.ic_help,
                            ),
                            contentDescription = null,
                            tint = statusColor.content,
                            modifier = Modifier.size(38.dp),
                        )
                    }
                }

                Text(
                    text = meta.message,
                    fontFamily = ManropeFontFamily,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                    color = tokens.foreground,
                )

                val locationName = blockedState?.precheck?.locationName
                if (!locationName.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = tokens.mutedForeground,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            text = locationName,
                            fontFamily = ManropeFontFamily,
                            fontSize = 13.sp,
                            color = tokens.mutedForeground,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                Spacer(Modifier.height(2.dp))

                PrimaryBiometricButton(
                    text = "Periksa Ulang",
                    onClick = onRetry,
                    enabled = !busy,
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                )

                SecondaryActionButton(
                    text = "Tutup",
                    onClick = onDismiss,
                    enabled = !busy,
                )
            }
        }
    }
}
