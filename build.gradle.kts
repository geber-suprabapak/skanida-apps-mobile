plugins {
    id("com.android.application") version "8.12.0" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0" apply false
    id("com.diffplug.spotless") version "7.0.2"
    id("io.gitlab.arturbosch.detekt") version "1.23.8"
}

spotless {
    kotlin {
        target("app/src/**/*.kt")
        ktlint("1.5.0").setEditorConfigPath("$rootDir/.editorconfig")
    }
    kotlinGradle {
        target("*.gradle.kts", "app/*.gradle.kts")
        ktlint("1.5.0").setEditorConfigPath("$rootDir/.editorconfig")
    }
}

detekt {
    buildUponDefaultConfig = true
    allRules = false
    config.setFrom(files("$rootDir/config/detekt/detekt.yml"))
    source.setFrom(files("app/src/main/java", "app/src/test/java"))
}
