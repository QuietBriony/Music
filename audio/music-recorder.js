/* Music Recorder - extracted from engine.js (BL-008). Local MediaRecorder capture for the FM "REC" button. Published as window.MusicRecorder. */
(function () {
  const RecorderState = {
    recorder: null,
    chunks: [],
    startedAt: 0,
    objectUrl: null,
    mimeType: "",
    maxMs: 30000,
    stopTimer: null
  };

  function getRecorderMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const ua = nav.userAgent || "";
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    const mp4First = [
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/webm;codecs=opus",
      "audio/webm"
    ];
    const webmFirst = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2"
    ];
    const candidates = isAppleMobile ? mp4First : webmFirst;
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
  }

  function getRecorderExtension(mimeType) {
    return mimeType.includes("mp4") ? "m4a" : "webm";
  }

  function getRecorderSavedMessage(mimeType, sizeKb) {
    if (mimeType.includes("mp4")) {
      return `Recorded ${sizeKb} KB as m4a-compatible audio`;
    }
    if (mimeType.includes("webm")) {
      return `WebM saved ${sizeKb} KB. iPhone app may reject; use PC/convert to m4a.`;
    }
    return `Recorded ${sizeKb} KB`;
  }

  function getRecorderFallbackMessage() {
    return "Recorder unavailable on this browser";
  }

  function getRecorderStartMessage(mimeType) {
    if (mimeType.includes("mp4")) return "Recording Music output as m4a-compatible audio...";
    if (mimeType.includes("webm")) return "Recording WebM audio; iPhone upload may need conversion...";
    return "Recording Music output...";
  }

  function getRecorderDefaultMimeType() {
    if (RecorderState.mimeType) return RecorderState.mimeType;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"
    ];
    return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) || "audio/webm";
  }

  function setRecorderStatus(message) {
    const statusText = document.getElementById("status-text");
    if (statusText) statusText.textContent = message;
  }

  function setRecorderButton(recording) {
    const btn = document.getElementById("btn_rec");
    if (btn) btn.textContent = recording ? "STOP REC" : "REC";
    if (document.body) document.body.dataset.recording = recording ? "true" : "false";
  }

  function cleanupRecorderObjectUrl() {
    if (!RecorderState.objectUrl) return;
    try { URL.revokeObjectURL(RecorderState.objectUrl); } catch(e) {}
    RecorderState.objectUrl = null;
  }

  function makeReviewFileName(extension = "webm") {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `music-review-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
  }

  function startLocalRecorder() {
    const link = document.getElementById("rec_download");
    if (link) link.hidden = true;

    if (typeof MediaRecorder === "undefined" || !recorderDestination?.stream) {
      setRecorderStatus(getRecorderFallbackMessage());
      return;
    }
    if (RecorderState.recorder && RecorderState.recorder.state === "recording") return;

    cleanupRecorderObjectUrl();
    RecorderState.chunks = [];
    RecorderState.mimeType = getRecorderMimeType();

    try {
      RecorderState.recorder = RecorderState.mimeType
        ? new MediaRecorder(recorderDestination.stream, { mimeType: RecorderState.mimeType })
        : new MediaRecorder(recorderDestination.stream);
    } catch (error) {
      console.warn("[Music] recorder start failed:", error);
      setRecorderStatus(getRecorderFallbackMessage());
      RecorderState.recorder = null;
      return;
    }

    RecorderState.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) RecorderState.chunks.push(event.data);
    };
    RecorderState.recorder.onerror = (event) => {
      console.warn("[Music] recorder error:", event.error || event);
      stopLocalRecorder();
      setRecorderStatus("Recorder stopped");
    };
    RecorderState.recorder.onstop = () => {
      const mimeType = getRecorderDefaultMimeType();
      const blob = new Blob(RecorderState.chunks, { type: mimeType });
      const extension = getRecorderExtension(mimeType);
      RecorderState.chunks = [];
      RecorderState.recorder = null;
      setRecorderButton(false);
      if (!blob.size) {
        setRecorderStatus("No recording captured");
        return;
      }
      RecorderState.objectUrl = URL.createObjectURL(blob);
      const download = document.getElementById("rec_download");
      if (download) {
        download.href = RecorderState.objectUrl;
        download.download = makeReviewFileName(extension);
        download.textContent = "save";
        download.hidden = false;
      }
      setRecorderStatus(getRecorderSavedMessage(mimeType, Math.round(blob.size / 1024)));
    };

    try {
      RecorderState.recorder.start(1000);
      RecorderState.startedAt = Date.now();
      setRecorderButton(true);
      setRecorderStatus(getRecorderStartMessage(RecorderState.mimeType));
      clearTimeout(RecorderState.stopTimer);
      RecorderState.stopTimer = setTimeout(() => stopLocalRecorder(), RecorderState.maxMs);
    } catch (error) {
      console.warn("[Music] recorder start failed:", error);
      setRecorderButton(false);
      setRecorderStatus(getRecorderFallbackMessage());
    }
  }

  function stopLocalRecorder() {
    clearTimeout(RecorderState.stopTimer);
    RecorderState.stopTimer = null;
    const recorder = RecorderState.recorder;
    if (!recorder) {
      setRecorderButton(false);
      return;
    }
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch (error) {
      console.warn("[Music] recorder stop failed:", error);
      RecorderState.recorder = null;
      setRecorderButton(false);
      setRecorderStatus("Recorder stopped");
    }
  }

  function toggleLocalRecorder() {
    if (RecorderState.recorder && RecorderState.recorder.state === "recording") {
      stopLocalRecorder();
    } else {
      startLocalRecorder();
    }
  }

  if (typeof window !== "undefined") {
    window.MusicRecorder = {
      state: RecorderState,
      toggle: toggleLocalRecorder,
      start: startLocalRecorder,
      stop: stopLocalRecorder
    };
  }
})();
