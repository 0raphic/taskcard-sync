package local.taskcard.app;

import org.json.JSONArray;
import org.json.JSONObject;

public class Task {
    public String id = "";
    public String title = "";
    public String kind = "short";
    public String status = "todo";
    public String due = "";
    public String start = "";
    public String priority = "";
    public String dod = "";
    public String description = "";
    public String materials = "";
    public String notes = "";
    public String tags = "";
    public String remindAt = "";
    public String repeat = "";
    public int estimateMin = 0;
    public int progress = 0;
    public int weeklyHours = 0;
    public JSONArray checklist = new JSONArray();
    public int checkDone = 0;
    public int checkTotal = 0;
    public boolean draft = false;

    public static Task from(JSONObject o) {
        Task t = new Task();
        t.id = o.optString("id");
        t.title = o.optString("title");
        t.kind = o.optString("kind", "short");
        t.status = o.optString("status", "todo");
        t.due = o.optString("due");
        t.start = o.optString("start");
        t.priority = o.optString("priority");
        t.dod = o.optString("dod");
        t.description = o.optString("description");
        t.materials = o.optString("materials");
        t.notes = o.optString("notes");
        t.tags = o.optString("tags");
        t.remindAt = o.optString("remind_at");
        t.repeat = o.optString("repeat");
        t.estimateMin = o.optInt("estimate_min");
        t.progress = o.optInt("progress");
        t.weeklyHours = o.optInt("weekly_hours");
        t.draft = o.optBoolean("draft");
        JSONArray list = o.optJSONArray("checklist");
        t.checklist = list != null ? list : new JSONArray();
        if (list != null) {
            t.checkTotal = list.length();
            for (int i = 0; i < list.length(); i++) {
                JSONObject it = list.optJSONObject(i);
                if (it != null && it.optBoolean("d")) t.checkDone += 1;
            }
        }
        return t;
    }

    public static String repeatLabel(String v) {
        if ("daily".equals(v)) return "每天";
        if ("weekdays".equals(v)) return "工作日";
        if ("weekly".equals(v)) return "每周";
        if ("monthly".equals(v)) return "每月";
        return "";
    }

    public boolean matches(String q) {
        if (q == null || q.isEmpty()) return true;
        String needle = q.toLowerCase();
        return title.toLowerCase().contains(needle)
                || tags.toLowerCase().contains(needle)
                || description.toLowerCase().contains(needle);
    }

    public String statusLabel() {
        switch (status) {
            case "doing":
                return "进行中";
            case "done":
                return "已完成";
            case "paused":
                return "搁置";
            default:
                return "待办";
        }
    }

    public boolean done() {
        return "done".equals(status);
    }
}
