package local.taskcard.app;

import android.app.Activity;
import android.content.Context;
import android.content.res.Resources;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.card.MaterialCardView;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

public final class Ui {
    private Ui() {
    }

    public static int dp(Context c, float v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }

    public static void toast(Context c, String msg) {
        Toast.makeText(c, msg, Toast.LENGTH_SHORT).show();
    }

    public static int attr(Context c, int attr) {
        TypedValue tv = new TypedValue();
        Resources.Theme theme = c.getTheme();
        if (theme.resolveAttribute(attr, tv, true)) {
            if (tv.type >= TypedValue.TYPE_FIRST_COLOR_INT && tv.type <= TypedValue.TYPE_LAST_COLOR_INT) {
                return tv.data;
            }
        }
        return 0xFF17181A;
    }

    public static MaterialCardView card(Context c) {
        MaterialCardView card = new MaterialCardView(c);
        card.setRadius(0);
        card.setCardElevation(0);
        card.setStrokeWidth(dp(c, 1));
        card.setStrokeColor(attr(c, com.google.android.material.R.attr.colorOutlineVariant));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(c, 10);
        card.setLayoutParams(lp);
        return card;
    }

    public static LinearLayout column(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    public static LinearLayout row(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(android.view.Gravity.CENTER_VERTICAL);
        return l;
    }

    public static TextView text(Context c, String s, float sp, int color) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    public static TextView label(Context c, String s) {
        return text(c, s, 12, attr(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
    }

    public static EditText input(Context c, String hint, String value, int type) {
        EditText e = new EditText(c);
        e.setHint(hint);
        e.setText(value == null ? "" : value);
        e.setTextSize(15);
        e.setInputType(type);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(attr(c, com.google.android.material.R.attr.colorSurfaceVariant));
        bg.setCornerRadius(0);
        bg.setStroke(dp(c, 1), attr(c, com.google.android.material.R.attr.colorOutline));
        e.setBackground(bg);
        e.setPadding(dp(c, 12), dp(c, 10), dp(c, 12), dp(c, 10));
        return e;
    }

    public static void needPasscode(Activity act, Runnable retry) {
        EditText input = new EditText(act);
        input.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        input.setHint("4–12 位数字");
        new MaterialAlertDialogBuilder(act)
                .setTitle("需要口令")
                .setMessage("这台设备还没有写权限，输一次口令就能改数据。")
                .setView(input)
                .setPositiveButton("保存口令", (d, w) -> {
                    String code = input.getText().toString().trim();
                    if (code.isEmpty()) return;
                    Api.setToken(act, code);
                    if (retry != null) retry.run();
                })
                .setNegativeButton("取消", null)
                .show();
    }
}
