package local.taskcard.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 任务卡片 · 手机端外壳。
 * 里面就是同一个网页（局域网地址），所以手机和电脑看到的是同一份数据。
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 2001;
    private static final String DEFAULT_BASE = "http://192.168.0.108:8088";

    private WebView web;
    private SharedPreferences prefs;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("taskcard", MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#232522"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#232522"));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        root.addView(makeMenuButton(), menuButtonLayout());

        setContentView(root);

        // Android 15（targetSdk 35）强制 edge-to-edge：自己把状态栏/导航栏的高度让出来
        final boolean full = Build.VERSION.SDK_INT >= 35;
        if (full) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(0, bars.top, 0, bars.bottom);
                return insets;
            });
        }
        setupWebView();

        String base = prefs.getString("base", "");
        if (base.isEmpty()) {
            web.loadData(placeholder(), "text/html", "utf-8");
            askServer(true);
        } else {
            load(base);
            Toast.makeText(this, "右下角 ⋯ 可以换地址、刷新", Toast.LENGTH_SHORT).show();
        }
    }

    private String placeholder() {
        return "<html><body style='background:#232522;color:#8a8a86;font-family:sans-serif;"
                + "padding:24px;line-height:1.7'>第一次打开：先填电脑上的服务器地址。</body></html>";
    }

    private TextView makeMenuButton() {
        TextView b = new TextView(this);
        b.setText("⋯");
        b.setTextColor(Color.parseColor("#fbfaf6"));
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        b.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#59FFFFFF"));
        b.setBackground(bg);
        b.setAlpha(0.55f);
        b.setOnClickListener(v -> showMenu());
        return b;
    }

    private FrameLayout.LayoutParams menuButtonLayout() {
        int size = Math.round(44 * getResources().getDisplayMetrics().density);
        int margin = Math.round(12 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(size, size);
        lp.gravity = Gravity.BOTTOM | Gravity.END;
        lp.setMargins(0, 0, margin, margin + Math.round(24 * getResources().getDisplayMetrics().density));
        return lp;
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showUnreachable();
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                    startActivityForResult(
                            Intent.createChooser(intent, "选一张任务卡照片"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });
    }

    private void load(String base) {
        String url = base.endsWith("/") ? base : base + "/";
        web.loadUrl(url);
    }

    private void showMenu() {
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
                .setItems(new String[]{"刷新", "服务器地址", "用浏览器打开"}, (d, which) -> {
                    if (which == 0) {
                        load(currentBase());
                    } else if (which == 1) {
                        askServer(false);
                    } else {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(currentBase())));
                        } catch (Exception ignored) {
                        }
                    }
                })
                .show();
    }

    private void showUnreachable() {
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
                .setTitle("打不开")
                .setMessage("手机和电脑要连同一个 Wi-Fi。\n\n电脑上那个窗口不能关（它就是服务器），\n地址以窗口里打印的「手机打开」为准。")
                .setPositiveButton("重试", (d, w) -> load(currentBase()))
                .setNeutralButton("改地址", (d, w) -> askServer(false))
                .setNegativeButton("先算了", null)
                .show();
    }

    private String currentBase() {
        return prefs.getString("base", DEFAULT_BASE);
    }

    private void askServer(boolean first) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(currentBase());
        input.setSelectAllOnFocus(true);
        input.setTextColor(Color.parseColor("#17181A"));

        new AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
                .setTitle(first ? "第一步：连上电脑" : "服务器地址")
                .setMessage("填电脑窗口里「手机打开」后面的地址，例如 http://192.168.0.108:8088")
                .setView(input)
                .setPositiveButton("打开", (d, w) -> {
                    String u = input.getText().toString().trim();
                    if (u.isEmpty()) {
                        return;
                    }
                    if (!u.startsWith("http://") && !u.startsWith("https://")) {
                        u = "http://" + u;
                    }
                    prefs.edit().putString("base", u).apply();
                    load(u);
                })
                .setNegativeButton("取消", null)
                .setCancelable(!first)
                .create();
        final AlertDialog shown = new AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
                .setTitle(first ? "第一步：连上电脑" : "服务器地址")
                .setMessage("填电脑窗口里「手机打开」后面的地址，例如 http://192.168.0.108:8088")
                .setView(input)
                .setPositiveButton("打开", (d, w) -> {
                    String u = input.getText().toString().trim();
                    if (u.isEmpty()) {
                        return;
                    }
                    if (!u.startsWith("http://") && !u.startsWith("https://")) {
                        u = "http://" + u;
                    }
                    prefs.edit().putString("base", u).apply();
                    load(u);
                })
                .setNegativeButton("取消", null)
                .setCancelable(!first)
                .create();
        shown.setOnShowListener(x -> {
            shown.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.parseColor("#D6362B"));
            shown.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(Color.parseColor("#5A5A5A"));
        });
        shown.show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
