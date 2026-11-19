package com.kyvu.fit3notessender;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {

    private static final int REQ_PICK_TXT_FILE = 1002;

    // Kênh đồng bộ riêng đọc từ SyncConfig.java (tự động sinh từ file .env khi chạy build-android-apk.ps1)
    private static final String CHANNEL_PREFIX = SyncConfig.CHANNEL_PREFIX;
    private static final String RELAY_BASE = SyncConfig.RELAY_BASE;

    // Mỗi phần tối đa 2200 bytes UTF-8 (nhỏ hơn giới hạn 4KB của relay và 7KB của @system.fetch trên Watch Fit 3)
    private static final int MAX_PART_UTF8_BYTES = 2200;
    private static final int LOCAL_HTTP_PORT = 8765;

    private static final String PREFS_NAME = "fit3_notes_sender_prefs";
    private static final String KEY_HISTORY_JSON = "history_json";
    private static final String KEY_DRAFT_TITLE = "draft_title";
    private static final String KEY_DRAFT_CONTENT = "draft_content";

    private EditText titleInput;
    private EditText contentInput;
    private TextView statsText;
    private TextView statusTitleText;
    private TextView statusDetailText;
    private ProgressBar progressBar;
    private Button sendBtn;
    private LinearLayout historyContainer;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean isUploading = false;

    // Local HTTP server (127.0.0.1:8765) chạy song song cho chế độ thử Offline
    private ServerSocket localServerSocket;
    private volatile boolean localServerRunning = false;
    private volatile String latestMetaJson = "";
    private volatile List<String> latestParts = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildContentView());
        restoreDraft();
        refreshStats();
        renderHistoryList();
        startLocalHttpServer();
    }

    private View buildContentView() {
        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setBackgroundColor(Color.parseColor("#0B0F17"));
        rootScroll.setFillViewport(true);

        LinearLayout mainCol = new LinearLayout(this);
        mainCol.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        mainCol.setPadding(pad, dp(20), pad, dp(28));

        // 1. Header Card
        LinearLayout headerCard = createCard("#122338", "#1E6091");
        TextView appBadge = new TextView(this);
        appBadge.setText("HUAWEI WATCH FIT 3 • ĐỒNG BỘ TỐC ĐỘ CAO (v2.0)");
        appBadge.setTextColor(Color.parseColor("#72B7FF"));
        appBadge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        appBadge.setTypeface(Typeface.DEFAULT_BOLD);
        headerCard.addView(appBadge);

        TextView appTitle = new TextView(this);
        appTitle.setText("Gửi Ghi Chú Sang Watch Fit 3");
        appTitle.setTextColor(Color.parseColor("#FFFFFF"));
        appTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        appTitle.setTypeface(Typeface.DEFAULT_BOLD);
        appTitle.setPadding(0, dp(4), 0, dp(4));
        headerCard.addView(appTitle);

        TextView appDesc = new TextView(this);
        appDesc.setText("Gửi văn bản dài bất kỳ qua kênh đồng bộ HTTPS (Huawei Health) + hỗ trợ máy chủ nội bộ 127.0.0.1:8765. Tải trọn bài hàng nghìn chữ trong 1–2 giây!");
        appDesc.setTextColor(Color.parseColor("#B8C7D9"));
        appDesc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        headerCard.addView(appDesc);
        mainCol.addView(headerCard, marginBottom(dp(14)));

        // 2. Editor Card
        LinearLayout editorCard = createCard("#131B26", "#233042");

        editorCard.addView(createSectionLabel("1. TIÊU ĐỀ GHI CHÚ"));

        titleInput = new EditText(this);
        titleInput.setHint("Nhập tiêu đề (VD: Tài liệu họp, Đề cương, Danh sách...)");
        titleInput.setHintTextColor(Color.parseColor("#6C7A89"));
        titleInput.setTextColor(Color.parseColor("#FFFFFF"));
        titleInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        titleInput.setSingleLine(true);
        titleInput.setBackground(createRoundedRect("#0B1018", "#2B3B4E", dp(10)));
        titleInput.setPadding(dp(12), dp(10), dp(12), dp(10));
        editorCard.addView(titleInput, marginBottom(dp(12)));

        editorCard.addView(createSectionLabel("2. NỘI DUNG GHI CHÚ (KHÔNG GIỚI HẠN SỐ CHỮ)"));

        LinearLayout toolRow = new LinearLayout(this);
        toolRow.setOrientation(LinearLayout.HORIZONTAL);

        Button pasteBtn = createActionButton("Dán Clipboard", "#1E3A5F", "#82C0FF");
        pasteBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { pasteFromClipboard(); }
        });

        Button loadFileBtn = createActionButton("Chọn file .txt", "#1E3A5F", "#82C0FF");
        loadFileBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { pickTextFile(); }
        });

        Button clearBtn = createActionButton("Xóa trắng", "#2B2028", "#FF9E9E");
        clearBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                titleInput.setText("");
                contentInput.setText("");
                saveDraft();
                Toast.makeText(MainActivity.this, "Đã xóa trắng ô nhập", Toast.LENGTH_SHORT).show();
            }
        });

        LinearLayout.LayoutParams btnLp1 = new LinearLayout.LayoutParams(0, dp(40), 1.1f);
        btnLp1.rightMargin = dp(6);
        LinearLayout.LayoutParams btnLp2 = new LinearLayout.LayoutParams(0, dp(40), 1.1f);
        btnLp2.rightMargin = dp(6);
        LinearLayout.LayoutParams btnLp3 = new LinearLayout.LayoutParams(0, dp(40), 0.85f);

        toolRow.addView(pasteBtn, btnLp1);
        toolRow.addView(loadFileBtn, btnLp2);
        toolRow.addView(clearBtn, btnLp3);
        editorCard.addView(toolRow, marginBottom(dp(10)));

        contentInput = new EditText(this);
        contentInput.setHint("Nhập hoặc dán văn bản tiếng Việt dài bao nhiêu chữ cũng được...\nĐồng hồ sẽ tự động chia dòng chống cắt chữ (...) và phân trang.");
        contentInput.setHintTextColor(Color.parseColor("#6C7A89"));
        contentInput.setTextColor(Color.parseColor("#EAECEF"));
        contentInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        contentInput.setMinLines(7);
        contentInput.setMaxLines(14);
        contentInput.setGravity(Gravity.TOP | Gravity.START);
        contentInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        contentInput.setBackground(createRoundedRect("#0B1018", "#2B3B4E", dp(10)));
        contentInput.setPadding(dp(12), dp(12), dp(12), dp(12));
        editorCard.addView(contentInput, marginBottom(dp(8)));

        statsText = new TextView(this);
        statsText.setText("0 ký tự | 0 bytes UTF-8 | 0 phần");
        statsText.setTextColor(Color.parseColor("#72B7FF"));
        statsText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        statsText.setTypeface(Typeface.DEFAULT_BOLD);
        editorCard.addView(statsText);

        TextWatcher watcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                refreshStats();
                saveDraft();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        };
        titleInput.addTextChangedListener(watcher);
        contentInput.addTextChangedListener(watcher);

        mainCol.addView(editorCard, marginBottom(dp(14)));

        // 3. Card Gửi & Trạng thái
        LinearLayout txCard = createCard("#131B26", "#233042");

        sendBtn = new Button(this);
        sendBtn.setAllCaps(false);
        sendBtn.setText("GỬI GHI CHÚ SANG WATCH FIT 3");
        sendBtn.setTextColor(Color.WHITE);
        sendBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        sendBtn.setTypeface(Typeface.DEFAULT_BOLD);
        sendBtn.setBackground(createRoundedRect("#2E7D32", "#4CAF50", dp(12)));
        sendBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                sendNoteToWatch();
            }
        });
        txCard.addView(sendBtn, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(54)));

        LinearLayout statusBox = createCard("#0B1018", "#1E2B3A");
        LinearLayout.LayoutParams statusBoxLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        statusBoxLp.topMargin = dp(12);

        statusTitleText = new TextView(this);
        statusTitleText.setText("Trạng thái: Sẵn sàng gửi");
        statusTitleText.setTextColor(Color.parseColor("#80E27E"));
        statusTitleText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        statusTitleText.setTypeface(Typeface.DEFAULT_BOLD);
        statusBox.addView(statusTitleText);

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        LinearLayout.LayoutParams pbLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(10));
        pbLp.topMargin = dp(8);
        pbLp.bottomMargin = dp(8);
        statusBox.addView(progressBar, pbLp);

        statusDetailText = new TextView(this);
        statusDetailText.setText("Cách dùng siêu nhanh (2 bước):\n1. Nhập hoặc dán ghi chú rồi bấm [GỬI GHI CHÚ SANG WATCH FIT 3].\n2. Trên đồng hồ Watch Fit 3, mở app Ghi Chú Fit 3 -> bấm [↓ Nhận ghi chú từ Điện thoại]. Đồng hồ sẽ tự tải toàn bộ bài trong 1–2 giây!\n(Kênh riêng: " + CHANNEL_PREFIX + ")");
        statusDetailText.setTextColor(Color.parseColor("#B8C7D9"));
        statusDetailText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusBox.addView(statusDetailText);

        txCard.addView(statusBox, statusBoxLp);
        mainCol.addView(txCard, marginBottom(dp(14)));

        // 4. Lịch sử ghi chú đã soạn
        LinearLayout historyCard = createCard("#131B26", "#233042");
        historyCard.addView(createSectionLabel("3. LỊCH SỬ GHI CHÚ ĐÃ GỬI TRÊN ĐIỆN THOẠI"));

        historyContainer = new LinearLayout(this);
        historyContainer.setOrientation(LinearLayout.VERTICAL);
        historyCard.addView(historyContainer);

        mainCol.addView(historyCard);

        rootScroll.addView(mainCol);
        return rootScroll;
    }

    private List<String> splitTextByUtf8Bytes(String text, int maxBytes) {
        List<String> parts = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            parts.add("");
            return parts;
        }
        StringBuilder current = new StringBuilder();
        int currentBytes = 0;

        int len = text.length();
        for (int i = 0; i < len; ) {
            int cp = text.codePointAt(i);
            int charCount = Character.charCount(cp);
            String piece = text.substring(i, i + charCount);
            int pieceBytes = piece.getBytes(StandardCharsets.UTF_8).length;

            if (currentBytes + pieceBytes > maxBytes && current.length() > 0) {
                parts.add(current.toString());
                current.setLength(0);
                currentBytes = 0;
            }
            current.append(piece);
            currentBytes += pieceBytes;
            i += charCount;
        }
        if (current.length() > 0) {
            parts.add(current.toString());
        }
        return parts;
    }

    private void refreshStats() {
        String content = contentInput.getText().toString();
        if (content.isEmpty()) {
            statsText.setText("0 ký tự | 0 bytes UTF-8 | 0 phần tải");
            return;
        }
        byte[] utf8 = content.getBytes(StandardCharsets.UTF_8);
        int parts = (utf8.length + MAX_PART_UTF8_BYTES - 1) / MAX_PART_UTF8_BYTES;
        statsText.setText(String.format(Locale.US,
                "%,d ký tự | %,d bytes UTF-8 | %d phần (~2KB/phần)",
                content.length(), utf8.length, Math.max(1, parts)));
    }

    private void sendNoteToWatch() {
        if (isUploading) {
            Toast.makeText(this, "Đang gửi ghi chú, vui lòng chờ 1 giây...", Toast.LENGTH_SHORT).show();
            return;
        }

        String rawTitle = titleInput.getText().toString().trim().replace("\n", " ");
        String rawContent = contentInput.getText().toString().replace("\r\n", "\n").replace("\r", "\n");

        if (rawTitle.isEmpty() && rawContent.trim().isEmpty()) {
            Toast.makeText(this, "Vui lòng nhập tiêu đề hoặc nội dung ghi chú!", Toast.LENGTH_SHORT).show();
            return;
        }

        final String finalTitle = rawTitle.isEmpty() ? "Ghi chú từ Điện thoại" : rawTitle;
        final String finalContent = rawContent.isEmpty() ? finalTitle : rawContent;

        saveNoteToHistory(finalTitle, finalContent);

        final List<String> parts = splitTextByUtf8Bytes(finalContent, MAX_PART_UTF8_BYTES);
        final String msgId = "m" + Long.toString(System.currentTimeMillis() % 10000000L, 36);

        // Chuẩn bị manifest (nếu bài ngắn <= 1500 bytes thì nhúng sẵn "c" để đồng hồ tải trong 1 lượt duy nhất)
        final boolean inlineInManifest = (parts.size() == 1 && finalContent.getBytes(StandardCharsets.UTF_8).length <= 1500);
        try {
            JSONObject meta = new JSONObject();
            meta.put("id", msgId);
            meta.put("n", parts.size());
            meta.put("t", finalTitle);
            if (inlineInManifest) {
                meta.put("c", finalContent);
            }
            latestMetaJson = meta.toString();
            latestParts = parts;
        } catch (Exception ignored) {}

        isUploading = true;
        sendBtn.setEnabled(false);
        sendBtn.setText("ĐANG ĐẨY GHI CHÚ LÊN KÊNH ĐỒNG BỘ...");
        progressBar.setProgress(5);
        statusTitleText.setText("Đang gửi " + parts.size() + " phần dữ liệu...");
        statusTitleText.setTextColor(Color.parseColor("#72B7FF"));

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    int total = parts.size();
                    for (int i = 0; i < total; i++) {
                        final int step = i + 1;
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                int pct = (int) Math.round((step * 85.0) / total);
                                progressBar.setProgress(pct);
                                statusTitleText.setText("Đang tải lên phần " + step + "/" + total + "...");
                            }
                        });

                        String partUrl = RELAY_BASE + CHANNEL_PREFIX + "_" + msgId + "_" + i;
                        int code = httpPostUtf8(partUrl, parts.get(i));
                        if (code < 200 || code >= 300) {
                            throw new Exception("Máy chủ relay trả về HTTP " + code + " ở phần " + step);
                        }
                        if (total > 2) {
                            Thread.sleep(150);
                        }
                    }

                    // Gửi bản tin Manifest cuối cùng để đồng hồ biết mã phiên & số phần
                    String latestUrl = RELAY_BASE + CHANNEL_PREFIX + "_latest";
                    int metaCode = httpPostUtf8(latestUrl, latestMetaJson);
                    if (metaCode < 200 || metaCode >= 300) {
                        throw new Exception("Lỗi gửi mục lục manifest (HTTP " + metaCode + ")");
                    }

                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            isUploading = false;
                            sendBtn.setEnabled(true);
                            sendBtn.setText("GỬI GHI CHÚ SANG WATCH FIT 3");
                            progressBar.setProgress(100);
                            statusTitleText.setText("✓ ĐÃ GỬI THÀNH CÔNG (" + parts.size() + " phần)!");
                            statusTitleText.setTextColor(Color.parseColor("#80E27E"));
                            statusDetailText.setText("Ghi chú \"" + finalTitle + "\" (" + finalContent.length()
                                    + " ký tự) đã sẵn sàng!\nBây giờ hãy mở app Ghi Chú Fit 3 trên đồng hồ -> bấm [↓ Nhận ghi chú từ Điện thoại] -> [↻ Tải mới].");
                            Toast.makeText(MainActivity.this, "Đã gửi xong! Mở đồng hồ bấm Tải mới.", Toast.LENGTH_LONG).show();
                        }
                    });
                } catch (final Exception e) {
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            isUploading = false;
                            sendBtn.setEnabled(true);
                            sendBtn.setText("THỬ GỬI LẠI SANG WATCH FIT 3");
                            progressBar.setProgress(0);
                            statusTitleText.setText("Lỗi gửi lên mạng (nhưng Local 127.0.0.1 vẫn sẵn sàng)");
                            statusTitleText.setTextColor(Color.parseColor("#FF8A80"));
                            statusDetailText.setText("Chi tiết lỗi: " + e.getMessage()
                                    + "\nKiểm tra Wi-Fi / 4G trên điện thoại rồi thử lại.");
                        }
                    });
                }
            }
        }).start();
    }

    private int httpPostUtf8(String urlStr, String bodyText) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "text/plain; charset=utf-8");

            byte[] bytes = bodyText.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            OutputStream os = conn.getOutputStream();
            os.write(bytes);
            os.flush();
            os.close();

            return conn.getResponseCode();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    // Máy chủ HTTP cục bộ siêu nhẹ trên 127.0.0.1:8765 phòng trường hợp Huawei Health cho phép tải offline
    private void startLocalHttpServer() {
        localServerRunning = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    localServerSocket = new ServerSocket(LOCAL_HTTP_PORT, 10, InetAddress.getByName("127.0.0.1"));
                    while (localServerRunning) {
                        Socket client = localServerSocket.accept();
                        handleLocalHttpClient(client);
                    }
                } catch (Exception ignored) {}
            }
        }).start();
    }

    private void handleLocalHttpClient(Socket client) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
            String reqLine = reader.readLine();
            String respBody = "{}";
            String contentType = "application/json; charset=utf-8";

            if (reqLine != null) {
                if (reqLine.contains("/meta")) {
                    respBody = latestMetaJson.isEmpty() ? "{}" : latestMetaJson;
                } else if (reqLine.contains("/part?i=")) {
                    contentType = "text/plain; charset=utf-8";
                    int idxPos = reqLine.indexOf("i=");
                    int spacePos = reqLine.indexOf(' ', idxPos);
                    String numStr = (spacePos > idxPos) ? reqLine.substring(idxPos + 2, spacePos) : "0";
                    int partIdx = Integer.parseInt(numStr.trim());
                    List<String> snap = latestParts;
                    if (partIdx >= 0 && partIdx < snap.size()) {
                        respBody = snap.get(partIdx);
                    } else {
                        respBody = "";
                    }
                }
            }

            byte[] bodyBytes = respBody.getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: " + contentType + "\r\n"
                    + "Content-Length: " + bodyBytes.length + "\r\n"
                    + "Connection: close\r\n\r\n";

            OutputStream os = client.getOutputStream();
            os.write(headers.getBytes(StandardCharsets.US_ASCII));
            os.write(bodyBytes);
            os.flush();
            client.close();
        } catch (Exception ignored) {
            try { client.close(); } catch (Exception ignored2) {}
        }
    }

    private void pasteFromClipboard() {
        ClipboardManager cb = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (cb == null || !cb.hasPrimaryClip()) {
            Toast.makeText(this, "Clipboard đang trống", Toast.LENGTH_SHORT).show();
            return;
        }
        ClipData clip = cb.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) {
            Toast.makeText(this, "Không có văn bản trong Clipboard", Toast.LENGTH_SHORT).show();
            return;
        }
        CharSequence text = clip.getItemAt(0).coerceToText(this);
        if (text == null || text.length() == 0) {
            Toast.makeText(this, "Clipboard không chứa văn bản", Toast.LENGTH_SHORT).show();
            return;
        }
        String pasted = text.toString().replace("\r\n", "\n").replace("\r", "\n");
        contentInput.setText(pasted);

        if (titleInput.getText().toString().trim().isEmpty()) {
            String firstLine = pasted.split("\n")[0].trim();
            if (firstLine.length() > 48) firstLine = firstLine.substring(0, 48).trim();
            if (!firstLine.isEmpty()) titleInput.setText(firstLine);
        }
        Toast.makeText(this, "Đã dán " + pasted.length() + " ký tự!", Toast.LENGTH_SHORT).show();
    }

    private void pickTextFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/*");
        startActivityForResult(intent, REQ_PICK_TXT_FILE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_TXT_FILE && resultCode == RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) readTextFromUri(uri);
        }
    }

    private void readTextFromUri(Uri uri) {
        try {
            String fileName = "";
            Cursor cursor = getContentResolver().query(uri, null, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (idx >= 0) fileName = cursor.getString(idx);
                    }
                } finally {
                    cursor.close();
                }
            }

            InputStream is = getContentResolver().openInputStream(uri);
            if (is == null) return;
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (!first) sb.append("\n");
                if (first && line.startsWith("\uFEFF")) line = line.substring(1);
                sb.append(line);
                first = false;
            }
            reader.close();

            if (!fileName.isEmpty()) {
                int dot = fileName.lastIndexOf('.');
                if (dot > 0) fileName = fileName.substring(0, dot);
                titleInput.setText(fileName);
            }
            contentInput.setText(sb.toString());
            Toast.makeText(this, "Đã nạp file (" + sb.length() + " ký tự)", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Lỗi đọc file: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void saveDraft() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_DRAFT_TITLE, titleInput.getText().toString())
                .putString(KEY_DRAFT_CONTENT, contentInput.getText().toString())
                .apply();
    }

    private void restoreDraft() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String t = prefs.getString(KEY_DRAFT_TITLE, "");
        String c = prefs.getString(KEY_DRAFT_CONTENT, "");
        if (t != null && !t.isEmpty()) titleInput.setText(t);
        if (c != null && !c.isEmpty()) contentInput.setText(c);
    }

    private void saveNoteToHistory(String title, String content) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String raw = prefs.getString(KEY_HISTORY_JSON, "[]");
            JSONArray arr = new JSONArray(raw);

            JSONArray nextArr = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("title", title);
            item.put("content", content);
            item.put("time", new SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(new Date()));
            nextArr.put(item);

            for (int i = 0; i < arr.length() && nextArr.length() < 10; i++) {
                JSONObject old = arr.optJSONObject(i);
                if (old == null) continue;
                if (title.equals(old.optString("title")) && content.equals(old.optString("content"))) continue;
                nextArr.put(old);
            }

            prefs.edit().putString(KEY_HISTORY_JSON, nextArr.toString()).apply();
            renderHistoryList();
        } catch (Exception ignored) {}
    }

    private void renderHistoryList() {
        if (historyContainer == null) return;
        historyContainer.removeAllViews();

        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(KEY_HISTORY_JSON, "[]"));
            if (arr.length() == 0) {
                TextView empty = new TextView(this);
                empty.setText("Chưa có lịch sử ghi chú nào trên điện thoại.");
                empty.setTextColor(Color.parseColor("#6C7A89"));
                empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                historyContainer.addView(empty);
                return;
            }

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj == null) continue;
                final String t = obj.optString("title", "Ghi chú");
                final String c = obj.optString("content", "");
                String time = obj.optString("time", "");

                LinearLayout row = createCard("#0B1018", "#1F2D3D");
                LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                rowLp.bottomMargin = dp(8);

                TextView itemTitle = new TextView(this);
                itemTitle.setText(t + "  (" + time + " • " + c.length() + " ký tự)");
                itemTitle.setTextColor(Color.parseColor("#72B7FF"));
                itemTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
                itemTitle.setTypeface(Typeface.DEFAULT_BOLD);
                row.addView(itemTitle);

                String preview = c.replace("\n", " ").trim();
                if (preview.length() > 90) preview = preview.substring(0, 90) + "...";
                TextView itemPreview = new TextView(this);
                itemPreview.setText(preview);
                itemPreview.setTextColor(Color.parseColor("#9BAEC2"));
                itemPreview.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                itemPreview.setPadding(0, dp(3), 0, dp(6));
                row.addView(itemPreview);

                Button loadBtn = createActionButton("Nạp lại vào ô soạn thảo", "#182B42", "#82C0FF");
                loadBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        titleInput.setText(t);
                        contentInput.setText(c);
                        Toast.makeText(MainActivity.this, "Đã nạp: " + t, Toast.LENGTH_SHORT).show();
                    }
                });
                row.addView(loadBtn, new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(36)));

                historyContainer.addView(row, rowLp);
            }
        } catch (Exception ignored) {}
    }

    private LinearLayout createCard(String bgHex, String borderHex) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(createRoundedRect(bgHex, borderHex, dp(14)));
        int p = dp(14);
        card.setPadding(p, p, p, p);
        return card;
    }

    private TextView createSectionLabel(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(Color.parseColor("#8CA0B8"));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setPadding(0, 0, 0, dp(6));
        return tv;
    }

    private Button createActionButton(String text, String bgHex, String fgHex) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextColor(Color.parseColor(fgHex));
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(createRoundedRect(bgHex, "#2B3B4E", dp(8)));
        b.setPadding(dp(8), 0, dp(8), 0);
        return b;
    }

    private GradientDrawable createRoundedRect(String bgHex, String strokeHex, int radiusPx) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor(bgHex));
        gd.setCornerRadius(radiusPx);
        gd.setStroke(dp(1), Color.parseColor(strokeHex));
        return gd;
    }

    private LinearLayout.LayoutParams marginBottom(int bottomPx) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = bottomPx;
        return lp;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    @Override
    protected void onDestroy() {
        localServerRunning = false;
        if (localServerSocket != null) {
            try { localServerSocket.close(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
