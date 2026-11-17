# BL-053 練習PWA v42：民謡の伴走を広げる（Codex 用の依頼文）

2026-11-17 に Claude が書いた依頼文。worker（MyComputer）の Codex アプリにある、練習PWAのスレッド
「ギターと三味線の練習PWA検討」（v1〜v41 を作ったスレッド）で使う。
この文書だけでは本人の承認にならない。本人がスレッドに書いた言葉を承認として扱う（`docs/CODEX-HANDOFF.md`「dot・agent経由の依頼の受領票」）。

## 本人の方針（2026-11-17、原文）

- 「売るよりは、楽しく使う優先にしよう。売るなら、こう　って定義はしていいね。今は遊ぶの最優先」
- 「工工四　つくって、歌詞併記　が　三線はほしいやつ」「音で判定して、伴走する感じ？」
- 「1で、民謡の伴走から進めて」：伴走（歌詞付きの内蔵工工四を、弾いた音をマイクで聞きながら進める）は、本人の作業なしで作れる民謡で広げる。近現代の曲は、いまどおり先生の動画で練習する。
- 本人は初心者で、耳コピや譜面の打ち込みはしない。本人に作業を求める形にしない。

教材の権利の整理は `docs/PRACTICE-MATERIALS-RIGHTS.md`（2章・8章）。この依頼の権利の条件は、その文書に合わせてある。

## 作業する場所

- PC は worker（MyComputer）。Music repo は `C:\workspace\music-stack\Music`。
- まず `git -C C:\workspace\music-stack\Music fetch origin` で最新を取る（main 本体のファイルには触れない）。
- 作業は worktree で行う。`C:\workspace\music-stack\Music-practice` が clean なら、そこで origin/main から branch `codex/practice-minyo-<日付>` を作る。clean でなければ新しい worktree を作る。
- `C:\workspace\music-stack\Music` 本体（main、未保存の変更あり）と `C:\workspace\music-stack\music-ops` には触らない。pull・reset・stash・checkout もしない。
- 基点は最新の origin/main。使った SHA を報告に書く。

## やること（v42）

### 1. 調べる（コードを変える前に）

- (a) 安里屋ゆんた：竹富島に伝わる八重山言葉の伝承の歌詞が、いまの内蔵譜（宮良長包の節、前奏＋1節・92音）に合うか。
  伝承の歌詞は、もとは伝承の別の節で歌うとされる。照合は先生の教材（宮里英克の動画・PDF、伊禮俊一）で行い、写さない。
- (b) てぃんさぐぬ花・月ぬ美しゃ：伝承の2番以降の歌詞を、出典がはっきりした形で、いまの節に足せるか。
- (c) 調べるだけ（実装しない）：次に足せる初心者向けの民謡の候補を3〜5曲。各曲について、節と歌詞が伝承か保護期間切れであることの出典、工工四を新しく入力するときに照合できる公開の教材、初心者に向くか。

### 2. 作る（出典がはっきりしていて、節に合うものだけ）

- (a)・(b) のうち、条件を満たすものを、てぃんさぐぬ花（v22）・月ぬ美しゃ（v41）と同じ形で入れる：歌詞・読み・やさしい意味・語句の説明・歌詞の位置。
- マイク・ガイド・手動送り・全画面表示・既存の保存データ（練習位置・手元の歌詞・調弦・感度・しおり）はそのまま保つ。
- 条件を満たすものが無ければ、コードは変えずに、わかったことだけを報告する。

## 権利の条件（必ず守る）

1. 安里屋ゆんたの標準語の歌詞（1934年「新安里屋ユンタ」、作詞 星克、1977年没、日本では2047年末まで保護）は1文字も入れない。
2. 使ってよいのは、伝承であることを信頼できる公開の出典で確かめた歌詞だけ。出典が CC BY-SA なら、てぃんさぐぬ花と同じく表示し、同じライセンスで出す。
   囃子や繰り返しの句が新民謡で足された部分かもしれない場合は、確かめられなければ入れず、その旨を記録する。
3. 先生の教材は、照合にだけ使う。PDFの画像・レイアウト・先生独自の表記・節回し・現代語訳を写さない。音源・画像は入れない。
4. やさしい意味・語句の説明は自分で書く。
5. 出所記録を残す：`practice/songs/lyrics-provenance.json` と各曲の provenance に、出典URL・確認日・使ったもの・ライセンスの判断・変更点を書く。アプリ内のクレジットも既存の曲と同じ形で出す。
   アプリの「利用条件」で開く `practice/songs/provenance.json` の「歌詞なし」の記述も、実態に合わせる。
6. 歌詞の許可：AGENTS.md の決まり3は、歌詞を原則 repo に入れず、例外を AGENTS.md に書いたものだけとしている。
   本人がスレッドに書いた許可の言葉（原文・日時）を、`lyrics-provenance.json` の authorization と、AGENTS.md の決まり3の例外の両方に、曲ごとに書く。
   いまの4曲分（てぃんさぐぬ花・月ぬ美しゃ・Amazing Grace・きらきら星の英語）も例外に載っていないので、あわせて載せる。許可の言葉が無い曲には歌詞を入れない。
7. 近現代の曲の歌詞・旋律の譜面は、どこにも（コード・コメント・報告にも）書かない。

## 作業のルール

- 変更は `practice/`、その生成・検査スクリプト（`scripts/build-practice-*.mjs`、`scripts/check-practice*.mjs`）、AGENTS.md の決まり3の例外、
  版の記録（`docs/autonomy/SESSION-LEDGER.md` と `docs/PRACTICE-READINESS.md` 上部の「練習PWA vN」の行）だけ。`docs/autonomy/BACKLOG.md` は Claude が更新するので触らない。
- 版の上げ方はこれまでどおり（`?v=41` → `?v=42`、`music-practice-v42`、更新案内の版番号など、全部そろえる）。
- 回帰検査：既存2曲の歌詞位置の検査と同じ考え方で、足した歌詞の位置を検査に足す。
- 検査が通ったら、v41 と同じ流れで最後まで進める。
  branch を push → PR → 同じ最終 HEAD で `node scripts/stack-check.mjs`（FAIL 0 / SKIP 0 / 0 BAD）と `python -X utf8 scripts/audit.py`（0 BAD / 0 WARN）→ merge
  → merge 後の main の SHA から clean export を作り、`npx --yes wrangler@4.129.1 pages deploy <export> --project-name music-stack --branch main --commit-hash <sha> --commit-dirty=false` で既存の music-stack へ配信
  → 配信の一覧を v41 と同じ場所に保存 → GitHub Pages の build と、pages.dev の practice が v42 になったことを確かめる。
- 新しい公開先は作らない。他の repo には触らない。

## 最後の報告（日本語、短く）

1. 何を変えたか（ファイルと要点）、版番号、基点の SHA
2. 歌詞の出典（URL）と、伝承だと判断した根拠、ライセンスの扱い、入れなかった部分とその理由
3. 走らせた検査と結果（コマンドと PASS/FAIL の行）
4. 不確かなこと、本人に実機で確かめてほしいこと
5. 1 (c) の民謡の候補（3〜5曲）
6. PR 番号、merge 後の main の SHA、pages.dev の配信 ID と URL、GitHub Pages の build 結果。commit・push・PR・merge・公開を、それぞれ「済み／未実行／未確認」に分けて書く。
