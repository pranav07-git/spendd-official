package com.spendd

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Spendd"

  /**
   * react-native-screens: screen fragments must not be restored by Android after process death,
   * so the saved instance state is dropped here.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    // Financial data must not show in the recent-apps thumbnail.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(false)
    }
  }

  // Before Android 13 there is no switch for the thumbnail; FLAG_SECURE while the app is in the
  // background blanks it on most devices (best effort) without blocking screenshots in use.
  override fun onPause() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
