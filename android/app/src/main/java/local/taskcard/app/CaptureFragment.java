package local.taskcard.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;

public class CaptureFragment extends Fragment {

    private Uri pendingUri;
    private ImageView preview;
    private ProgressBar busy;
    private TextView hint;
    private ActivityResultLauncher<Uri> takePicture;
    private ActivityResultLauncher<String> pickImage;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        Context c = requireContext();
        LinearLayout root = Ui.column(c);
        int pad = Ui.dp(c, 20);
        root.setPadding(pad, pad, pad, pad);

        root.addView(Ui.text(c, "拍一张，写回这张卡", 22,
                Ui.attr(c, com.google.android.material.R.attr.colorOnSurface)));
        TextView sub = Ui.label(c, "先认出右上角的码是哪张卡，再读卡面上的手写内容。");
        sub.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 18));
        root.addView(sub);

        MaterialButton shoot = new MaterialButton(c);
        shoot.setText("拍照");
        shoot.setOnClickListener(v -> shoot());
        root.addView(shoot);

        MaterialButton album = new MaterialButton(c, null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle);
        album.setText("从相册选");
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        alp.topMargin = Ui.dp(c, 10);
        root.addView(album, alp);
        album.setOnClickListener(v -> pickImage.launch("image/*"));

        busy = new ProgressBar(c);
        busy.setVisibility(ProgressBar.GONE);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(
                Ui.dp(c, 32), Ui.dp(c, 32));
        blp.topMargin = Ui.dp(c, 18);
        blp.gravity = Gravity.CENTER_HORIZONTAL;
        root.addView(busy, blp);

        preview = new ImageView(c);
        preview.setAdjustViewBounds(true);
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        plp.topMargin = Ui.dp(c, 16);
        root.addView(preview, plp);

        hint = Ui.label(c, "");
        hint.setPadding(0, Ui.dp(c, 12), 0, 0);
        root.addView(hint);

        takePicture = registerForActivityResult(new ActivityResultContracts.TakePicture(), ok -> {
            if (ok) handleUri(pendingUri);
        });
        pickImage = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
            if (uri != null) handleUri(uri);
        });
        return root;
    }

    private void shoot() {
        try {
            File f = new File(requireContext().getCacheDir(), "shot-" + System.currentTimeMillis() + ".jpg");
            pendingUri = FileProvider.getUriForFile(requireContext(),
                    requireContext().getPackageName() + ".files", f);
            takePicture.launch(pendingUri);
        } catch (Exception e) {
            Ui.toast(requireContext(), "打不开相机：" + e.getMessage());
        }
    }

    private void handleUri(Uri uri) {
        busy.setVisibility(ProgressBar.VISIBLE);
        hint.setText("识别中…");
        new Thread(() -> {
            try {
                Bitmap bmp = decode(uri, 1600);
                String data = dataUrl(bmp);
                requireActivity().runOnUiThread(() -> preview.setImageBitmap(bmp));
                JSONObject body = new JSONObject();
                body.put("image", data);
                Api.post(requireContext(), "/ds-api/scan", body, new Api.Cb() {
                    @Override
                    public void ok(String b) {
                        busy.setVisibility(ProgressBar.GONE);
                        hint.setText("");
                        try {
                            JSONObject o = new JSONObject(b);
                            showResult(o);
                        } catch (Exception e) {
                            Ui.toast(requireContext(), "返回看不懂：" + e.getMessage());
                        }
                    }

                    @Override
                    public void fail(Exception e) {
                        busy.setVisibility(ProgressBar.GONE);
                        hint.setText("");
                        Ui.toast(requireContext(), e.getMessage());
                    }
                });
            } catch (Exception e) {
                requireActivity().runOnUiThread(() -> {
                    busy.setVisibility(ProgressBar.GONE);
                    hint.setText("");
                    Ui.toast(requireContext(), "图片处理失败：" + e.getMessage());
                });
            }
        }).start();
    }

    private Bitmap decode(Uri uri, int maxSide) throws Exception {
        Bitmap src;
        if (Build.VERSION.SDK_INT >= 28) {
            ImageDecoder.Source s = ImageDecoder.createSource(requireContext().getContentResolver(), uri);
            src = ImageDecoder.decodeBitmap(s, (decoder, info, source) -> {
                int w = info.getSize().getWidth();
                int h = info.getSize().getHeight();
                float scale = Math.min(1f, maxSide / (float) Math.max(w, h));
                decoder.setTargetSize(Math.max(1, (int) (w * scale)), Math.max(1, (int) (h * scale)));
            });
        } else {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream is = requireContext().getContentResolver().openInputStream(uri)) {
                BitmapFactory.decodeStream(is, null, o);
            }
            int scale = 1;
            while (Math.max(o.outWidth, o.outHeight) / scale > maxSide * 2) scale *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = scale;
            try (InputStream is = requireContext().getContentResolver().openInputStream(uri)) {
                src = BitmapFactory.decodeStream(is, null, o2);
            }
        }
        if (src == null) throw new IllegalStateException("读不出图片");
        int w = src.getWidth(), h = src.getHeight();
        float scale = Math.min(1f, maxSide / (float) Math.max(w, h));
        if (scale < 1f) src = Bitmap.createScaledBitmap(src, (int) (w * scale), (int) (h * scale), true);
        return src;
    }

    private String dataUrl(Bitmap bmp) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 85, out);
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private void showResult(JSONObject o) {
        JSONObject card = o.optJSONObject("card");
        JSONObject f = o.optJSONObject("fields");
        if (card == null || f == null) {
            Ui.toast(requireContext(), "没认出这张卡");
            return;
        }
        String code = o.optString("code");
        String title = f.optString("title", card.optString("title"));
        String taskId = card.optString("id");

        LinearLayout box = Ui.column(requireContext());
        int pad = Ui.dp(requireContext(), 20);
        box.setPadding(pad, pad / 2, pad, 0);
        box.addView(Ui.label(requireContext(), "认出卡片 " + code + " · " + card.optString("title")));

        EditText et = Ui.input(requireContext(), "标题", title, android.text.InputType.TYPE_CLASS_TEXT);
        EditText due = Ui.input(requireContext(), "截止 MM-DD", f.optString("due"), android.text.InputType.TYPE_CLASS_TEXT);
        EditText est = Ui.input(requireContext(), "用时（分）", f.optString("estimate_min"), android.text.InputType.TYPE_CLASS_NUMBER);
        EditText mat = Ui.input(requireContext(), "材料", f.optString("materials"), android.text.InputType.TYPE_CLASS_TEXT);
        EditText notes = Ui.input(requireContext(), "备注", f.optString("notes"), android.text.InputType.TYPE_CLASS_TEXT);
        box.addView(Ui.label(requireContext(), "标题"));
        box.addView(et);
        box.addView(Ui.label(requireContext(), "截止"));
        box.addView(due);
        box.addView(Ui.label(requireContext(), "用时"));
        box.addView(est);
        box.addView(Ui.label(requireContext(), "材料"));
        box.addView(mat);
        box.addView(Ui.label(requireContext(), "备注"));
        box.addView(notes);

        new MaterialAlertDialogBuilder(requireContext())
                .setTitle("认出来了，核对一下")
                .setView(box)
                .setPositiveButton("写回这张卡", (d, w) -> {
                    try {
                        JSONObject body = new JSONObject();
                        if (!title.trim().isEmpty()) body.put("title", title.trim());
                        if (!due.getText().toString().trim().isEmpty()) body.put("due", due.getText().toString().trim());
                        String e = est.getText().toString().trim();
                        if (!e.isEmpty()) body.put("estimate_min", Integer.parseInt(e));
                        if (!mat.getText().toString().trim().isEmpty()) body.put("materials", mat.getText().toString().trim());
                        if (!notes.getText().toString().trim().isEmpty()) body.put("notes", notes.getText().toString().trim());
                        Api.patch(requireContext(), "/api/collections/tasks/records/" + taskId, body, new Api.Cb() {
                            @Override
                            public void ok(String b) {
                                Ui.toast(requireContext(), "写回了");
                            }

                            @Override
                            public void fail(Exception ex) {
                                if (ex instanceof Api.NeedPasscode) {
                                    Ui.needPasscode(requireActivity(), () -> Ui.toast(requireContext(), "再点一次写回"));
                                } else {
                                    Ui.toast(requireContext(), ex.getMessage());
                                }
                            }
                        });
                    } catch (Exception ex) {
                        Ui.toast(requireContext(), "写回失败：" + ex.getMessage());
                    }
                })
                .setNegativeButton("取消", null)
                .show();
    }
}
