package local.taskcard.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 开机后重排提醒（AlarmManager 的闹钟关机就没了）。 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Reminders.scheduleAll(context.getApplicationContext());
        }
    }
}
