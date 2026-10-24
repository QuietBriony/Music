# Collab: claude code と codex の並列開発プレイブック

2026-10-24 v435: Human Fly Dubを、リズムを保つversionへ組み直す。全体停止と1〜2拍の断片をやめ、ベース／ドラムを土台に声の語尾・ギター・選んだスネアが暗くなるfeedback echoへ応答する。ギターとドラムの帯域、反響の長さ・左右をフレーズで動かし、中盤は2小節のベース＋ドラムを8小節回す。声21・ギター54・スネア45のsource cueをCPUで選定。音源ファイルと曲の長さ・比較位置は保持。cache `hazama-fm-v435` / client `band-room.js?v=br-268` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v434: Human Fly Dubに5つの展開を追加。ベース／ギターの2拍ループ、ギターの1拍ループ、ドラムの2拍ループを既存録音から短く切り出し、ドラム／低音の抜き差し、反響だけの間、最後の1拍の静寂から全員で戻る。約29秒、61秒、127秒、163秒、225秒。音程と曲の長さは変えず、調和と同じ位置で比較。追加音声ファイルはなく、短いコピーだけをRAMへ作る。cache `hazama-fm-v434` / client `band-room.js?v=br-267` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v433: Human FlyのDubを語尾とギターの打点へ合わせる。声6箇所は帯域エネルギーが18 dB以上落ちる位置から引き、ギター7箇所は打点と230 msの胴鳴りを残してから引く。常時echo sendをやめ、選んだ語尾／ストロークだけを反響へ。声は付点8分、ギターは4分で応答し、小さく左右へ返して戻り際は奥へ下げる。ベースとドラムの経路・打点・余韻は保持。cache `hazama-fm-v433` / client `band-room.js?v=br-266` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-24 v432: Human Flyの分離原音から任意のDubミックスを追加。ベースとドラムを保ち、7つの区間で歌とギターを引き、直前のフレーズを暗くなる4回の反響へ送る。調和と同じ位置で比較でき、ミュート・停止・途中移動で古い反響を消す。通常の調和、ライブ原音の補正、AI採譜と音源は維持。cache `hazama-fm-v432` / client `band-room.js?v=br-265` / CSS `band-room.css?v=br-99` / adapter v8。

2026-10-23 v431: AIギターの4曲26打点を、固定の和音から原音に裏付けのある単音リフへ補正。分離otherと分離前原音の異なる周波数解析が一致し、声とベースの漏れを抑える判定も通した候補に限定。実native出力で周波数の一致が悪化した3候補は見送り。打点・強弱・音長・奏法、ベース／ドラム、原曲マスタリングと調和ミックスは保持。途中移動で古いTransportの予約が小節位置を進める競合も修正し、全パートを選んだ譜面時刻から再開する。nativeの停止も先読み待ちを挟まず、音声時計の現在時刻で確定する。cache `hazama-fm-v431` / client `band-room.js?v=br-264` / CSS `band-room.css?v=br-98` / adapter v8。

> 検証経路: 本文の全件検査は通常経路。AGENTSの「Worker JSON handoff 限定経路」と
> [専用定義](WORKER-HANDOFF-GATE.md) の全条件を満たす追跡済み2ファイルだけは、専用回帰試験と実在する独立レビューで置換できる。
> 基点・排他所有・レビュー真正性が未確認なら full gate を要求し、実行できなければ停止する。
> AGENTS・gate・runner・文書自身は対象外。このルール変更PRの例外は別途明示承認が必要。

