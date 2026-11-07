package local.taskcard.app;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.json.JSONObject;

public class DetailActivity extends AppCompatActivity {

    private static final String EXTRA_ID = "id";
    private String id;
    private Task task;
    private EditText title, due, estimate, priority, dod, start, materials, notes, weekly;
    private ChipGroup statusGroup;
    private SeekBar progressBar;
    private TextView progressLabel;

    public static void open(Context c, String id) {
        Intent i = new Intent(c, DetailActivity.class);
        i.putExtra(EXTRA_ID, id);
        c.startActivity(i);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        id = getIntent().getStringExtra(EXTRA_ID);
        build();
        load();
    }

    private void build() {
        LinearLayout root = Ui.column(this);
        MaterialToolbar bar = new MaterialToolbar(this);
        bar.setTitle("任务卡片");
        bar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material);
        bar.setNavigationOnClickListener(v -> finish());
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 56)));

        ScrollView scroll = new ScrollView(this);
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        LinearLayout body = Ui.column(this);
        int pad = Ui.dp(this, 20);
        body.setPadding(pad, pad / 2, pad, pad * 2);
        scroll.addView(body);

        title = field(body, "任务名称", InputType.TYPE_CLASS_TEXT);

        body.addView(Ui.label(this, "状态"));
        statusGroup = new ChipGroup(this);
        statusGroup.setSingleSelection(true);
        String[][] st = {{"待办", "todo"}, {"进行中", "doing"}, {"完成", "done"}, {"搁置", "paused"}};
        for (String[] s : st) {
            Chip chip = new Chip(this);
            chip.setText(s[0]);
            chip.setTag(s[1]);
            chip.setCheckable(true);
            statusGroup.addView(chip);
        }
        body.addView(statusGroup);

        LinearLayout row = Ui.row(this);
        due = field(row, "截止 MM-DD", InputType.TYPE_CLASS_TEXT, 1f);
        estimate = field(row, "用时（分）", InputType.TYPE_CLASS_NUMBER, 1f);
        body.addView(row);

        start = field(body, "开始 MM-DD", InputType.TYPE_CLASS_TEXT);
        priority = field(body, "优先级（重要且紧急 / 重要不紧急 / 紧急不重要 / 其他）", InputType.TYPE_CLASS_TEXT);
        dod = field(body, "完成标准", InputType.TYPE_CLASS_TEXT);
        weekly = field(body, "每周投入（小时，长期卡）", InputType.TYPE_CLASS_NUMBER);
        materials = field(body, "材料", InputType.TYPE_CLASS_TEXT);
        notes = field(body, "备注", InputType.TYPE_CLASS_TEXT);

        body.addView(Ui.label(this, "进度"));
        progressLabel = Ui.label(this, "0%");
        body.addView(progressLabel);
        progressBar = new SeekBar(this);
        progressBar.setMax(100);
        progressBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar sb, int p, boolean fromUser) {
                progressLabel.setText(p + "%");
            }

            @Override
            public void onStartTrackingTouch(SeekBar sb) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar sb) {
            }
        });
        body.addView(progressBar);

        MaterialButton save = new MaterialButton(this);
        save.setText("保存");
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        slp.topMargin = Ui.dp(this, 16);
        body.addView(save, slp);
        save.setOnClickListener(v -> save(null));

        MaterialButton del = new MaterialButton(this, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        del.setText("删除这张卡");
        LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dlp.topMargin = Ui.dp(this, 10);
        body.addView(del, dlp);
        del.setOnClickListener(v -> confirmDelete());

        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
    }

    private EditText field(LinearLayout parent, String hint, int type) {
        return field(parent, hint, type, 0);
    }

    private EditText field(LinearLayout parent, String hint, int type, float weight) {
        LinearLayout box = Ui.column(this);
        box.addView(Ui.label(this, hint));
        EditText e = Ui.input(this, "", "", type);
        box.addView(e);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                weight > 0 ? 0 : ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, weight);
        parent.addView(box, lp);
        return e;
    }

    private void load() {
        Api.get(this, "/api/collections/tasks/records/" + id, new Api.Cb() {
            @Override
            public void ok(String body) {
                try {
                    task = Task.from(new JSONObject(body));
                    fill();
                } catch (Exception e) {
                    Ui.toast(DetailActivity.this, "读不出来：" + e.getMessage());
                }
            }

            @Override
            public void fail(Exception e) {
                Ui.toast(DetailActivity.this, "连不上：" + e.getMessage());
            }
        });
    }

    private void fill() {
        title.setText(task.title);
        due.setText(task.due);
        estimate.setText(task.estimateMin > 0 ? String.valueOf(task.estimateMin) : "");
        priority.setText(task.priority);
        dod.setText(task.dod);
        start.setText(task.start);
        weekly.setText(task.weeklyHours > 0 ? String.valueOf(task.weeklyHours) : "");
        materials.setText(task.materials);
        notes.setText(task.notes);
        progressBar.setProgress(task.progress);
        progressLabel.setText(task.progress + "%");
        progressBar.setVisibility("long".equals(task.kind) ? SeekBar.VISIBLE : SeekBar.GONE);
        for (int i = 0; i < statusGroup.getChildCount(); i++) {
            Chip c = (Chip) statusGroup.getChildAt(i);
            if (String.valueOf(c.getTag()).equals(task.status)) c.setChecked(true);
        }
    }

    private JSONObject collect() throws Exception {
        JSONObject b = new JSONObject();
        b.put("title", title.getText().toString().trim());
        b.put("due", due.getText().toString().trim());
        b.put("start", start.getText().toString().trim());
        b.put("priority", priority.getText().toString().trim());
        b.put("dod", dod.getText().toString().trim());
        b.put("materials", materials.getText().toString().trim());
        b.put("notes", notes.getText().toString().trim());
        String est = estimate.getText().toString().trim();
        b.put("estimate_min", est.isEmpty() ? 0 : Integer.parseInt(est));
        String wk = weekly.getText().toString().trim();
        b.put("weekly_hours", wk.isEmpty() ? 0 : Integer.parseInt(wk));
        for (int i = 0; i < statusGroup.getChildCount(); i++) {
            Chip c = (Chip) statusGroup.getChildAt(i);
            if (c.isChecked()) b.put("status", String.valueOf(c.getTag()));
        }
        if ("long".equals(task == null ? "short" : task.kind)) b.put("progress", progressBar.getProgress());
        return b;
    }

    private void save(Runnable retry) {
        try {
            JSONObject body = collect();
            if (body.optString("title").isEmpty()) {
                Ui.toast(this, "标题不能空");
                return;
            }
            Api.patch(this, "/api/collections/tasks/records/" + id, body, new Api.Cb() {
                @Override
                public void ok(String b) {
                    Ui.toast(DetailActivity.this, "已保存");
                    finish();
                }

                @Override
                public void fail(Exception e) {
                    if (e instanceof Api.NeedPasscode) {
                        Ui.needPasscode(DetailActivity.this, () -> save(null));
                    } else {
                        Ui.toast(DetailActivity.this, e.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            Ui.toast(this, "保存失败：" + e.getMessage());
        }
    }

    private void confirmDelete() {
        new MaterialAlertDialogBuilder(this)
                .setTitle("删掉这张卡？")
                .setMessage("删了就找不回来，纸卡上的短码也会失效。")
                .setPositiveButton("删除", (d, w) -> Api.delete(this,
                        "/api/collections/tasks/records/" + id, new Api.Cb() {
                            @Override
                            public void ok(String b) {
                                Ui.toast(DetailActivity.this, "删掉了");
                                finish();
                            }

                            @Override
                            public void fail(Exception e) {
                                if (e instanceof Api.NeedPasscode) {
                                    Ui.needPasscode(DetailActivity.this, () -> Api.delete(DetailActivity.this,
                                            "/api/collections/tasks/records/" + id, new Api.Cb() {
                                                @Override
                                                public void ok(String b) {
                                                    finish();
                                                }

                                                @Override
                                                public void fail(Exception e2) {
                                                    Ui.toast(DetailActivity.this, e2.getMessage());
                                                }
                                            }));
                                } else {
                                    Ui.toast(DetailActivity.this, e.getMessage());
                                }
                            }
                        }))
                .setNegativeButton("取消", null)
                .show();
    }
}
