pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    id("com.android.library") version "8.11.1" apply false
    // START: FlutterFire Configuration
    id("com.google.gms.google-services") version("4.4.4") apply false
    // END: FlutterFire Configuration
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}

include(":app")

val lifeTreeUnityLibrary = file("../../life-tree-unity/Builds/Android/unityLibrary")
if (lifeTreeUnityLibrary.isDirectory) {
    val lifeTreeUnityProperties = java.util.Properties().apply {
        file("../../life-tree-unity/Builds/Android/gradle.properties")
            .inputStream()
            .use(::load)
    }
    gradle.beforeProject {
        if (path == ":unityLibrary") {
            lifeTreeUnityProperties.forEach { key, value ->
                extensions.extraProperties.set(key.toString(), value)
            }
        }
    }
    include(":unityLibrary")
    project(":unityLibrary").projectDir = lifeTreeUnityLibrary
}
