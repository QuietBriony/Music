import { VERSION, CIRCUIT_HASH, CIRCUIT_BYTES, DURATION, SEED, MAX_ROUNDS,
  prepareCircuit, motorTrace, firstBatch, nextBatch, compose, summarize, clamp } from "./model.mjs";
import { Player } from "./audio.mjs";

const $ = (id) => document.getElementById(id);
let circuit, batch = [], scores = new Map(), feedback = null, history = [];
let heard = {}, progress = {}, mode = "circuit", busy = true, buildToken = 0;
let progressId = null, previousSeconds = 0;
const cards = new Map();
function status(message, error = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(error);
}
const player = new Player((event) => {
  if (event.type === "start") { progressId = event.id; previousSeconds = 0; }
  if (["progress", "stop"].includes(event.type) && event.id) {
    const seconds = Math.min(DURATION, event.seconds || 0);
    if (event.id === progressId && seconds >= previousSeconds) {
      if (player.volume > 0) heard[event.id] = Math.min(DURATION, (heard[event.id] || 0) + seconds - previousSeconds);
      previousSeconds = seconds;
    }
    progress[event.id] = seconds;
    const card = cards.get(event.id);
    if (card) {
      card.progress.value = seconds;
      card.time.textContent = `${Math.floor(seconds).toString().padStart(2, "0")} / 20`;
    }
  }
  if (event.type === "loading") status("音を準備しています。初回だけ少し時間がかかります…");
  if (event.type === "start") status(`${batch.find((c) => c.id === event.id)?.letter || ""} を再生中。途中でも停止・切り替えできます。`);
  if (event.type === "stop") {
    progressId = null;
    if (event.reason === "ended") status("20秒の再生が終わりました。好みを選ぶか、ほかの案も聴いてみてください。");
    if (event.reason === "stop") status("停止しました。もう一度押すと、同じ案を最初から再生します。");
    if (["hidden", "interrupted"].includes(event.reason)) status("再生を停止しました。戻ったら再生ボタンを押してください。");
  }
  controls();
}, () => {
  status("音を開始できませんでした。通信・消音設定を確認して、もう一度再生してください。アプリ内で鳴らない時はSafari / Chromeで開いてください。", true);
  controls();
});

