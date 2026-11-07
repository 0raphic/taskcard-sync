package local.taskcard.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

public class SettingsFragment extends Fragment {

    private EditText base;
    private TextView status;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        android.content.Context c = requireContext();
        ScrollView scroll = new ScrollView(c);
        LinearLayout root = Ui.column(c);
        int pad = Ui.dp(c, 20);
        root.setPadding(pad, pad, pad, pad);
        scroll.addView(root);

        root.addView(Ui.text(c, "设置", 22,
                Ui.attr(c, com.google.android.material.R.attr.colorOnSurface)));
        TextView sub = Ui.label(c, "手机和电脑连同一个 Wi-Fi；地址填电脑那边「手机打开」的地址。");
        sub.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 18));
        root.addView(sub);

        root.addView(Ui.label(c, "服务器地址"));
        base = Ui.input(c, "http://192.168.0.108:8088", Api.base(c),
                android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(base);

        MaterialButton save = new MaterialButton(c);
        save.setText("保存");
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        slp.topMargin = Ui.dp(c, 14);
        root.addView(save, slp);
        save.setOnClickListener(v -> {
            Api.setBase(requireContext(), base.getText().toString().trim());
            Ui.toast(requireContext(), "保存了");
        });

        MaterialButton test = new MaterialButton(c, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        test.setText("测试连接");
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tlp.topMargin = Ui.dp(c, 10);
        root.addView(test, tlp);
        status = Ui.label(c, "");
        status.setPadding(0, Ui.dp(c, 8), 0, 0);
        root.addView(status);
        test.setOnClickListener(v -> {
            Api.setBase(requireContext(), base.getText().toString().trim());
            status.setText("连接中…");
            Api.get(requireContext(), "/ds-api/health", new Api.Cb() {
                @Override
                public void ok(String body) {
                    status.setText("连上了：" + body);
                }

                @Override
                public void fail(Exception e) {
                    status.setText("失败：" + e.getMessage());
                }
            });
        });

        root.addView(Ui.label(c, "外观"));
        RadioGroup theme = new RadioGroup(c);
        int mode = Api.prefs(c).getInt("theme", 0);
        String[] labels = {"随系统", "浅色", "深色"};
        for (int i = 0; i < 3; i++) {
            android.widget.RadioButton rb = new android.widget.RadioButton(c);
            rb.setId(1000 + i);
            rb.setText(labels[i]);
            rb.setChecked(mode == i);
            theme.addView(rb);
        }
        theme.setOnCheckedChangeListener((g, checkedId) -> {
            int idx = checkedId - 1000;
            Api.prefs(c).edit().putInt("theme", idx).apply();

            // 切完会 recreate；先把窗口和根视图刷成目标纸色，重建那一帧就不会闪白
            int bg = 0xFFFFFFFF;
            if (idx == 2) bg = 0xFF0E0E0D;
            else if (idx == 0) {
                boolean night = (getResources().getConfiguration().uiMode
                        & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                        == android.content.res.Configuration.UI_MODE_NIGHT_YES;
                bg = night ? 0xFF0E0E0D : 0xFFFFFFFF;
            }
            if (getActivity() != null) {
                getActivity().getWindow().setBackgroundDrawable(
                        new android.graphics.drawable.ColorDrawable(bg));
                getActivity().getWindow().getDecorView().setBackgroundColor(bg);
            }

            AppCompatDelegate.setDefaultNightMode(idx == 1 ? AppCompatDelegate.MODE_NIGHT_NO
                    : idx == 2 ? AppCompatDelegate.MODE_NIGHT_YES
                    : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
        });
        root.addView(theme);

        root.addView(Ui.label(c, "账号"));
        TextView acc = Ui.label(c, Api.token(c).isEmpty()
                ? "还没登录。"
                : "已登录（token 存在这台手机上）。纸卡扫码页不用登录，谁拿着卡都能改那张卡。");
        acc.setPadding(0, Ui.dp(c, 6), 0, 0);
        root.addView(acc);

        if (!Api.token(c).isEmpty()) {
            com.google.android.material.button.MaterialButton logout =
                    new com.google.android.material.button.MaterialButton(c, null,
                            com.google.android.material.R.attr.materialButtonOutlinedStyle);
            logout.setText("退出登录");
            LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            llp.topMargin = Ui.dp(c, 10);
            root.addView(logout, llp);
            logout.setOnClickListener(v -> {
                Api.setToken(c, "");
                Ui.toast(c, "已退出，重新登录");
                if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).promptLogin();
            });
        }

        MaterialButton web = new MaterialButton(c, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        web.setText("在浏览器里打开网页版");
        LinearLayout.LayoutParams wlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        wlp.topMargin = Ui.dp(c, 16);
        root.addView(web, wlp);
        web.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Api.base(requireContext()))));
            } catch (Exception e) {
                Ui.toast(requireContext(), "没有浏览器");
            }
        });

        root.addView(Ui.label(c, "版本 2.0.0 · 原生版"), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        MaterialButton about = new MaterialButton(c, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        about.setText("关于这套东西");
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        alp.topMargin = Ui.dp(c, 16);
        root.addView(about, alp);
        about.setOnClickListener(v -> new MaterialAlertDialogBuilder(requireContext())
                .setTitle("任务卡片")
                .setMessage("纸卡负责看得见、写得上；这个 App 负责同步和统计。\n\n"
                        + "看板：左右滑一张卡，右滑改成进行中，左滑改成完成；长按可以搁置或删除。\n"
                        + "拍照：先认出卡上的二维码，再读手写内容，核对后写回。")
                .setPositiveButton("好", null)
                .show());

        return scroll;
    }
}
