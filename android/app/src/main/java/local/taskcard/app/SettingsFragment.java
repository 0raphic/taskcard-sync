package local.taskcard.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;
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
        TextView sub = Ui.label(c, "手机与电脑连接同一 Wi-Fi；地址见电脑端「手机打开」。");
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
            Ui.toast(requireContext(), "已保存。");
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
                    status.setText("连接正常：" + body);
                }

                @Override
                public void fail(Exception e) {
                    status.setText("连接失败。" + e.getMessage());
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
                ? "未登录。"
                : "已登录。纸卡扫码无需登录，拿到卡的人都能改。");
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
                Ui.toast(c, "已退出登录。");
                if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).promptLogin();
            });
        }

        MaterialButton print = new MaterialButton(c, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        print.setText("打印空白卡（导出 PDF）");
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        plp.topMargin = Ui.dp(c, 16);
        root.addView(print, plp);
        print.setOnClickListener(v -> new MaterialAlertDialogBuilder(requireContext())
                .setTitle("打印空白卡")
                .setItems(new String[]{
                        "短期卡 8 张（双面，一页）",
                        "长期卡 8 张（双面，一页）",
                        "短期卡 16 张（双面，两页）",
                        "长期卡 16 张（双面，两页）"
                }, (d, which) -> {
                    boolean isLong = which % 2 == 1;
                    int count = which >= 2 ? 16 : 8;
                    generateBlank(isLong ? "long" : "short", count);
                })
                .setNegativeButton("取消", null)
                .show());

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

        root.addView(Ui.label(c, "版本 " + BuildConfig.VERSION_NAME + " · 原生版"), new LinearLayout.LayoutParams(
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

    private void generateBlank(String kind, int count) {
        final android.content.Context c = requireContext();
        Ui.toast(c, "正在生成 PDF…");
        try {
            JSONObject body = new JSONObject();
            body.put("count", count);
            body.put("kind", kind);
            body.put("double_sided", true);
            body.put("base_url", Api.base(c));
            String stamp = new SimpleDateFormat("MMdd-HHmm", Locale.CHINA).format(new Date());
            File out = new File(c.getFilesDir(), "print/taskcard-" + stamp + ".pdf");
            Api.postFile(c, "/ds-api/cards.blank", body, out, new Api.Cb() {
                @Override
                public void ok(String path) {
                    openPdf(new File(path));
                }

                @Override
                public void fail(Exception e) {
                    if (e instanceof Api.NeedLogin) {
                        Ui.toast(c, "登录已失效，请重新登录。");
                    } else {
                        Ui.toast(c, "导出没有成功。" + e.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            Ui.toast(c, "导出没有成功。" + e.getMessage());
        }
    }

    private void openPdf(File file) {
        try {
            Uri uri = FileProvider.getUriForFile(requireContext(), BuildConfig.APPLICATION_ID + ".files", file);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, "application/pdf");
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(view);
                Ui.toast(requireContext(), "已生成 PDF。在打开的页面里点「打印」或分享。");
            } catch (Exception noViewer) {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("application/pdf");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(send, "打印或保存 PDF"));
            }
        } catch (Exception e) {
            Ui.toast(requireContext(), "打不开 PDF。" + e.getMessage());
        }
    }
}
