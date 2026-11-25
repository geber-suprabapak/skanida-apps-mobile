package id.skanida.nativeapp.domain.workflow

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
val ID_LOCALE: Locale = Locale.forLanguageTag("id-ID")

private val DATE_ONLY_REGEX = Regex("""^\d{4}-\d{2}-\d{2}$""")
private val SPACE_SEPARATOR_REGEX = Regex("""^(\d{4}-\d{2}-\d{2})\s+(.+)$""")
private val TWO_DIGIT_OFFSET_REGEX = Regex("""([+-]\d{2})$""")
private val FOUR_DIGIT_OFFSET_REGEX = Regex("""([+-]\d{2})(\d{2})$""")

private val SHORT_DATE_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy", ID_LOCALE)
private val SHORT_DATETIME_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", ID_LOCALE)
private val FULL_DATE_FORMATTER = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", ID_LOCALE)
private val HEADER_DATE_FORMATTER = DateTimeFormatter.ofPattern("EEEE, d MMMM", ID_LOCALE)
private val MONTH_YEAR_FORMATTER = DateTimeFormatter.ofPattern("MMMM yyyy", ID_LOCALE)
private val TIME_HM_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", ID_LOCALE)
private val TIME_HMS_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss", ID_LOCALE)

fun parseTimestampToInstant(raw: String?): Instant? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    val withT = SPACE_SEPARATOR_REGEX.replace(trimmed) { match ->
        "${match.groupValues[1]}T${match.groupValues[2]}"
    }
    val withNormalizedOffset = when {
        TWO_DIGIT_OFFSET_REGEX.containsMatchIn(withT) ->
            TWO_DIGIT_OFFSET_REGEX.replace(withT) { "${it.groupValues[1]}:00" }
        FOUR_DIGIT_OFFSET_REGEX.containsMatchIn(withT) ->
            FOUR_DIGIT_OFFSET_REGEX.replace(withT) { "${it.groupValues[1]}:${it.groupValues[2]}" }
        else -> withT
    }
    return runCatching { Instant.parse(withNormalizedOffset) }.getOrElse {
        runCatching { OffsetDateTime.parse(withNormalizedOffset).toInstant() }.getOrNull()
    }
}

fun formatTimeWib(raw: String?, fallback: String = "—"): String {
    val instant = parseTimestampToInstant(raw) ?: return raw?.takeIf { it.isNotBlank() } ?: fallback
    return instant.atZone(WIB).format(TIME_HM_FORMATTER)
}

fun formatDateTimeWib(raw: String?, fallback: String = "—"): String {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return fallback
    val instant = parseTimestampToInstant(trimmed) ?: return formatAttendanceDateLabel(trimmed)
    return instant.atZone(WIB).format(SHORT_DATETIME_FORMATTER)
}

fun formatAttendanceDateLabel(raw: String?): String {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return ""
    if (DATE_ONLY_REGEX.matches(trimmed)) {
        val localDate = runCatching { LocalDate.parse(trimmed) }.getOrNull() ?: return trimmed
        return localDate.format(SHORT_DATE_FORMATTER)
    }
    val instant = parseTimestampToInstant(trimmed) ?: return trimmed
    return instant.atZone(WIB).toLocalDate().format(SHORT_DATE_FORMATTER)
}

fun formatDateKeyWib(raw: String?): String {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return ""
    if (DATE_ONLY_REGEX.matches(trimmed)) return trimmed
    val instant = parseTimestampToInstant(trimmed)
    if (instant != null) return instant.atZone(WIB).toLocalDate().toString()
    return trimmed.substringBefore('T').substringBefore(' ')
}

fun formatFullDateWib(date: LocalDate): String = date.format(FULL_DATE_FORMATTER)

fun formatFullDateWib(instant: Instant): String = instant.atZone(WIB).format(FULL_DATE_FORMATTER)

fun formatClockWib(instant: Instant): String = instant.atZone(WIB).format(TIME_HMS_FORMATTER)

fun formatHeaderDateWib(date: LocalDate): String = date.format(HEADER_DATE_FORMATTER)

fun formatMonthYear(yearMonth: java.time.YearMonth): String = yearMonth.format(MONTH_YEAR_FORMATTER)

fun wibGreeting(instant: Instant): String {
    val hour = instant.atZone(WIB).hour
    return when {
        hour in 3..10 -> "Selamat Pagi"
        hour in 11..14 -> "Selamat Siang"
        hour in 15..17 -> "Selamat Sore"
        else -> "Selamat Malam"
    }
}

fun parseScheduleLocalTime(raw: String?): LocalTime? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    val instant = parseTimestampToInstant(trimmed)
    if (instant != null) return instant.atZone(WIB).toLocalTime()
    return runCatching { LocalTime.parse(trimmed) }.getOrNull()
}
