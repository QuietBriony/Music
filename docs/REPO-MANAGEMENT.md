# Repo Management — Pages 制限と複数 repo の運用

> ユーザー懸念: 「Pages 1 GB ソフトは 1 repo？ tree-doctor わりと大きいから
> 全体だと困るな」 — その心配は **不要**。制限は per-repo per-Pages-site で、
> アカウント合計には適用されない。

---

## GitHub の各種制限 (2026 時点)

| 制限 | 値 | 単位 | 違反時 |
|------|----|----|------|
| **Pages site size** | 1 GB | per published Pages site | warning, build エラー候補 |
| **Pages bandwidth** | 100 GB / month | per published Pages site | サイト一時停止 |
| **Pages builds** | 10 / hour | per Pages site | キュー詰まり |
| **Pages build timeout** | 10 min | per build | build 失敗 |
| **Single file size** | 100 MB | per file | Git push reject (LFS 必須) |
| **Git repo size (recommended)** | < 5 GB | per repo | warning |
| **Git repo size (hard limit)** | 100 GB | per repo | block |
| **LFS storage (free)** | 1 GB | account total | upgrade prompt |
| **LFS bandwidth (free)** | 1 GB / month | account total | block |
| **API rate limit (authenticated)** | 5,000 req/h | account | 429 backoff |

**重要**:
- Pages の 1 GB は **per published site** = repo ごとに独立
- bandwidth も同じく per site
- だから tree-doctor の Pages サイトが 800 MB あっても、Music の Pages
  サイトの 521 MB に影響しない
- LFS 制限だけは account 全体合計

---

## 現状のアカウント repo サイズ (5月13日時点)

```
gh repo list QuietBriony --limit 30 --json name,diskUsage \
  --jq '.[] | "\(.name): \(.diskUsage) KB"'
```

主要 repo:

| repo | size | 用途 |
|------|------|------|
| **Music** | 521 MB | Hazama FM / Band Room / Music Core Rig (this repo) |
| **tree-doctor-test** | 319 MB | 樹木健診 (別 Pages site, 独立) |
| **hazama** | 6.5 MB | (旧 hazama 派生?) |
| line-knowledge-bot | 750 KB | |
| umbrel-openclaw-runtime | 3.3 MB | |
| openclaw | 290 KB | |
| ... (各 1 MB 未満) | | |

Music も tree-doctor-test もそれぞれ 1 GB 制限の **半分以下**。安心。

---

## Music repo の内訳 (なぜ 521 MB か)

```bash
cd ~/workspace/github-inventory/music-stack/Music
du -sh presets/ icons/ assets/ docs/ *.js *.html *.css 2>/dev/null | sort -h
```

予想:
- `presets/tabasco-stems/` — Demucs 4-stem mp3 × 7 曲 = 157 MB (v61 で 96 kbps re-encode して半減済)
- `presets/sample-kits/` — drum/vocal-phrase 1ショット × 7 曲 = 数十 MB
- `presets/*.json` — drum-frames + bands + references = 数 MB
- `engine.js` — 12,738 行、~700 KB
- `band-room.js` — ~3,000 行、~110 KB
- `style.css` + `band-room.css` + `fm.css` — 数十 KB ずつ
- icons / assets (SVG mandala layers) — 数 MB
- `docs/` — markdown 多数、~1-2 MB

合計 ~520 MB の大半は **Tabasco stems** (157 MB) + **Demucs 抽出履歴か他の素材**。
将来サイズが厳しくなったら:

1. **stems を 64 kbps に再エンコード** (157 MB → ~100 MB)
2. **古い experimental wav を削除**
3. **大きな素材 (もし入れるなら) を LFS に逃がす**
4. **新バンド追加時は最初から 96 kbps mp3 で**

---

## 容量警戒ライン

| ライン | 値 | 対応 |
|------|----|----|
| Healthy | < 500 MB | 何もしない |
| Watch  | 500-800 MB | 不要素材削除を検討 |
| Action | 800-950 MB | re-encode / 削除 |
| Critical | > 950 MB | Pages build 失敗の恐れ、即対応 |

---

## 複数 repo を Pages で運用するときの URL

```
https://quietbriony.github.io/Music/         # this repo
https://quietbriony.github.io/tree-doctor-test/  # 別 repo の Pages site
https://quietbriony.github.io/<repo>/         # 他の Pages enabled repo
```

各 URL ごとに独立 cache (Service Worker) を持てる。Music の sw.js は
`/Music/` scope に閉じてるので、tree-doctor のキャッシュと衝突しない。

---

## bandwidth 監視

```bash
gh api repos/QuietBriony/Music/traffic/views --jq '.count, .uniques' 2>&1
gh api repos/QuietBriony/Music/traffic/clones --jq '.count, .uniques' 2>&1
```

Pages の生 bandwidth は `Settings → Pages → Visitor data` で確認可能だが、
GitHub Pages 個別の bandwidth API は無いので、本当に 100 GB/月に近づくときは
GitHub から警告メールが来る (経験的にはほぼ来ない)。

ロックダウン防御として `presets/*.mp3` を **Service Worker でアグレッシブに
キャッシュ** してあるので、リピーターは bandwidth を食わない (v68 sw.js)。

---

## このレポートの自動化候補

毎月 1 回、`gh api repos/.../size` を呼んで Slack / メモに記録する cron 化、
やる気あれば `scripts/_repo-size-watch.py` に書ける。今は手動で OK。
