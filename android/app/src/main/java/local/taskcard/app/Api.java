package local.taskcard.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** 极简 PocketBase 客户端：REST + 写操作口令头。 */
public final class Api {
    public static final String DEFAULT_BASE = "http://192.168.0.108:8088";

    public interface Cb {
        void ok(String body);

        void fail(Exception e);
    }

    public static class NeedPasscode extends IOException {
    }

    private Api() {
    }

    public static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences("taskcard", Context.MODE_PRIVATE);
    }

    public static String base(Context c) {
        String b = prefs(c).getString("base", DEFAULT_BASE);
        if (b == null || b.isEmpty()) b = DEFAULT_BASE;
        while (b.endsWith("/")) b = b.substring(0, b.length() - 1);
        return b;
    }

    public static void setBase(Context c, String base) {
        prefs(c).edit().putString("base", base.trim()).apply();
    }

    public static String token(Context c) {
        return prefs(c).getString("token", "");
    }

    public static void setToken(Context c, String t) {
        prefs(c).edit().putString("token", t).apply();
    }

    public static void get(Context c, String path, Cb cb) {
        call(c, "GET", path, null, cb);
    }

    public static void patch(Context c, String path, JSONObject body, Cb cb) {
        call(c, "PATCH", path, body, cb);
    }

    public static void post(Context c, String path, JSONObject body, Cb cb) {
        call(c, "POST", path, body, cb);
    }

    public static void delete(Context c, String path, Cb cb) {
        call(c, "DELETE", path, null, cb);
    }

    public static void call(Context c, String method, String path, JSONObject body, Cb cb) {
        Context app = c.getApplicationContext();
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                String url = base(app) + path;
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(30000);
                if (!"GET".equals(method)) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json");
                }
                String t = token(app);
                if (t != null && !t.isEmpty()) conn.setRequestProperty("x-write-token", t);
                if (body != null) {
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }
                }
                int code = conn.getResponseCode();
                InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String resp = read(is);
                if (code >= 400) {
                    if (code == 401 && resp.contains("need_passcode")) throw new NeedPasscode();
                    throw new IOException("HTTP " + code + ": " + trim(resp));
                }
                new Handler(Looper.getMainLooper()).post(() -> cb.ok(resp));
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() -> cb.fail(e));
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private static String read(InputStream is) throws IOException {
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private static String trim(String s) {
        if (s == null) return "";
        return s.length() > 180 ? s.substring(0, 180) + "…" : s;
    }
}