function controls() {
  const playing = player.active?.id, pending = player.pending;
  for (const c of batch) {
    const card = cards.get(c.id);
    if (!card) continue;
    card.root.classList.toggle("playing", playing === c.id);
    card.play.disabled = busy;
    card.play.textContent = pending === c.id ? `■ ${c.letter} の準備を中止` : playing === c.id ? `■ ${c.letter} を停止` : `▶ ${c.letter} を聴く`;
    card.play.setAttribute("aria-pressed", String(playing === c.id));
    card.like.disabled = busy || (heard[c.id] || 0) < 5;
    card.like.setAttribute("aria-pressed", String(feedback?.kind === "like" && feedback.candidateId === c.id));
    const eligible = (heard[c.id] || 0) >= 5;
    card.hint.textContent = eligible ? "評価できます · 何度でも聴き直せます" : "5秒以上再生すると、この案を選べます";
  }
  const compared = batch.filter((c) => (heard[c.id] || 0) >= 5).length >= 2;
  for (const kind of ["monotonous", "unclear"]) {
    $(kind).disabled = busy || !compared;
    $(kind).setAttribute("aria-pressed", String(feedback?.kind === kind));
  }
  $("feedback-hint").textContent = compared ? "好きな案がなくても、その感想から次を変えられます。" : "2案をそれぞれ5秒以上再生すると選べます。";
  $("stop").disabled = !playing && !pending;
  $("condition").disabled = busy;
  $("reset").disabled = busy;
  $("export").disabled = busy || !batch.length;
  $("next").disabled = busy || !feedback || batch[0]?.round >= MAX_ROUNDS;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function render() {
  $("candidates").replaceChildren();
  cards.clear();
  for (const c of batch) {
    const root = element("article", "card");
    root.dataset.letter = c.letter;
    root.setAttribute("aria-labelledby", `${c.id}-title`);
    const top = element("div", "card-top");
    top.append(element("span", "letter", c.letter), element("span", "length", "20 SEC"));
    const title = element("h2", "", c.title); title.id = `${c.id}-title`;
    const strip = element("div", "score-strip");
    strip.setAttribute("role", "img");
    strip.setAttribute("aria-label", "8小節の発音密度。途中で減らして、最後に戻ります。");
    const counts = Array.from({ length: 8 }, (_, i) => scores.get(c.id).events.filter((e) => Math.floor(e.time / 2.5) === i).length);
    for (const count of counts) {
      const bar = element("span"); bar.style.height = `${22 + count * 3}%`;
      strip.append(bar);
    }
    const play = element("button", "play"); play.type = "button";
    play.onclick = () => {
      if (player.active?.id === c.id || player.pending === c.id) player.stop();
      else void player.play(scores.get(c.id));
    };
    const line = element("div", "progress-line");
    const meter = element("progress"); meter.max = DURATION; meter.value = 0;
    meter.setAttribute("aria-label", `${c.letter} の再生位置`);
    const time = element("span", "time", "00 / 20"); line.append(meter, time);
    const like = element("button", "like", "これを育てる"); like.type = "button";
    like.setAttribute("aria-label", `${c.letter} を育てる`);
    like.onclick = () => choose({ kind: "like", candidateId: c.id });
    const hint = element("p", "listen-hint");
    root.append(top, title, element("p", "description", c.description), strip, play, line, like, hint);
    $("candidates").append(root);
    cards.set(c.id, { root, play, like, progress: meter, time, hint });
  }
  $("round").textContent = `ROUND ${String(batch[0].round).padStart(2, "0")} / ${MAX_ROUNDS}`;
  $("next").replaceChildren(document.createTextNode(batch[0].round >= MAX_ROUNDS ? "12ラウンド完了 · メモを保存できます" : "評価を選んで、次の3案へ"));
  controls();
}
function choose(value) {
  if (busy) return;
  if (value.kind === "like" && (heard[value.candidateId] || 0) < 5) return;
  if (value.kind !== "like" && batch.filter((c) => (heard[c.id] || 0) >= 5).length < 2) return;
  feedback = value;
  const label = value.kind === "like" ? `${batch.find((c) => c.id === value.candidateId).letter} の方向を残します。` :
    value.kind === "monotonous" ? "音量は上げず、休符と切り返しを変えます。" : "和音・ビート・余白の差を広げます。";
  status(`${label} 「次の3案へ」を押してください。`);
  if (batch[0].round < MAX_ROUNDS) $("next").textContent = "次の3案を作る ↗";
  controls();
}
async function build(proposed) {
  const token = ++buildToken;
  busy = true; player.stop("build"); controls();
  status("次の3案を組み立てています…");
  const compiled = new Map();
  try {
    for (const c of proposed) {
      // Yield between finite simulations; no simulation on the audio callback.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token !== buildToken) return;
      compiled.set(c.id, compose(c, motorTrace(circuit, c.seed, mode)));
    }
    batch = proposed; scores = compiled; feedback = null; heard = {}; progress = {};
    busy = false; render();
    $("retry").hidden = true;
    status(mode === "circuit" ? "準備できました。A・B・C を聴いてみてください。" : "比較用の回路なし条件です。A・B・C を聴いてみてください。");
  } catch {
    busy = true; controls();
    status("3案を準備できませんでした。読み込みをやり直してください。", true);
    $("retry").hidden = false;
  }
}
async function initialize() {
  busy = true; controls(); $("retry").hidden = true;
  status("回路データを確認しています…");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL("./circuit.json", import.meta.url), { signal: controller.signal });
    if (!response.ok) throw new Error("Circuit unavailable");
    const data = await response.arrayBuffer();
    if (data.byteLength !== CIRCUIT_BYTES) throw new Error("Circuit size mismatch");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (n) => n.toString(16).padStart(2, "0")).join("");
    if (hash !== CIRCUIT_HASH) throw new Error("Circuit integrity mismatch");
    circuit = prepareCircuit(JSON.parse(new TextDecoder().decode(data)));
    history = [];
    await build(firstBatch());
  } catch {
    status("回路データを読み込めませんでした。通信を確認し、HTTPSの公開ページかローカルのプレビューから開いて、やり直してください。", true);
    $("retry").hidden = false;
  } finally { clearTimeout(timeout); }
}
function record() {
  return { round: batch[0]?.round, condition: mode, candidates: batch.map((c) => ({
    ...c, playedSeconds: +clamp(heard[c.id] || 0, 0, DURATION).toFixed(2), scoreSummary: summarize(scores.get(c.id))
  })), feedback: feedback ? { ...feedback } : null };
}
$("next").onclick = async () => {
  if (busy || !feedback || batch[0].round >= MAX_ROUNDS) return;
  player.stop("next");
  const proposed = nextBatch(batch, feedback);
  history.push(record());
  await build(proposed);
  const first = cards.values().next().value;
  first?.play.focus({ preventScroll: true });
  $("round").scrollIntoView({ block: "start" });
};
for (const kind of ["monotonous", "unclear"]) $(kind).onclick = () => choose({ kind });
$("stop").onclick = () => player.stop();
$("volume").oninput = () => {
  player.setVolume(Number($("volume").value) / 100);
  $("volume-value").value = `${Math.round(player.volume * 100)}%`;
};
$("retry").onclick = () => void initialize();
async function restart(nextMode) {
  if (history.length || feedback || Object.values(heard).some((n) => n >= 5)) {
    if (!window.confirm("今の評価メモを消して、ラウンド1に戻りますか？ 残す場合は先に「実験メモを保存」を押してください。")) {
      $("condition").value = mode; return;
    }
  }
  mode = nextMode; history = [];
  await build(firstBatch());
}
$("condition").onchange = () => void restart($("condition").value);
$("reset").onclick = () => void restart(mode);
$("export").onclick = () => {
  if (busy || !batch.length) return;
  const packet = { schemaVersion: 1, experiment: VERSION, seed: SEED, circuitSha256: CIRCUIT_HASH,
    strategy: "bounded-preference-search-v1", integrationMode: "manual-review-only", humanReviewRequired: true,
    note: "Played seconds are browser observations, not proof of hearing or audio quality. No code or circuit learning, no automatic RSI integration.",
    rounds: [...history, record()] };
  const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" }));
  const link = element("a"); link.href = url; link.download = `music-listening-loop-${mode}-r${batch[0].round}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  status("メモの保存を開始しました。外部への送信はしていません。");
};
document.addEventListener("visibilitychange", () => { if (document.hidden) void player.close(); });
window.addEventListener("pagehide", () => { void player.close(); });
// Read-only diagnostic snapshot, not an automation or cross-app control API.
Object.defineProperty(window, "ListeningLoopDiagnostics", { value: Object.freeze({ snapshot: () => ({
  version: VERSION, ready: !busy, condition: mode, round: batch[0]?.round || 0,
  audio: player.snapshot(), candidates: batch.map((c) => ({ id: c.id, params: { ...c.params },
    playedSeconds: heard[c.id] || 0, summary: scores.has(c.id) ? summarize(scores.get(c.id)) : null })),
  feedback: feedback ? { ...feedback } : null, completedRounds: history.length
}) }) });
void initialize();
