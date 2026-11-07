package local.taskcard.app;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class BoardFragment extends Fragment {

    private TaskAdapter adapter;
    private SwipeRefreshLayout refresh;
    private RecyclerView list;
    private TextView empty;
    private String filter = "all";
    private String query = "";
    private final List<Task> all = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        LinearLayout root = Ui.column(requireContext());
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        EditText search = Ui.input(requireContext(), "搜索标题 / 标签", "",
                android.text.InputType.TYPE_CLASS_TEXT);
        LinearLayout.LayoutParams searchLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        int sp = Ui.dp(requireContext(), 12);
        searchLp.setMargins(sp, Ui.dp(requireContext(), 10), sp, 0);
        root.addView(search, searchLp);
        search.addTextChangedListener(new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int st, int c, int a) {
            }

            @Override
            public void onTextChanged(CharSequence s, int st, int b, int c) {
                query = s.toString().trim();
                render();
            }

            @Override
            public void afterTextChanged(android.text.Editable s) {
            }
        });

        ChipGroup chips = new ChipGroup(requireContext());
        chips.setSingleSelection(true);
        chips.setSelectionRequired(true);
        chips.setPadding(Ui.dp(requireContext(), 12), Ui.dp(requireContext(), 8),
                Ui.dp(requireContext(), 12), 0);
        String[][] defs = {{"全部", "all"}, {"待办", "todo"}, {"进行中", "doing"}, {"已完成", "done"}};
        for (String[] d : defs) {
            Chip chip = new Chip(requireContext());
            chip.setText(d[0]);
            chip.setCheckable(true);
            chip.setTag(d[1]);
            chip.setChecked("all".equals(d[1]));
            int onSurface = Ui.attr(requireContext(), com.google.android.material.R.attr.colorOnSurface);
            int onSurfaceVariant = Ui.attr(requireContext(), com.google.android.material.R.attr.colorOnSurfaceVariant);
            int surfaceColor = Ui.attr(requireContext(), com.google.android.material.R.attr.colorSurface);
            chip.setChipBackgroundColor(new android.content.res.ColorStateList(
                    new int[][]{{android.R.attr.state_checked}, {}},
                    new int[]{onSurface, 0x00FFFFFF}));
            chip.setTextColor(new android.content.res.ColorStateList(
                    new int[][]{{android.R.attr.state_checked}, {}},
                    new int[]{surfaceColor, onSurfaceVariant}));
            chip.setChipStrokeWidth(Ui.dp(requireContext(), 1));
            chip.setChipStrokeColor(android.content.res.ColorStateList.valueOf(
                    Ui.attr(requireContext(), com.google.android.material.R.attr.colorOutline)));
            chips.addView(chip);
        }
        chips.setOnCheckedStateChangeListener((group, checkedIds) -> {
            if (checkedIds.isEmpty()) return;
            Chip c = group.findViewById(checkedIds.get(0));
            filter = String.valueOf(c.getTag());
            render();
        });
        HorizontalScrollView hs = new HorizontalScrollView(requireContext());
        hs.setHorizontalScrollBarEnabled(false);
        hs.addView(chips);
        root.addView(hs);

        refresh = new SwipeRefreshLayout(requireContext());
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        refresh.setLayoutParams(rlp);
        refresh.setOnRefreshListener(this::load);

        FrameLayout holder = new FrameLayout(requireContext());
        list = new RecyclerView(requireContext());
        list.setLayoutManager(new LinearLayoutManager(requireContext()));
        list.setClipToPadding(false);
        list.setPadding(0, 0, 0, Ui.dp(requireContext(), 96));
        list.setClipToPadding(false);
        list.setPadding(Ui.dp(requireContext(), 12), Ui.dp(requireContext(), 8),
                Ui.dp(requireContext(), 12), Ui.dp(requireContext(), 88));
        adapter = new TaskAdapter(new TaskAdapter.Listener() {
            @Override
            public void onOpen(Task t) {
                DetailActivity.open(requireContext(), t.id);
            }

            @Override
            public void onLong(Task t) {
                showActions(t);
            }
        });
        list.setAdapter(adapter);
        holder.addView(list, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        empty = Ui.text(requireContext(), "这一格还没有卡", 14,
                Ui.attr(requireContext(), com.google.android.material.R.attr.colorOnSurfaceVariant));
        FrameLayout.LayoutParams elp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        elp.gravity = Gravity.CENTER;
        holder.addView(empty, elp);
        refresh.addView(holder);
        root.addView(refresh);

        new ItemTouchHelper(new ItemTouchHelper.SimpleCallback(0,
                ItemTouchHelper.LEFT | ItemTouchHelper.RIGHT) {
            @Override
            public boolean onMove(@NonNull RecyclerView rv, @NonNull RecyclerView.ViewHolder a,
                                  @NonNull RecyclerView.ViewHolder b) {
                return false;
            }

            @Override
            public void onSwiped(@NonNull RecyclerView.ViewHolder vh, int direction) {
                Task t = adapter.get(vh.getBindingAdapterPosition());
                String next = direction == ItemTouchHelper.RIGHT ? "doing" : "done";
                adapter.notifyItemChanged(vh.getBindingAdapterPosition());
                setStatus(t, next, null);
            }
        }).attachToRecyclerView(list);

        load();
        return root;
    }

    public void load() {
        refresh.setRefreshing(true);
        Api.get(requireContext(),
                "/api/collections/tasks/records?perPage=300&sort=-created&filter=" + enc("draft=false"),
                new Api.Cb() {
                    @Override
                    public void ok(String body) {
                        if (!isAdded()) return;
                        refresh.setRefreshing(false);
                        all.clear();
                        try {
                            JSONArray arr = new JSONObject(body).optJSONArray("items");
                            for (int i = 0; arr != null && i < arr.length(); i++) {
                                all.add(Task.from(arr.getJSONObject(i)));
                            }
                        } catch (Exception ignored) {
                        }
                        render();
                    }

                    @Override
                    public void fail(Exception e) {
                        if (!isAdded()) return;
                        refresh.setRefreshing(false);
                        Ui.toast(requireContext(), "连不上：" + e.getMessage());
                    }
                });
    }

    private void render() {
        List<Task> shown = new ArrayList<>();
        for (Task t : all) {
            if (!t.matches(query)) continue;
            if ("all".equals(filter)) shown.add(t);
            else if ("done".equals(filter) && t.done()) shown.add(t);
            else if ("todo".equals(filter) && !t.done() && !"doing".equals(t.status)) shown.add(t);
            else if ("doing".equals(filter) && "doing".equals(t.status)) shown.add(t);
        }
        adapter.setItems(shown);
        empty.setVisibility(shown.isEmpty() ? View.VISIBLE : View.GONE);
    }

    public void quickAdd() {
        LinearLayout box = Ui.column(requireContext());
        int pad = Ui.dp(requireContext(), 20);
        box.setPadding(pad, pad / 2, pad, 0);
        EditText title = Ui.input(requireContext(), "任务名称", "", android.text.InputType.TYPE_CLASS_TEXT);
        box.addView(title);
        String[] kinds = {"短期任务", "长期目标"};
        final int[] kind = {0};
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle("新建一张卡")
                .setView(box)
                .setSingleChoiceItems(kinds, 0, (d, which) -> kind[0] = which)
                .setPositiveButton("建卡", (d, w) -> {
                    String t = title.getText().toString().trim();
                    if (t.isEmpty()) return;
                    try {
                        JSONObject body = new JSONObject();
                        body.put("title", t);
                        body.put("kind", kind[0] == 0 ? "short" : "long");
                        body.put("status", "todo");
                        Api.post(requireContext(), "/api/collections/tasks/records", body, new Api.Cb() {
                            @Override
                            public void ok(String b) {
                                load();
                                Ui.toast(requireContext(), "建好了");
                            }

                            @Override
                            public void fail(Exception e) {
                                if (e instanceof Api.NeedPasscode) {
                                    Ui.needPasscode(requireActivity(), this::retry);
                                } else {
                                    Ui.toast(requireContext(), e.getMessage());
                                }
                            }

                            private void retry() {
                                quickAdd();
                            }
                        });
                    } catch (Exception ignored) {
                    }
                })
                .setNegativeButton("取消", null)
                .show();
    }

    private void showActions(Task t) {
        String[] items = {"打开", "标记进行中", "标记完成", "搁置", "删除"};
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle(t.title)
                .setItems(items, (d, which) -> {
                    if (which == 0) DetailActivity.open(requireContext(), t.id);
                    else if (which == 1) setStatus(t, "doing", null);
                    else if (which == 2) setStatus(t, "done", null);
                    else if (which == 3) setStatus(t, "paused", null);
                    else delete(t);
                })
                .show();
    }

    private void setStatus(Task t, String status, Runnable retry) {
        try {
            JSONObject body = new JSONObject();
            body.put("status", status);
            Api.patch(requireContext(), "/api/collections/tasks/records/" + t.id, body, new Api.Cb() {
                @Override
                public void ok(String b) {
                    Ui.toast(requireContext(), "已改成" + ("doing".equals(status) ? "进行中" : "done".equals(status) ? "已完成" : status));
                    load();
                }

                @Override
                public void fail(Exception e) {
                    if (e instanceof Api.NeedPasscode) {
                        Ui.needPasscode(requireActivity(), () -> setStatus(t, status, null));
                    } else {
                        Ui.toast(requireContext(), e.getMessage());
                        load();
                    }
                }
            });
        } catch (Exception ignored) {
        }
    }

    private void delete(Task t) {
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle("删掉这张卡？")
                .setMessage("短码「" + t.id + "」对应的纸卡也会失效。")
                .setPositiveButton("删除", (d, w) -> Api.delete(requireContext(),
                        "/api/collections/tasks/records/" + t.id, new Api.Cb() {
                            @Override
                            public void ok(String b) {
                                Ui.toast(requireContext(), "删掉了");
                                load();
                            }

                            @Override
                            public void fail(Exception e) {
                                if (e instanceof Api.NeedPasscode) {
                                    Ui.needPasscode(requireActivity(), () -> delete(t));
                                } else {
                                    Ui.toast(requireContext(), e.getMessage());
                                }
                            }
                        }))
                .setNegativeButton("取消", null)
                .show();
    }

    private static String enc(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
