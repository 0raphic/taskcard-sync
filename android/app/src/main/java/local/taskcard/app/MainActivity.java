package local.taskcard.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.floatingactionbutton.FloatingActionButton;

public class MainActivity extends AppCompatActivity {

    private BoardFragment board;
    private CaptureFragment capture;
    private SettingsFragment settings;
    private Fragment current;
    private FloatingActionButton fab;
    private BottomNavigationView nav;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        FrameLayout container = new FrameLayout(this);
        container.setId(ViewGroup.generateViewId());
        root.addView(container, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        fab = new FloatingActionButton(this);
        fab.setContentDescription("新建卡片");
        fab.setImageResource(android.R.drawable.ic_input_add);
        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        flp.gravity = Gravity.BOTTOM | Gravity.END;
        flp.setMargins(0, 0, Ui.dp(this, 18), Ui.dp(this, 18));
        container.addView(fab, flp);
        fab.setOnClickListener(v -> board.quickAdd());

        nav = new BottomNavigationView(this);
        nav.inflateMenu(R.menu.bottom_nav);
        nav.setItemActiveIndicatorEnabled(false);
        android.content.res.ColorStateList navColors = new android.content.res.ColorStateList(
                new int[][]{{android.R.attr.state_checked}, {}},
                new int[]{Ui.attr(this, com.google.android.material.R.attr.colorOnSurface), Ui.attr(this, com.google.android.material.R.attr.colorOnSurfaceVariant)});
        nav.setItemIconTintList(navColors);
        nav.setItemTextColor(navColors);
        root.addView(nav, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        if (Api.prefs(this).getString("base", "").isEmpty()) {
            LinearLayout box = Ui.column(this);
            int pad = Ui.dp(this, 20);
            box.setPadding(pad, pad / 2, pad, 0);
            box.addView(Ui.label(this, "手机和电脑连同一个 Wi-Fi。地址在电脑窗口「手机打开」后面。"));
            android.widget.EditText input = Ui.input(this, "http://192.168.0.108:8088",
                    Api.base(this), android.text.InputType.TYPE_CLASS_TEXT
                            | android.text.InputType.TYPE_TEXT_VARIATION_URI);
            box.addView(input, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            new com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                    .setTitle("先连上电脑")
                    .setView(box)
                    .setPositiveButton("开始用", (d, w) -> {
                        String u = input.getText().toString().trim();
                        if (u.isEmpty()) u = Api.base(this);
                        if (!u.startsWith("http")) u = "http://" + u;
                        Api.setBase(this, u);
                        board.load();
                    })
                    .setCancelable(false)
                    .show();
        }

        Reminders.scheduleAll(this);
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 7);
        }

        board = new BoardFragment();
        capture = new CaptureFragment();
        settings = new SettingsFragment();
        getSupportFragmentManager().beginTransaction()
                .add(container.getId(), settings, "settings").hide(settings)
                .add(container.getId(), capture, "capture").hide(capture)
                .add(container.getId(), board, "board")
                .commit();
        current = board;

        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_board) show(board);
            else if (id == R.id.nav_capture) show(capture);
            else show(settings);
            return true;
        });
    }

    private void show(Fragment f) {
        if (f == current) {
            if (f == board) board.load();
            return;
        }
        getSupportFragmentManager().beginTransaction().hide(current).show(f).commit();
        current = f;
        fab.setVisibility(f == board ? FloatingActionButton.VISIBLE : FloatingActionButton.GONE);
        if (f == board) board.load();
    }

    @Override
    public void onBackPressed() {
        if (current != board) {
            nav.setSelectedItemId(R.id.nav_board);
            show(board);
            return;
        }
        super.onBackPressed();
    }
}
