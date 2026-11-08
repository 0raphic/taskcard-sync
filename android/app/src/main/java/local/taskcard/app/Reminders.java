package local.taskcard.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * 本地提醒：到点提醒单张卡 + 每天 09:00 的到期摘要。
 * 用 AlarmManager 的 setAndAllowWhileIdle，不要求精确闹钟权限；重启后由 BootReceiver 重新排。
 */
public final class Reminders {
    public static final String CHANNEL = "taskcard-reminders";
    public static final int DIGEST_REQUEST = 910241;

    private Reminders() {
    }

    public static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "任务到期提醒", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("纸卡到点、每天到期摘要");
        nm.createNotificationChannel(ch);
    }

    /** 拉一次任务，把未来的 remind_at 排成闹钟；再排每天的摘要。 */
    public static void scheduleAll(Context c) {
        final Context app = c.getApplicationContext();
        ensureChannel(app);
        Api.get(app, "/api/collections/tasks/records?perPage=200&sort=remind_at&filter="
                + enc("status!='done' && remind_at!=''"), new Api.Cb() {
            @Override
            public void ok(String body) {
                try {
                    JSONArray items = new JSONObject(body).optJSONArray("items");
                    if (items == null) items = new JSONArray();
                    cancelTaskAlarms(app);
                    long now = System.currentTimeMillis();
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject o = items.optJSONObject(i);
                        if (o == null) continue;
                        String at = o.optString("remind_at", "");
                        long when = parseAt(at);
                        if (when <= now + 5000) continue;
                        schedule(app, o.optString("id"), o.optString("title", "任务"), when);
                    }
                } catch (Exception ignored) {
                }
                scheduleDigest(app);
            }

            @Override
            public void fail(Exception e) {
                scheduleDigest(app);
            }
        });
    }

    public static void schedule(Context c, String id, String title, long when) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int req = requestCode(id);
        Intent i = new Intent(c, ReminderReceiver.class)
                .putExtra("kind", "task")
                .putExtra("id", id)
                .putExtra("title", title);
        PendingIntent pi = PendingIntent.getBroadcast(c, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        }
        rememberId(c, id);
    }

    public static void cancelTaskAlarms(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences sp = c.getSharedPreferences("taskcard-reminders", Context.MODE_PRIVATE);
        String all = sp.getString("ids", "");
        if (am != null) {
            for (String id : all.split(",")) {
                if (id.isEmpty()) continue;
                Intent i = new Intent(c, ReminderReceiver.class).putExtra("kind", "task").putExtra("id", id);
                PendingIntent pi = PendingIntent.getBroadcast(c, requestCode(id), i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.cancel(pi);
            }
        }
        sp.edit().putString("ids", "").apply();
    }

    private static void rememberId(Context c, String id) {
        SharedPreferences sp = c.getSharedPreferences("taskcard-reminders", Context.MODE_PRIVATE);
        String all = sp.getString("ids", "");
        if (all.contains(id)) return;
        sp.edit().putString("ids", all.isEmpty() ? id : all + "," + id).apply();
    }

    /** 每天 09:00 的摘要；首次排到下一个 9 点，之后每天重复。 */
    public static void scheduleDigest(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 9);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_MONTH, 1);
        Intent i = new Intent(c, ReminderReceiver.class).putExtra("kind", "digest");
        PendingIntent pi = PendingIntent.getBroadcast(c, DIGEST_REQUEST, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(),
                AlarmManager.INTERVAL_DAY, pi);
    }

    public static long parseAt(String at) {
        if (at == null) return 0;
        String s = at.trim().replace('T', ' ');
        try {
            SimpleDateFormat f;
            if (s.matches("^\\d{4}-\\d{1,2}-\\d{1,2}.*")) {
                f = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.CHINA);
            } else {
                f = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.CHINA);
                s = Calendar.getInstance().get(Calendar.YEAR) + "-" + s;
            }
            if (s.length() == 16) {
                Date d = f.parse(s);
                if (d != null) return d.getTime();
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    private static int requestCode(String id) {
        return Math.abs((id == null ? "" : id).hashCode()) % 900000 + 1000;
    }

    private static String enc(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
