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
        versionCode = 2
        versionName = "1.1.0"
    }

    signingConfigs {
        create("release") {
            storeFile = file("../taskcard-release.jks")
            storePassword = "taskcard123"
            keyAlias = "taskcard"
            keyPassword = "taskcard123"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ""
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