2026-10-19 v430: AIベースの休符を分離音源と分離前原音の両方へ照合。5曲8音だけ、譜面の音長より後の追加releaseを制限し、バンドが止まる間を保つ。音程・打点・強弱・譜面の保持音長、楽器bankと−3 dB基準は維持。原曲系は7曲21区間で低中域をさらに削る案を比較し、不採用。本人が評価した原音マスタリング／調和ミックスを維持。cache `hazama-fm-v430` / client `band-room.js?v=br-263` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v429: AIベースの前出を−3 dBで抑え、ほぼ無音の分離音源から最低音量へ持ち上げられた短い検出116音を6曲から除外。前後を含むRMS −65 dBFS未満・peak −45 dBFS未満、velocity 0.16以下・長さ0.25秒以下に限定。残す音符の音程・打点・強弱・長い余韻、ギター／ドラム音源は維持。原曲系のv428調和ミックスは保持。HAZAMAは公開済みの試作として専用入口を残し、Tabascoの通常リンクで未完成バンドが表示される条件を修正。正式昇格は行わない。cache `hazama-fm-v429` / client `band-room.js?v=br-262` / CSS `band-room.css?v=br-98` / adapter v8。

2026-10-19 v428: 調和ミックスの共通反射だけを0.65倍（−3.74 dB）へ。7曲28区間で原音・v427・帯域制限案・反射なしの診断案と比較し、追加反射の重なりを控えめにする。直接音、録音済みの余韻、パート間の音量・send比、EQ・反射時刻は保持。gate・圧縮や新しい音源は加えない。cache `hazama-fm-v428` / client `band-room.js?v=br-261` / CSS `band-room.css?v=br-98` / stem mix v3。

2026-10-19 v427: 調和ミックスを分離前原音の28区間と音量を合わせて比較。声の基準を0.86→0.84、2.8 kHzを−0.8→−1.2 dB、全体の3.2 kHz shelfを+0.5→−0.5 dBへ。声のroom sendを0.22→0.18、共通反射は遅い成分を減らして近い反射へ配分。楽器の直接音を遅らせず、圧縮・gate・新しい残響を追加しない。原音ファイル・AI・旧仕上げ・個人のfader設定は保持。cache `hazama-fm-v427` / client `band-room.js?v=br-260` / CSS `band-room.css?v=br-98` / stem mix v2。

2026-10-19 v426: パート別の標準を「調和 · ライブ再ミックス」へ。4音源を従来の曲別boost・EQ・声FXの手前で取り出し、独立した基準音量、声の低域／突出帯域の軽い整理、全パート共通の19–139 msの短い反射でまとめる。新しい圧縮・歪み・長い残響・幅の拡張は加えない。7曲の全長測定で曲別headroomを校正。新しいバランスは80が基準、旧カスタム音量は保存して以前のライブ／厚めで呼び出せる。ライブ原音のv425補正・AI音源・採譜は不変。cache `hazama-fm-v426` / client `band-room.js?v=br-259` / CSS `band-room.css?v=br-98`。

2026-10-19 v425: 分離前の仮ミックス7曲に、26 Hzの低域整理・230 Hzの−1.5 dB・3.2 kHzからの+0.5 dBの軽いライブ補正を追加。圧縮・gate・追加残響・幅の拡張は使わず、原音ファイルを保持する。元の仮ミックスとのA/Bは曲ごとに音量を合わせ、40 msで切替。パート別は歌・ギターほか・ベース・ドラムのminus-oneをワンタップで選べる。分離漏れと元録音の歪みは残り、分離品質の向上を意味しない。cache `hazama-fm-v425` / client `band-room.js?v=br-258` / CSS `band-room.css?v=br-97`。

2026-10-18 v424: AIベースの長い保持音が3秒の音源末尾で途切れる問題を修正。ベースだけ16 kHz／8秒へ延ばし、譜面の音長・自然減衰と次音でのdampingを保つ。53 buffer／15,274,240 bytes、再生node数と128発の上限は維持。原音・採譜イベント・ギター／ドラム音色は保持。分離前原音の終端を7曲の譜面metadataへ結び、ベースのreleaseを録音終端以内に収める。シーク直後の小節処理を確実に起動し、全パートが1小節遅れて鳴るケースも修正。分離前原音も参照し、裏付けの弱い音高変更は不採用。cache `hazama-fm-v424` / client `br-257` / bank v5 / adapter v7。

