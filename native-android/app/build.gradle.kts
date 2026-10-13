import java.util.Properties
import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Public client configuration only; identity secrets never belong in an APK.
val expoEnv = Properties().apply {
    rootProject.file("../.env").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun clientSetting(key: String, fallback: String) = providers.gradleProperty(key)
    .orElse(providers.environmentVariable(key)).getOrElse(expoEnv.getProperty(key, fallback))
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
val releaseSigning = Properties().apply {
    rootProject.file("signing.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
val firebaseFile = listOf(rootProject.file("app/google-services.json"), rootProject.file("../certs/google-services.json")).firstOrNull { it.exists() }
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
        versionCode = providers.gradleProperty("NATIVE_VERSION_CODE").getOrElse("13001").toInt()
        versionName = "1.3.0-native.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["appAuthRedirectScheme"] = "skanida"
        buildConfigField("String", "ASTRA_URL", quoted(clientSetting("EXPO_PUBLIC_BFF_API_URL", "https://astrayao.lunaradev.my.id")))
        buildConfigField("String", "LOGTO_URL", quoted(clientSetting("EXPO_PUBLIC_LOGTO_ENDPOINT", "https://auth.lunaradev.my.id")))
        buildConfigField("String", "LOGTO_CLIENT_ID", quoted(clientSetting("EXPO_PUBLIC_LOGTO_APP_ID", "skanida-mobile")))
        buildConfigField("String", "LOGTO_RESOURCE", quoted(clientSetting("EXPO_PUBLIC_LOGTO_RESOURCE", "https://astrayao.lunaradev.my.id")))
        buildConfigField("String", "LOGTO_REDIRECT", quoted(clientSetting("EXPO_PUBLIC_LOGTO_REDIRECT_URI", "skanida://auth/callback")))
        buildConfigField("String", "EXPO_PROJECT_ID", quoted("a423f8e9-23fd-472b-b405-f5ef8f726bf9"))
        buildConfigField("String", "FIREBASE_APP_ID", quoted((firebaseClient?.get("client_info") as? Map<*, *>)?.get("mobilesdk_app_id")?.toString().orEmpty()))
        buildConfigField("String", "FIREBASE_API_KEY", quoted(((firebaseClient?.get("api_key") as? List<*>)?.firstOrNull() as? Map<*, *>)?.get("current_key")?.toString().orEmpty()))
        buildConfigField("String", "FIREBASE_PROJECT_ID", quoted(firebaseProject?.get("project_id")?.toString().orEmpty()))
        buildConfigField("String", "FIREBASE_SENDER_ID", quoted(firebaseProject?.get("project_number")?.toString().orEmpty()))
    }
    signingConfigs {
        if (releaseSigning.isNotEmpty()) create("production") {
            storeFile = rootProject.file(releaseSigning.getProperty("storeFile"))
            storePassword = releaseSigning.getProperty("storePassword")
            keyAlias = releaseSigning.getProperty("keyAlias")
            keyPassword = releaseSigning.getProperty("keyPassword")
        }
    }
    buildTypes {
        debug {
            applicationIdSuffix = ".native"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseSigning.isNotEmpty()) signingConfig = signingConfigs.getByName("production")
        }
        create("experiment") {
            initWith(getByName("release"))
            applicationIdSuffix = ".native"
            versionNameSuffix = "-experiment"
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += "release"
        }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    packaging { resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1") }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

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
