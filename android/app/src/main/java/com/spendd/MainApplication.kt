package com.spendd

import android.app.Application
import java.io.File
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.spendd.receipts.SpenddPackage
import androidx.work.WorkManager

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SpenddPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    removeOnDeviceModel()
    // The bank statement reminder was removed; stop the copy older builds scheduled.
    WorkManager.getInstance(this).cancelUniqueWork("statement-reminder")
  }

  /** Insights moved to the cloud; free the ~490 MB the old on-device model took, if it was downloaded. */
  private fun removeOnDeviceModel() {
    Thread {
      getExternalFilesDir(null)?.let { File(it, "models") }?.takeIf { it.exists() }?.deleteRecursively()
    }.start()
  }
}
