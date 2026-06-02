/* =========================================================
   Audio Safety Net — for old iOS Safari / quirky browsers

   3 つのことをやる:
   1. user gesture ごとに Tone.start() を呼んで AudioContext を unlock
      (古い iOS Safari は最初の 1 回で確実に unlock できない場合がある)
   2. iOS 14 以下を検出して「音出ない可能性」warning banner 表示
   3. window.onerror で JS エラーを画面下に overlay 表示
      (友人が devtool 開けないので、画面で診断情報を見えるように)

   3 app (band-room / fm / index) が <script src="audio/audio-safety.js"> で
   include する。Tone.js より後にロードする必要あり。
========================================================= */

(function () {
  "use strict";

  // ---- 1. iOS version detection + warning ----
  const ua = navigator.userAgent || "";
  const iosMatch = ua.match(/OS (\d+)[_.](\d+)/);
  let iosMajor = null;
  if (iosMatch && /iPhone|iPad|iPod/.test(ua)) {
    iosMajor = parseInt(iosMatch[1], 10);
  }

  function showVersionWarning() {
    if (!iosMajor || iosMajor >= 15) return;
    const banner = document.createElement("div");
    banner.id = "audio-ios-warning";
    banner.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0",
      "z-index:9999",
      "background:rgba(180,40,55,0.92)",
      "color:#fff",
      "padding:10px 14px",
      "font-size:12px",
      "line-height:1.4",
      "text-align:center",
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif",
      "backdrop-filter:blur(8px)",
      "-webkit-backdrop-filter:blur(8px)",
      "box-shadow:0 2px 8px rgba(0,0,0,0.3)"
    ].join(";");
    banner.innerHTML =
      "⚠ iOS " + iosMajor + " 検出 — Web Audio が動かない可能性。<br>" +
      "<strong>iOS 15 以上 (Safari 15+) を推奨</strong>。設定 → 一般 → 情報 → " +
      "ソフトウェアアップデートをお試しください。" +
      "<button id='audio-ios-warning-close' style='margin-left:10px;background:#fff;color:#a33;border:0;padding:4px 10px;border-radius:99px;font-weight:600;font-size:11px;cursor:pointer'>了解</button>";
    document.body.appendChild(banner);
    const closeBtn = document.getElementById("audio-ios-warning-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => banner.remove());
    }
  }

  // ---- 2. user gesture audio unlock ----
  // 古い iOS Safari は時々最初の Tone.start() で unlock 失敗する。
  // どんな user interaction でも Tone.start() を試みる。
  let unlockAttempts = 0;
  function tryUnlock() {
    if (unlockAttempts > 12) return; // 12 回試して諦め
    if (typeof Tone === "undefined") return;
    try {
      const ctxObj = (typeof Tone.getContext === "function") ? Tone.getContext() : Tone.context;
      const raw = ctxObj && (ctxObj.rawContext || ctxObj._context || ctxObj);
      // resume the raw AudioContext directly (works in all iOS)
      if (raw && typeof raw.resume === "function" && raw.state !== "running") {
        raw.resume().catch(() => {});
      }
      // also run Tone.start() (no-op if already started)
      if (typeof Tone.start === "function") {
        Tone.start().catch(() => {});
      }
      unlockAttempts++;
    } catch (e) {
      // silently ignore
    }
  }

  function bindUnlockListeners() {
    const events = ["touchstart", "touchend", "mousedown", "click", "keydown"];
    events.forEach((ev) => {
      document.addEventListener(ev, tryUnlock, { capture: true, passive: true });
    });
  }

  // ---- 3. on-screen error overlay (for friends without devtool) ----
  let errOverlay = null;
  function ensureErrOverlay() {
    if (errOverlay) return errOverlay;
    errOverlay = document.createElement("div");
    errOverlay.id = "audio-error-overlay";
    errOverlay.style.cssText = [
      "position:fixed", "bottom:0", "left:0", "right:0",
      "z-index:9998",
      "background:rgba(0,0,0,0.86)",
      "color:#ffb39a",
      "font-family:ui-monospace,Menlo,monospace",
      "font-size:10px",
      "line-height:1.4",
      "padding:6px 36px 6px 10px",
      "max-height:30vh",
      "overflow-y:auto",
      "border-top:1px solid rgba(255,184,122,0.4)",
      "white-space:pre-wrap",
      "word-break:break-word"
    ].join(";");
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "dismiss errors");
    close.style.cssText = "position:absolute;top:4px;right:6px;background:transparent;border:0;color:#ffb39a;font-size:18px;cursor:pointer;padding:0 6px;line-height:1";
    close.addEventListener("click", () => { errOverlay.remove(); errOverlay = null; });
    errOverlay.appendChild(close);
    document.body.appendChild(errOverlay);
    return errOverlay;
  }

  function logErr(label, info) {
    try {
      const div = ensureErrOverlay();
      const line = document.createElement("div");
      line.textContent = "[" + label + "] " + info;
      div.appendChild(line);
    } catch (e) {}
  }

  window.addEventListener("error", (e) => {
    const msg = (e.message || (e.error && e.error.message) || "?");
    const loc = (e.filename || "?") + ":" + (e.lineno || "?");
    logErr("err", msg + " @ " + loc);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e.reason && (e.reason.message || e.reason.toString())) || "?";
    if (/failed to connect to metamask/i.test(reason)) return;
    logErr("promise", reason);
  });

  // ---- bootstrap ----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      showVersionWarning();
      bindUnlockListeners();
    });
  } else {
    showVersionWarning();
    bindUnlockListeners();
  }
})();
