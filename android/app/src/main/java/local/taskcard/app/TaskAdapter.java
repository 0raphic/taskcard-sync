package local.taskcard.app;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.List;

public class TaskAdapter extends RecyclerView.Adapter<TaskAdapter.VH> {

    public interface Listener {
        void onOpen(Task t);

        void onLong(Task t);
    }

    private final List<Task> items = new ArrayList<>();
    private final Listener listener;

    public TaskAdapter(Listener l) {
        this.listener = l;
    }

    public void setItems(List<Task> list) {
        items.clear();
        items.addAll(list);
        notifyDataSetChanged();
    }

    public Task get(int i) {
        return items.get(i);
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        Context c = parent.getContext();
        MaterialCardView card = Ui.card(c);
        LinearLayout box = Ui.column(c);
        int pad = Ui.dp(c, 16);
        box.setPadding(pad, pad, pad, pad);

        TextView head = Ui.text(c, "", 11, Ui.attr(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
        TextView title = Ui.text(c, "", 18, Ui.attr(c, com.google.android.material.R.attr.colorOnSurface));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 4));
        TextView desc = Ui.text(c, "", 13, Ui.attr(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
        desc.setMaxLines(2);
        TextView meta = Ui.label(c, "");
        meta.setPadding(0, Ui.dp(c, 10), 0, 0);

        box.addView(head);
        box.addView(title);
        box.addView(desc);
        box.addView(meta);
        card.addView(box);
        return new VH(card, head, title, desc, meta);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        Task t = items.get(position);
        String kind = "long".equals(t.kind) ? "长期" : "短期";
        h.head.setText(kind + " · " + t.statusLabel() + (t.due.isEmpty() ? "" : " · 截止 " + t.due));
        h.title.setText(t.title.isEmpty() ? "（未命名）" : t.title);
        h.desc.setText(t.description.isEmpty() ? (t.materials.isEmpty() ? "" : "材料：" + t.materials) : t.description);
        h.desc.setVisibility(h.desc.getText().length() == 0 ? View.GONE : View.VISIBLE);
        String m = t.estimateMin > 0 ? "用时 " + t.estimateMin + " 分" : "";
        if ("long".equals(t.kind)) m = "进度 " + t.progress + "%" + (t.weeklyHours > 0 ? " · 每周 " + t.weeklyHours + "h" : "");
        h.meta.setText(m);
        h.meta.setVisibility(m.isEmpty() ? View.GONE : View.VISIBLE);
        h.card.setOnClickListener(v -> listener.onOpen(t));
        h.card.setOnLongClickListener(v -> {
            listener.onLong(t);
            return true;
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        final MaterialCardView card;
        final TextView head, title, desc, meta;

        VH(MaterialCardView card, TextView head, TextView title, TextView desc, TextView meta) {
            super(card);
            this.card = card;
            this.head = head;
            this.title = title;
            this.desc = desc;
            this.meta = meta;
        }
    }
}
