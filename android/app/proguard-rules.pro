# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Used only when R8 is turned on (-Pspendd.enableR8=true).

# React Native / TurboModules: classes and members are looked up by name from C++ and JS.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.yoga.** { *; }
-keep class com.spendd.specs.** { *; }
-keep class com.spendd.** extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class com.spendd.** implements com.facebook.react.ReactPackage { *; }

# llama.rn: JNI calls into these classes by name.
-keep class com.rnllama.** { *; }

# WorkManager creates workers by class name.
-keep class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# ML Kit text recognition (bundled model).
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_text_common.** { *; }
-dontwarn com.google.mlkit.**

# Other autolinked native libraries.
-keep class com.oblador.keychain.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }
