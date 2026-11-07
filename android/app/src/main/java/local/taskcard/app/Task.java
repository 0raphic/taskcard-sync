package local.taskcard.app;

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
    public int estimateMin = 0;
    public int progress = 0;
    public int weeklyHours = 0;
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
        t.estimateMin = o.optInt("estimate_min");
        t.progress = o.optInt("progress");
        t.weeklyHours = o.optInt("weekly_hours");
        t.draft = o.optBoolean("draft");
        return t;
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