2026-10-18 v423: 公開環境でCloudflare Pagesの音声Range要求が200の全体応答になることを確認。原音の音声だけを既存の同一Music GitHub Pagesへ向け、206の部分読み込みで途中移動できるようにする。CORSをsrc設定前に有効化し、Web Audioの消音を防ぐ。入口・7音源のbyte内容・共通−2.2 dB・AIの採譜と音色は保持。原音moduleにも版を付け、旧PWA cacheの参照を避ける。cache `hazama-fm-v423` / client `br-256` / CSS `br-96`。

2026-10-18 v422: Tabascoの通常入口を、本人が公開承認した分離前の仮ミックス7曲の直接再生へ変更。M4Aはbyte一致のまま、再生時の共通−2.2 dBだけを加える。単一media elementをストリーム再生し、原音では既存のstem／AIエンジンを起動しない。ライブ原音／パート別／AI再現は同じページの明示リンクで切り替え、停止して開く。HAZAMAと明示的な練習リンクは既存経路。元からのにじみ・録音品質は残る。実iPhoneと本人聴感は未確認。cache `hazama-fm-v422` / client `br-255` / CSS `br-96`。

2026-10-16 v421: 原音ライブのEQ前合流と共有faderを変更。cache tuple更新も、同じ会話での差分再レビュー・最新main同期後の候補／merge後HEADそれぞれの全体gateへ結び付ける。従来v420の検証は新しい音声経路の合格証跡に流用しない。

2026-10-13 v420: 原音otherの帯域エネルギーとspectral fluxを照合し、5曲のギター351打点を約12〜65 ms前へ補正。note-offと強弱を保持し、ベース・ドラムと同じ原音時刻に寄せた。連続ストロークの前後で安定し、CQTとlinear STFTの両方が支持する5和音を追加。従来の和音注釈は補正後の各行へ結び直す。原音・他パート・音源bankは保持。分離漏れと未採譜／曖昧な音は残り、完全再現・聴感合格とはしない。cache `hazama-fm-v420` / client `br-253`。

2026-10-13 v419: 短いTABASCOを200打以上の固定条件で除外していた採譜処理を修正。原音drumsから204打を採用し、うち128打を立ち上がりへ合わせ、10打の弱い同時cymbalを補った。曲の進行に沿うドラム譜を通常ARCBで使用する。AIの開始／seekでは音の予約時刻と再生時計を一致させ、look-ahead分の先走りを修正。ギター・ベースの譜面、音源bank、原音と仕上げは保持。クラス推定・分離漏れと実iPhone聴感は未解決。cache `hazama-fm-v419` / client `br-252`。

2026-10-12: 本人依頼の内蔵オリジナル歌詞1曲だけをAGENTSの公開例外へ記録。編集歌詞・録音の端末内保存と、最終HEADでの検証契約は維持。

2026-10-12 v418: 読み込み中に選んだ原音の「ライブ／厚め」とA/B復元を、その後の保存設定の適用で戻さない。操作しなかった場合は従来どおり保存した仕上げを復元する。v417の音作り・採譜・原音ファイルは保持。

2026-10-12: v417のcurrent marker同期に追従。単一会話での再レビュー、同期後の最終HEADと5 repo状態を結び付ける既存gate契約を維持。

2026-10-12: 現行runtimeはARCBへ新しい3楽器と打点単位の和音補正を採用したv416。cache tupleの更新も、下記の最終HEADに紐づく全体gateとレビューの契約を使う。

Music repo を **claude code (Anthropic) と codex (OpenAI) の両方** で
継続開発するためのガイド。先に [`AGENTS.md`](../AGENTS.md) を読むこと。

---

## なぜ並列開発したいか

- **計算資源が余ってる方を使う** — codex chat で context 詰まったら claude code、claude のセッションが長くなったら codex に振る
- **視点が違う** — claude は repo 全体俯瞰 + UX、codex は narrow な実装 + 各 repo の事情に詳しい
- **片方が止まっても止まらない** — A が編集中でも B が別領域を磨ける
- **共通の整合性ガード** — `node scripts/stack-check.mjs`で5 repoの既存検査を集約し、個別auditだけで完了扱いしない

