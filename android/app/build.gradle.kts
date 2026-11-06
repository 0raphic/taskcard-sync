plugins {
    id("com.android.application")
}

android {
    namespace = "local.taskcard.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "local.taskcard.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ""
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
