# 本人用ブラウザ制作台（v1）

`Music` repo 内の独立した Strudel 試奏アプリ。PCとスマホで同じCloudflare Pages URLを開き、3本のループを聴きながらコードを変える。既存の `music-stack.pages.dev` とGitHub Pagesの公開再生は変更しない。

## 現在できること

- Play / Stop、コード編集後の再評価。
- 保存済みのStrudelコードを非公開KVから読み直す。
- `pad` / `sub` / `drums` のWAVを非公開KVから同一オリジンで読む。スマホへのフォルダimportは不要。
- Access設定が欠ける環境では全ページ・APIを `503` で拒否する。Accessトークンの検証後にも所有者メールを照合する。

ブラウザ内で直したコードはその端末だけの試奏で、保存版へ自動同期しない。AIから保存版を更新するときは、手元のコードファイルをKVへアップロードし、スマホで「元コードを読み直す」を押す。ライブの自動pushや同時編集は今後の段階。

## Cloudflare Pages の配置

Git連携の**別Pagesプロジェクト**を、同じ `QuietBriony/Music` repoから作る。既存の公開 `music-stack` プロジェクトは使わない。
入口は <https://music-private-live-workbench.pages.dev>。Cloudflare Accessの設定が揃うまでは意図的に開けない。

| 設定 | 値 |
|---|---|
| Project | `music-private-live-workbench` |
| Repository | `QuietBriony/Music` |
| Root directory | `experiments/workbench/v1` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output | `dist` |
| Functions | このrootの `functions/` |
| KV binding | `MUSIC_LIVE_ASSETS`（Pages本番設定） |

`wrangler.toml`はローカル検証専用。`pages_build_output_dir`を含めず、本番のKV bindingと
非公開の環境変数はCloudflare Pages側で設定する。Wrangler設定を本番の正本にすると、
Gitに書けないAccess値やKVの保存keyまで同じ設定ファイルで管理することになるため。

現在のpreview deploymentは無効。Cloudflare Accessでproductionの `<project>.pages.dev` を保護し、許可メールを本人1件だけにする。Previewを有効にする場合は `*.<project>.pages.dev` も先に保護する。Preview保護だけではproduction URLは保護されない。AccessのApplication Audience（AUD）とteam domainを確認し、Pagesのproduction環境へ次の値を設定する。

| Pages環境変数 | 内容 |
|---|---|
| `CF_ACCESS_DOMAIN` | `https://<team>.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | このAccessアプリのAUD |
| `OWNER_EMAIL` | 許可する本人のメールアドレス |
| `LIVE_SOUND_PREFIX` | KV内の音声セットprefix |
| `LIVE_PATTERN_KEY` | KV内の保存コードkey |

実データのprefix、作品名、素材ファイル、Access値をpublic repoへ書かない。R2は現在のCloudflareアカウントで未有効化なので、v1の約1 MB×3本に限りKVを使用する。大きなstemへ拡張する際は別の保管方式を選ぶ。

デプロイ後は未ログインの `/`、`/api/pattern`、`/api/sounds/pad` がAccessログインへ向かうこと、本人ログイン後に3本の音声がHTTP 200で読み込めることを確認する。custom domainを追加する場合はそのdomainにもAccessポリシーが必要。

## 保存版の更新

音声・コードをGitHubへpushしない。本人のローカルファイルからKVへ送る例（プロジェクトrootで実行）：

```powershell
npx wrangler@4.129.1 kv key put '<LIVE_PATTERN_KEY>' --path '<private-pattern-file>' --namespace-id '<KV_NAMESPACE_ID>' --remote
```

コードには `s("pad")`、`s("sub")`、`s("drums")` をそのまま書く。ページが非公開音声URLの `samples(...)` 定義を先頭に足す。新しいパートを増やすにはAPIの許可名と音声ファイル、音声セットを一緒に更新する。

## スマホで使う

1. 本人のメールでCloudflare Accessにログインする。
2. ページを開いて `Play` を押す。iPhoneでは再生開始にタップが必要。
3. コードを変更し、`コードを反映` を押す。`Stop` はすぐ停止する。
4. AIが保存版を更新したら、`元コードを読み直す` で取得する。試奏中の変更はこの操作で破棄される。

## ローカル確認

```powershell
npm ci
npm run build
npm test
npx wrangler@4.129.1 pages functions build --outdir .wrangler/function-build
npx wrangler@4.129.1 pages dev dist
```

Access設定がないローカル `pages dev` は意図的に `503`。画面・音の疎通はprivate素材をループバックのテストサーバーから返して確認する。

Strudel本体は `@strudel/repl@1.3.0` をnpmで固定し、ビルド時に同じPages配信へ同梱する。この独立アプリのコードはStrudelの[利用条件](https://strudel.cc/technical-manual/project-start/)に合わせてAGPL-3.0で公開する（[LICENSE](LICENSE)）。既存Musicランタイムとはコードを結合しない。