---

## 役割分担 (おすすめ)

### claude code が得意なこと

- アーキテクチャ全体図 (HAZAMA-FM-ARCHITECTURE.md レベルの文書化)
- UI/UX レイヤー (fm.html / fm.js / fm.css)
- preset 取り込み (sister repo の main から `curl` → `presets/`)
- `audio/genre-flavor.js` の builder 拡張
- 整合性 audit script の保守 + 拡張
- 複数 agent / 複数 repo を跨ぐ orchestration (computer-use 経由で codex 起動も含む)
- ドキュメント (USAGE-*.md / SCHEMA / ARCHITECTURE)
- cache buster discipline
- 軽量な main 直 push 改善 (LEVEL_BY_GENRE 1 行変更等)

### codex が得意なこと

- sister repo (chill / drum-floor / namima) の deep export (recipe / frames / mood の刷新)
- Music 内 `engine.js` への深い拡張 (12k 行を読む人手の補完)
- 特定の narrow なバグ修正 (specific PR で完結する形)
- 既存 PR への自動 review コメント
- repo 横断の review packet 生成 (OpenClaw 等との連携)
- node スクリプト経由の自動検証 (codex はローカル実行が強い)

### 両方とも得意 (どちらが空いてる方でやる)

- preset JSON 値の微調整 (`LEVEL_BY_GENRE` の数値、builder volume 等)
- USAGE / ARCHITECTURE / SCHEMA の磨き
- audit script の拡張
- README link 整理

---

## 並列衝突回避フロー

### 作業前

```bash
git fetch origin --quiet
git pull --ff-only origin main
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 確認
```

直近 commit history を確認:
```bash
git log --oneline -10
```
他 agent の最近 commit が `fm.js` や `audio/genre-flavor.js` を触ってたら、
そのファイル付近を作業する場合は要注意。

### 作業中

- 大きな改修は **feature branch** に切る (`feature/<topic>`)
- 小さい修正は main 直接でも OK (cache bump、LEVEL_BY_GENRE 微調整等)
- 同じファイル領域で衝突しそうな改修は branch + PR で安全に

### 同じHEADの完了証跡

Claude単独・Codex単独・並走・引継ぎのどの入口でも、最新mainの同期と衝突解消を終えてから
`node scripts/stack-check.mjs`を実行する。**終了コード0、FAIL 0 / SKIP 0、0 BAD**が必要。
`--allow-skip`は診断用であり、その0 BADを全通過・完了証拠として扱わない。
個別4checkは原因調査とAGENTSのcommit前検査に使えるが、全体gateの代用にはしない。

記録するのは作業worktreeの絶対path、同期したmainのSHA、候補の`git rev-parse HEAD`、実行コマンド、
終了コードとPASS/FAIL/SKIP、auditの0 BAD / 0 WARN、ログの場所、独立レビューの対象HEADと未解決事項。
5 repoの検査対象もHEADとdirtyの有無を控える。実行後のHEAD・作業差分と対象repoの状態が変わったら証拠は失効する。
rebase・merge・衝突解消・追加commitの後は、古いログを流用せず新しい最終HEADで全体gateと必要レビューを再確認する。
文書検査はこの手順の省略を検出するだけで、実際に検証を実行した証明にはならない。

### 作業後 (commit / push 前)

自分のworktreeだけで作業する。未commit差分はAGENTSのcommit前gateと全体gateを通して、
自分の変更だけを候補commitへまとめる。他担当のdirtyなworktreeでpull/rebase/stashを開始しない。
以下はcleanなfeature branchの候補commitを同期し、**同期後の同じHEAD**を検証してpushするbash記法の例。
既にpush済みのbranchは通常mergeを使い、未公開の自分のcommitだけならrebaseでもよい。強制pushは禁止。
PowerShellでは各コマンドの`$LASTEXITCODE`を確認し、非0ならそこで停止する。

