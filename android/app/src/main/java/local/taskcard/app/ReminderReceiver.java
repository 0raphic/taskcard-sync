package local.taskcard.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

/** 到点提醒的广播接收器：发一条本地通知。 */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String kind = intent.getStringExtra("kind");
        android.util.Log.i("ReminderReceiver", "got " + kind + " title=" + intent.getStringExtra("title"));
        Reminders.ensureChannel(context);
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if ("digest".equals(kind)) {
            Notification n = new Notification.Builder(context, Reminders.CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle("今天的卡")
                    .setContentText("看看看板上今天到期的任务，别让纸卡过期。")
                    .setAutoCancel(true)
                    .setContentIntent(PendingIntent.getActivity(context, 1,
                            new Intent(context, MainActivity.class),
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                    .build();
            nm.notify(Reminders.DIGEST_REQUEST, n);
            return;
        }

        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        if (title == null) title = "任务";
        PendingIntent open = PendingIntent.getActivity(context, 2,
                new Intent(context, DetailActivity.class).putExtra("id", id),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(context, Reminders.CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText("到点了，做完就勾掉它。")
                .setAutoCancel(true)
                .setContentIntent(open)
                .build();
        nm.notify(id == null ? 42 : id.hashCode(), n);
    }
}
