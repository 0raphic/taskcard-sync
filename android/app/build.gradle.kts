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
        versionCode = 6
        versionName = "2.2.0"
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
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