```bash
set -e
git fetch origin --quiet
git merge origin/main
test -z "$(git status --porcelain)"
FINAL_HEAD=$(git rev-parse HEAD)
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 必須
test "$(git rev-parse HEAD)" = "$FINAL_HEAD"
test -z "$(git status --porcelain)"
git push origin HEAD
```

### 衝突したら

自分の候補branchで両者の意図を確認し、難しい判断は保留する。
公開済みbranchのmergeなら解消後の候補commitを作り、「作業後」の全体gateへ戻る。
未公開の自分のbranchのrebaseなら、全衝突を解消してstageし、最後のcontinueを完了してから再検証する。
audit/check-jsの2checkだけでpushしない。例えば最後のrebase continueからの手順は:

```bash
set -e
git rebase --continue
test -z "$(git status --porcelain)"
FINAL_HEAD=$(git rev-parse HEAD)
node scripts/stack-check.mjs
python -X utf8 scripts/audit.py   # 0 BAD / 0 WARN 必須
test "$(git rev-parse HEAD)" = "$FINAL_HEAD"
test -z "$(git status --porcelain)"
git push origin HEAD
```

---

## 「マージして」自然言語パターン (codex 専用)

codexの各taskへ「マージして」と送った場合も、下のagent merge条件と「同じHEADの完了証跡」を確認してから:
```
gh pr merge <PR#> --merge --delete-branch
git switch main
git pull --ff-only origin main
```
が自動実行されて main 同期まで完了する。

claude code はこのパターンを使わず、`gh pr merge` を直接呼ぶか
ローカルから直接 main に push する (gh CLI 認証は user のもの)。

### agent merge が使える条件

- 対象 PR / branch が今回 user から任された作業に属する
- mergeable / clean な状態
- 「作業後」の同期・衝突解消後の最終HEADで`node scripts/stack-check.mjs`が終了コード0、FAIL 0 / SKIP 0、0 BAD
- `--allow-skip`による診断ログを使わず、独立レビューの対象HEADと検証したHEADが一致し、未解決の問題がない
- engine.js を含む場合は差分レビュー済み
- branch deletion は --delete-branch 付き

### 「全mergeで締めて」closeout

user がこの指示を出した turn は、最後に全 repo の open PR / 作業 branch を確認する。
検証済みで今回の作業に属する PR / branch は main へ merge・push し、merged branch を削除する。
古い local-only / upstream gone branch は中身が不明なら混ぜず、final で残件として明示する。

---

## claude code が codex を呼ぶフロー (orchestration)

claude code は **computer-use MCP** 経由で Codex Desktop App を操作可能:

1. `request_access` で ChatGPT / Codex に access 取得
2. `open_application("Codex")` で Codex 起動
3. 適切な project / task に切替 (左サイドバー click)
4. `write_clipboard` で prompt を仕込む
5. compose 欄を click + `ctrl+v` で paste
6. send button を click
7. codex の作業を polling で見守る or 別 task に並行投入

詳細手順は本セッションの conversation 履歴参照
(claude code が computer-use で Codex App を操作した実例多数)。

---

## 想定シナリオ

### シナリオ A: claude 単独運用

Claude単独でも「作業後」と「同じHEADの完了証跡」に従う。同期後の全体gateと必要レビューを通し、
runtimeを変えた場合だけAGENTSのcache buster規則でdeployを同期する。auditだけで完了扱いしない。

### シナリオ B: codex 単独運用

codex chat に「○○を磨いて」と日本語指示。codex が PR まで自走。
「作業後」と「同じHEADの完了証跡」を満たした今回のPRはagentがmergeまで進めてよい。
main同期は自分のcleanなworktreeで行い、HEADが変われば検証・レビューを再確認する。

### シナリオ C: 並列同時開発

