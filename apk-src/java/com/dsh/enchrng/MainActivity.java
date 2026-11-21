package com.dsh.enchrng;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
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
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
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
