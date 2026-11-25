import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Public client configuration only; identity secrets never belong in an APK.
val expoEnv = Properties().apply {
    rootProject.file(".env").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun clientSetting(key: String, fallback: String) = providers.gradleProperty(key)
    .orElse(providers.environmentVariable(key)).getOrElse(expoEnv.getProperty(key, fallback))
fun stagingSetting(key: String, fallback: String) = providers.gradleProperty(key)
    .orElse(providers.environmentVariable(key)).getOrElse(fallback)
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val customAppIdSuffix = providers.gradleProperty("appIdSuffix").orNull?.takeIf { it.isNotBlank() }
val releaseSigning = Properties().apply {
    rootProject.file("signing.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
val firebaseFile = listOf(rootProject.file("app/google-services.json"), rootProject.file("certs/google-services.json")).firstOrNull {
    it.exists()
}
val firebase = firebaseFile?.let { JsonSlurper().parse(it) as Map<*, *> }
val firebaseProject = firebase?.get("project_info") as? Map<*, *>
val firebaseClient = (firebase?.get("client") as? List<*>)?.filterIsInstance<Map<*, *>>()?.firstOrNull {
    val info = it["client_info"] as? Map<*, *>
    (info?.get("android_client_info") as? Map<*, *>)?.get("package_name") == "com.hfzrk.skanidaappsmobile"
}

android {
    namespace = "id.skanida.nativeapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.hfzrk.skanidaappsmobile"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.gradleProperty("NATIVE_VERSION_CODE").getOrElse("20000").toInt()
        versionName = "2.0.0-astrayao"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["appAuthRedirectScheme"] = "skanida"
        manifestPlaceholders["appLabel"] = "Skanida Apps"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        buildConfigField("boolean", "ALLOW_INSECURE_HTTP", "false")
        buildConfigField("String", "ASTRA_URL", quoted(clientSetting("EXPO_PUBLIC_BFF_API_URL", "https://astrayao.lunaradev.my.id")))
        buildConfigField("String", "LOGTO_URL", quoted(clientSetting("EXPO_PUBLIC_LOGTO_ENDPOINT", "https://auth.lunaradev.my.id")))
        buildConfigField("String", "LOGTO_CLIENT_ID", quoted(clientSetting("EXPO_PUBLIC_LOGTO_APP_ID", "skanida-mobile")))
        buildConfigField(
            "String",
            "LOGTO_RESOURCE",
            quoted(clientSetting("EXPO_PUBLIC_LOGTO_RESOURCE", "https://astrayao.lunaradev.my.id")),
        )
        buildConfigField("String", "LOGTO_REDIRECT", quoted(clientSetting("EXPO_PUBLIC_LOGTO_REDIRECT_URI", "skanida://auth/callback")))
        buildConfigField("String", "EXPO_PROJECT_ID", quoted("a423f8e9-23fd-472b-b405-f5ef8f726bf9"))
        buildConfigField(
            "String",
            "FIREBASE_APP_ID",
            quoted((firebaseClient?.get("client_info") as? Map<*, *>)?.get("mobilesdk_app_id")?.toString().orEmpty()),
        )
        buildConfigField(
            "String",
            "FIREBASE_API_KEY",
            quoted(((firebaseClient?.get("api_key") as? List<*>)?.firstOrNull() as? Map<*, *>)?.get("current_key")?.toString().orEmpty()),
        )
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(firebaseProject?.get("project_id")?.toString().orEmpty()))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(firebaseProject?.get("project_number")?.toString().orEmpty()))
    }
    signingConfigs {
        if (releaseSigning.isNotEmpty()) {
            create("production") {
                storeFile = rootProject.file(releaseSigning.getProperty("storeFile"))
                storePassword = releaseSigning.getProperty("storePassword")
                keyAlias = releaseSigning.getProperty("keyAlias")
                keyPassword = releaseSigning.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        debug {
            if (customAppIdSuffix != null) applicationIdSuffix = customAppIdSuffix
            versionNameSuffix = "-debug"
            manifestPlaceholders["appLabel"] = "Skanida Apps (Debug)"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("boolean", "ALLOW_INSECURE_HTTP", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            // Ship universal ARM (64-bit + 32-bit); keep debug unfiltered for x86_64 emulators.
            ndk {
                abiFilters += listOf("arm64-v8a", "armeabi-v7a")
            }
            if (customAppIdSuffix != null) applicationIdSuffix = customAppIdSuffix
            manifestPlaceholders["appLabel"] = "Skanida Apps"
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            buildConfigField("boolean", "ALLOW_INSECURE_HTTP", "false")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseSigning.isNotEmpty()) signingConfig = signingConfigs.getByName("production")
        }
        create("staging") {
            initWith(getByName("release"))
            if (customAppIdSuffix != null) applicationIdSuffix = customAppIdSuffix
            versionNameSuffix = "-staging"
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release", "debug")
            manifestPlaceholders["appLabel"] = "Skanida Apps (Staging)"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("boolean", "ALLOW_INSECURE_HTTP", "true")
            buildConfigField(
                "String",
                "ASTRA_URL",
                quoted(stagingSetting("EXPO_PUBLIC_BFF_API_URL", "http://api.192.168.21.122.nip.io:8080")),
            )
            buildConfigField(
                "String",
                "LOGTO_URL",
                quoted(stagingSetting("EXPO_PUBLIC_LOGTO_ENDPOINT", "http://auth.192.168.21.122.nip.io:8080")),
            )
            buildConfigField("String", "LOGTO_CLIENT_ID", quoted(stagingSetting("EXPO_PUBLIC_LOGTO_APP_ID", "ktok16dl83bmwh85jgc97")))
            buildConfigField(
                "String",
                "LOGTO_RESOURCE",
                quoted(stagingSetting("EXPO_PUBLIC_LOGTO_RESOURCE", "https://api.skanida-staging.test")),
            )
            buildConfigField(
                "String",
                "LOGTO_REDIRECT",
                quoted(stagingSetting("EXPO_PUBLIC_LOGTO_REDIRECT_URI", "skanida://auth/callback")),
            )
        }
    }
    androidResources {
        // Keep only Indonesian and English string resources to trim APK size and resource table RAM.
        localeFilters += listOf("id", "en")
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
    packaging {
        resources.excludes += setOf(
            "META-INF/AL2.0",
            "META-INF/LGPL2.1",
            "META-INF/androidx/**",
            "META-INF/*.version",
            "META-INF/com/android/build/gradle/app-metadata.properties",
            "META-INF/version-control-info.textproto",
            "DebugProbesKt.bin",
            "kotlin/*.kotlin_builtins",
            "kotlin/**/*.kotlin_builtins",
            "kotlin-tooling-metadata.json",
            "**/*.proto",
            "firebase-*.properties",
            "play-services-*.properties",
            // Astra uses Bearer tokens (CookieJar.NO_COOKIES); public suffix table is unused.
            "okhttp3/internal/publicsuffix/*",
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

composeCompiler {
    if (providers.gradleProperty("enableComposeCompilerReports").orNull == "true") {
        val reportsDir = layout.buildDirectory.dir("compose_compiler")
        reportsDestination.set(reportsDir)
        metricsDestination.set(reportsDir)
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.00"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.2")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.profileinstaller:profileinstaller:1.4.0")
    implementation("androidx.exifinterface:exifinterface:1.4.1")
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    implementation("net.openid:appauth:0.11.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("com.google.firebase:firebase-messaging:24.1.2")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