- claude code: Music repo の UI 改修 (fm.js + fm.css)
- codex: sister repo の preset 拡張 (chill / drum-floor / namima)
- 互いに干渉しない領域なので衝突なし
- 両担当とも「作業後」と「同じHEADの完了証跡」を満たす。5 repoの対象状態が変われば全体gateを再実行する

### シナリオ D: claude が codex を呼ぶ (今回のセッションの実例)

- ユーザー: 「○○磨いて」
- claude code: spec 設計 → Codex App 開く → 4 task に並列 prompt 投入
- 各codex: branch → 実装 → PR → 「作業後」と「同じHEADの完了証跡」を確認 → 条件を満たせばmerge
- ユーザー: 判断不能・未検証・human-gate が残る PR だけ個別確認
- claude code: JSON取り込み + Music改修 → 自分の最終HEADで同じ全体gateと必要レビュー → デプロイ

### シナリオ E: codex が止まって claude が続ける (今回の引き継ぎ例)

- codex chat の context が詰まる
- claude codeが担当scope・worktree・候補HEAD・検証ログ・未解決事項を確認して引き継ぎ、他担当の差分を混ぜない
- 「作業後」と「同じHEADの完了証跡」に戻り、同期/衝突解消後の全体gateと必要レビューを実施
- cache buster規則はruntime変更時に守り、古いHEADのauditだけを引継ぎ完了証拠にしない

---

## 信頼境界

- **claude / codex 両方が同じローカル repo を触る** ことに対する信頼:
  - 両者は同じ Windows ファイルシステム上で動く
  - git で互いの変更を追える
  - stack-checkで既存の全体検査を実行する。未検出の問題がないという保証にはしない
- **両者が同じ origin/main に push する** ことに対する信頼:
  - GitHub の commit author / timestamp で追跡
  - 強制 push 禁止
  - 重大バグは revert で復旧

---

## 計算資源の使い分け (実際的)

- **claude code 起動中**: chat session が長くなって context 圧迫 → 軽い修正のみ claude、大きい修正は codex に振る
- **codex chat 起動中**: 1 task の容量が詰まる → 別 task or claude code に引き継ぎ
- **両方アイドル**: ユーザーが判断、好きな方に投げる
- **両方稼働中**: 互いに干渉しない領域に振る (上記シナリオ C)

---

## 監査ログ

「同じHEADの完了証跡」を候補HEADへ紐づける。個別checkの成功だけでは全体整合を完了扱いしない。
GitHub Actions で audit.py を CI 化したい場合は user 承認が必要 (現状未導入)。

```yaml
# 将来の .github/workflows/audit.yml の雛形 (user 承認後に有効化)
name: Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.x' }
      - run: pip install --quiet
      - run: python -X utf8 scripts/audit.py
      - run: node scripts/check-js.mjs
      - run: node scripts/check-band-room-logic.mjs
      - run: node scripts/check-fm-route-badge.mjs
```

---

## 改善提案を出すとき

- 「○○磨いて」レベルの大雑把な指示でも、両 agent は本ドキュメントを
  読んで自走できるよう設計
- agent 側で **「これは大きな変更なので PR にする」** 判断は AGENTS.md
  の hard rules + 並列衝突回避ルールに従う
- 不明点は AGENTS.md / SCHEMA.md / HAZAMA-FM-ARCHITECTURE.md の順に読む

---

## まとめ

| 課題 | 解決 |
|---|---|
| 両 agent が同じ整合性ガードを使う | 同期/衝突解消後の同じHEADで`node scripts/stack-check.mjs`、FAIL 0 / SKIP 0、0 BADと必要レビュー |
| cache buster の同期忘れ | audit.py の Section 5 で検出 |
| engine.js への意図せぬ改変 | AGENTS.md Hard rules + user 承認 |
| 同時編集衝突 | git pull --rebase + 手動解決 |
| どっちが空いてるか | claude が orchestrator として呼び分け |
| context が詰まる | 別 agent に引き継ぎ (この repo は両 agent 対応) |
