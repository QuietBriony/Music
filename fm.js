/* =========================================================
   Claude FM mode — single-button focus radio
   Wraps engine.js without modifying it.
   - START / STOP with soft fade in / out
   - Live program label from MusicRuntimeState.radioBrain
   - Resume hint from localStorage (30 min window)
   - iOS Safari gesture-tied audio start
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "music:fm:v1";
  const FADE_IN_S = 4;
  const FADE_OUT_S = 3;
  const RESUME_WINDOW_MS = 30 * 60 * 1000;
  const TARGET_LEVEL = 80;
  const ENERGY_VALUES = { low: 25, mid: 45, high: 70 };

  let started = false;
  let starting = false;
  let stopping = false;
  let rampHandle = null;

  // ---- Helpers --------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchChange(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setButtonState(state) {
    const btn = $("fm_play");
    if (!btn) return;
    btn.dataset.state = state;
    if (state === "playing") {
      btn.textContent = "STOP";
      btn.setAttribute("aria-label", "Stop playback");
    } else if (state === "starting") {
      btn.textContent = "…";
      btn.setAttribute("aria-label", "Starting");
    } else if (state === "stopping") {
      btn.textContent = "…";
      btn.setAttribute("aria-label", "Stopping");
    } else {
      btn.textContent = "START";
      btn.setAttribute("aria-label", "Start playback");
    }
  }

  function rampOutputLevel(target, seconds) {
    const slider = $("output_level");
    if (!slider) return Promise.resolve();
    if (rampHandle) cancelAnimationFrame(rampHandle);

    const start = Number(slider.value) || 0;
    const t0 = performance.now();
    const duration = Math.max(50, seconds * 1000);

    return new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - t0) / duration);
        const eased = t * (2 - t); // easeOutQuad — gentler at the top
        const v = Math.round(start + (target - start) * eased);
        slider.value = String(v);
        dispatchInput(slider);
        if (t < 1) {
          rampHandle = requestAnimationFrame(step);
        } else {
          rampHandle = null;
          resolve();
        }
      }
      rampHandle = requestAnimationFrame(step);
    });
  }

  function applyEnergyValue(name) {
    const slider = $("fader_energy");
    if (!slider) return;
    const v = ENERGY_VALUES[name];
    if (typeof v !== "number") return;
    slider.value = String(v);
    dispatchInput(slider);
  }

  // ---- localStorage --------------------------------------------

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      if (!data.savedAt || Date.now() - data.savedAt > RESUME_WINDOW_MS) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeSession(rb) {
    if (!rb) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        active: rb.active || null,
        next: rb.next || null,
        lastReason: rb.lastReason || null,
        energy: getCurrentEnergy(),
        savedAt: Date.now()
      }));
    } catch (e) {
      // quota / private mode — non-fatal
    }
  }

  function clearResumeHint() {
    const node = $("fm-resume");
    if (node) node.hidden = true;
  }

  function showResumeHint(data) {
    const node = $("fm-resume");
    if (!node || !data || !data.active) return;
    node.hidden = false;
    node.textContent = `resume from ${data.active}`;
  }

  function getCurrentEnergy() {
    const pressed = document.querySelector('#fm-energy button[aria-pressed="true"]');
    return pressed ? pressed.dataset.energy : "mid";
  }

  // ---- Runtime state subscription ------------------------------

  function onRuntimeState(event) {
    const detail = event.detail || (typeof window !== "undefined" ? window.MusicRuntimeState : null);
    const rb = detail && detail.radioBrain;
    if (!rb) return;

    const now = $("fm-now");
    const next = $("fm-next");
    if (now) {
      const reason = rb.lastReason ? ` — ${rb.lastReason}` : "";
      now.textContent = `${rb.active || "—"}${reason}`;
    }
    if (next) {
      next.textContent = `up next: ${rb.next || "—"}`;
    }

    if (started) writeSession(rb);
  }

  // ---- START / STOP --------------------------------------------

  async function fmStart() {
    if (started || starting) return;
    starting = true;
    setButtonState("starting");
    clearResumeHint();

    try {
      // Gesture-tied AudioContext start (iOS Safari requirement).
      if (typeof Tone !== "undefined" && Tone.start) {
        await Tone.start();
      }

      // Reset master to silent so engine's restoreMasterLevel snaps to 0,
      // then fm.js ramps it up audibly.
      const out = $("output_level");
      if (out) {
        out.value = "1"; // not exactly 0 to avoid -Infinity dB / clicks
        dispatchInput(out);
      }

      // Apply current ENERGY pill so the radio brain bias matches user's choice.
      applyEnergyValue(getCurrentEnergy());

      if (typeof window.startPlayback === "function") {
        await window.startPlayback({ source: "fm.start" });
      } else {
        // engine.js failed to load — surface to user.
        const now = $("fm-now");
        if (now) now.textContent = "engine unavailable — reload?";
        starting = false;
        setButtonState("idle");
        return;
      }

      // Audible fade in.
      await rampOutputLevel(TARGET_LEVEL, FADE_IN_S);

      started = true;
      starting = false;
      setButtonState("playing");

      // Try to render whatever runtime state is already published.
      if (window.MusicRuntimeState) {
        onRuntimeState({ detail: window.MusicRuntimeState });
      }
    } catch (err) {
      console.warn("[Claude FM] start failed:", err);
      starting = false;
      setButtonState("idle");
      const now = $("fm-now");
      if (now) now.textContent = "start failed";
    }
  }

  async function fmStop() {
    if (!started || stopping) return;
    stopping = true;
    setButtonState("stopping");

    try {
      await rampOutputLevel(0, FADE_OUT_S);
      if (typeof window.stopPlayback === "function") {
        window.stopPlayback({ source: "fm.stop" });
      }
    } catch (err) {
      console.warn("[Claude FM] stop fade failed:", err);
    } finally {
      started = false;
      stopping = false;
      setButtonState("idle");
    }
  }

  function togglePlay() {
    if (starting || stopping) return;
    if (started) fmStop();
    else fmStart();
  }

  // ---- ENERGY pill ---------------------------------------------

  function bindEnergyPill() {
    const group = $("fm-energy");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-energy]");
      if (!btn) return;
      const name = btn.dataset.energy;
      group.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      applyEnergyValue(name);
    });
  }

  // ---- Visibility / wake handling ------------------------------

  function bindVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!started) return;
      if (typeof Tone !== "undefined") {
        const ctx = Tone.getContext && Tone.getContext().rawContext;
        if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
          ctx.resume().catch(() => {});
        }
      }
    });
  }

  // ---- Boot ----------------------------------------------------

  function boot() {
    const playBtn = $("fm_play");
    if (playBtn) playBtn.addEventListener("click", togglePlay);

    bindEnergyPill();
    bindVisibility();

    window.addEventListener("music-runtime-state", onRuntimeState);

    const resume = readSession();
    if (resume) {
      showResumeHint(resume);
      // Restore last energy choice (visual only; applied on START).
      if (resume.energy && ENERGY_VALUES[resume.energy]) {
        const group = $("fm-energy");
        if (group) {
          group.querySelectorAll("button").forEach((b) => {
            b.setAttribute("aria-pressed", b.dataset.energy === resume.energy ? "true" : "false");
          });
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
