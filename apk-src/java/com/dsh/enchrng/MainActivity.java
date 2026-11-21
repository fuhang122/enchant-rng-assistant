package com.dsh.enchrng;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.net.Uri;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private static final int FLAG_LIGHT_STATUS = 0x00002000;  // API 23
    private static final int FLAG_LIGHT_NAV    = 0x00000010;  // API 26
    private static final int COLOR_DARK_BG  = 0xFF101319;
    private static final int COLOR_LIGHT_BG = 0xFFF3F5FA;

    private WebView web;
    private boolean dark = true;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setDefaultTextEncodingName("utf-8");
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "AndroidHost");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String msg, final android.webkit.JsResult r) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setMessage(msg).setPositiveButton("好", new android.content.DialogInterface.OnClickListener() {
                        public void onClick(android.content.DialogInterface d, int w) { r.confirm(); }
                    }).setCancelable(false).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, final android.webkit.JsResult r) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setMessage(msg)
                    .setPositiveButton("去下载", new android.content.DialogInterface.OnClickListener() {
                        public void onClick(android.content.DialogInterface d, int w) { r.confirm(); }
                    })
                    .setNegativeButton("取消", new android.content.DialogInterface.OnClickListener() {
                        public void onClick(android.content.DialogInterface d, int w) { r.cancel(); }
                    }).setCancelable(false).show();
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                pushInsets();
                pushTheme();
            }
        });

        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl("file:///android_asset/index.html");
        applyBars();
    }

    /* ---------- 与网页通信 ---------- */

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
            "(function(){try{return (window.__back&&window.__back())?1:0;}catch(e){return 0;}})()",
            new ValueCallback<String>() {
                @Override public void onReceiveValue(String value) {
                    if ("0".equals(value) || value == null) finish();
                }
            });
    }

    private class Bridge {

        /* 检查更新：多个镜像依次尝试，结果回传给页面 */
        @JavascriptInterface
        public void checkUpdate() {
            new Thread(new Runnable() {
                @Override public void run() {
                    final String[] urls = {
                        "https://cdn.jsdelivr.net/gh/fuhang122/enchant-rng-assistant@main/version.json",
                        "https://ghfast.top/https://raw.githubusercontent.com/fuhang122/enchant-rng-assistant/main/version.json",
                        "https://raw.githubusercontent.com/fuhang122/enchant-rng-assistant/main/version.json"
                    };
                    String body = null, err = null;
                    for (String u : urls) {
                        try {
                            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
                            c.setConnectTimeout(4000);
                            c.setReadTimeout(6000);
                            c.setRequestProperty("User-Agent", "enchrng-android");
                            int code = c.getResponseCode();
                            if (code == 200) {
                                InputStream in = c.getInputStream();
                                BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"));
                                StringBuilder sb = new StringBuilder();
                                String line;
                                while ((line = br.readLine()) != null) sb.append(line).append('\n');
                                br.close();
                                body = sb.toString();
                                break;
                            }
                            err = "HTTP " + code;
                        } catch (Exception e) {
                            err = e.getClass().getSimpleName();
                        }
                    }
                    final String b = body, e = err;
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            try {
                                web.evaluateJavascript(
                                    "window.__onUpdateInfo && window.__onUpdateInfo("
                                    + org.json.JSONObject.quote(b) + ","
                                    + org.json.JSONObject.quote(e) + ")", null);
                            } catch (Exception ignored) {}
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public int versionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }
        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override public void run() { finish(); }
            });
        }

        @JavascriptInterface
        public void setTheme(boolean light) {
            final boolean d = !light;
            runOnUiThread(new Runnable() {
                @Override public void run() { dark = d; applyBars(); }
            });
        }
        @JavascriptInterface
        public void copy(final String s) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        android.content.ClipboardManager cm =
                            (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                        cm.setPrimaryClip(android.content.ClipData.newPlainText("seed", s));
                    } catch (Throwable t) { }
                }
            });
        }
        @JavascriptInterface
        public void ready() {
            runOnUiThread(new Runnable() {
                @Override public void run() { applyBars(); pushInsets(); pushTheme(); }
            });
        }
    }

    /* ---------- 沉浸式系统栏 ---------- */
    private void applyBars() {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (!dark) flags |= FLAG_LIGHT_STATUS | FLAG_LIGHT_NAV;

        boolean canLightIcons = Build.VERSION.SDK_INT >= 23;
        if (!canLightIcons) flags &= ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;

        getWindow().getDecorView().setSystemUiVisibility(flags);
        getWindow().setStatusBarColor(canLightIcons ? Color.TRANSPARENT : COLOR_DARK_BG);
        getWindow().setNavigationBarColor(
                Build.VERSION.SDK_INT >= 29 ? Color.TRANSPARENT
                        : (dark ? Color.TRANSPARENT : 0x99000000));
        getWindow().setBackgroundDrawable(new ColorDrawable(dark ? COLOR_DARK_BG : COLOR_LIGHT_BG));
    }

    /* ---------- 把状态栏/手势条高度交给网页 ---------- */
    private void pushInsets() {
        if (web == null) return;
        int top = 0, bottom = 0;
        if (Build.VERSION.SDK_INT >= 23) {
            WindowInsets wi = web.getRootWindowInsets();
            if (wi != null) {
                top = wi.getSystemWindowInsetTop();
                bottom = wi.getSystemWindowInsetBottom();
            }
        }
        final int t = top, b = bottom;
        web.post(new Runnable() {
            @Override public void run() {
                if (web == null) return;
                web.evaluateJavascript(
                    "(function(){var r=document.documentElement.style;"
                  + "r.setProperty('--sat','" + t + "px');"
                  + "r.setProperty('--sab','" + b + "px');})()", null);
            }
        });
    }

    private void pushTheme() {
        if (web == null) return;
        final boolean light = !dark;
        web.post(new Runnable() {
            @Override public void run() {
                if (web == null) return;
                web.evaluateJavascript(
                    "(function(){var c='" + (light ? "light" : "dark") + "';"
                  + "if(!document.documentElement.getAttribute('data-theme')){"
                  + "document.documentElement.setAttribute('data-theme',c);}})()", null);
            }
        });
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration cfg) {
        super.onConfigurationChanged(cfg);
        applyBars();
        web.postDelayed(new Runnable() { @Override public void run() { pushInsets(); } }, 300);
    }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
