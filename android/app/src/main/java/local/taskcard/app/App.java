package local.taskcard.app;

import android.app.Application;

import androidx.appcompat.app.AppCompatDelegate;

/**
 * 在任何 Activity 启动窗口创建之前，就把用户保存的外观应用上。
 * 否则：用户选了深色、系统是浅色时，冷启动/重建的第一帧会是白色启动图，看起来就是「闪一下白」。
 */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        int saved = Api.prefs(this).getInt("theme", 0);
        AppCompatDelegate.setDefaultNightMode(
                saved == 1 ? AppCompatDelegate.MODE_NIGHT_NO
                        : saved == 2 ? AppCompatDelegate.MODE_NIGHT_YES
                        : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
    }
}
