# ARM 版 chouta-surface での UR44 ドライバ安定化 — 調査

`BACKLOG.md` BL-023 (P2、Web research 段階) の調査結果。
chouta-surface (ARM 版 Surface) で UR44 を音作り用に使えるかを判定するための、
2026-05 時点のドライバエコシステム整理。

実機テスト (chouta-surface に UR44 を接続して試す) は human-gate 必須。本 doc は
**何をどの順序で試すべきか** と **何が無理筋か** を user に渡すための road map。

---

## 1. 背景 (PC-REGISTRY との対応)

- **chouta-surface**: ARM 版 Surface、メイン開発機。`PC-REGISTRY.md` で
  「ARM 版では UR44 のドライバ / コネクタ挙動が不安定」と記録され、音作り
  iteration は intel 版 `studio-surface` に集約する運用に変更された。
- **studio-surface**: Intel Surface、UR44 試聴 PC。Steinberg 公式 driver と x86-64
  ネイティブの ASIO が安定して動く前提。
- **本 BL-023**: chouta-surface でも UR44 接続が安定するなら、UR44 の物理移動
  なしで chouta-surface 上でも軽い試聴ループを回せる。試聴 PC を 2 台にする
  必要は急がないが、将来の選択肢として技術的に可能か把握する。

---

## 2. 2026-05 時点のドライバエコシステム

### 2.1 Yamaha Steinberg USB Driver (公式 vendor driver)

- **最新版**: V2.1.9 (Windows 11/10 64-bit)
- **ARM64 ネイティブ対応**: V2.1.7 / V2.1.8 から開始
- **ARM64 対応モデル (公式)**: **Steinberg IXO series のみ** (2026-05 時点)
- **UR44 の扱い**: ARM64 ネイティブ非対応リストには入っていない。x86-64 用
  driver を Windows on ARM (Win11) の x64 エミュレーションで動かす形になる
- 2024-10-25 に Steinberg が「Windows on Arm 向け preview driver」を公開した forum
  記録あり (UR series で動くか個別検証は user 側)。UR28M 等 UR series の動作
  可否は forum でも明確な回答が得られていない

→ **UR44 が公式に native ARM64 driver でサポートされる見込みは低い** (UR44 は
2014 年発売の旧モデル、Steinberg が新規 ARM64 ドライバを書く incentive が薄い)

### 2.2 Microsoft 新 in-box USB Audio Class 2 driver (native ASIO 付き)

- **新規開発**: Microsoft が Qualcomm + Yamaha と共同で開発する **brand-new
  in-box USB Audio Class 2 driver**
- **特徴**:
  - WaveRT endpoint + **native ASIO interface** 内蔵
  - 低レイテンシ musician scenario 最適化モード
  - implicit / explicit feedback サポート
  - すべての USB audio endpoint を扱う
- **対応アーキ**: ARM64 が初期ターゲット、x86-64 は後追い
- **タイムライン**: 2025 中 preview、**2026 中 public preview を Windows Insider
  Canary で配布予定**。retail image 入りは industry inference (公式確定日未定)
- **対応デバイス**: **すべての class-compliant USB Audio Class 2 device** が
  plug-and-play 動作。vendor driver より tune は劣る可能性ありとしているが、
  generic driver としては最も高機能になる見込み
- **オープンソース**: MIT license で `aka.ms/asio` に公開済。実装は manufacturer
  / developer が拡張可能
- **UR44 の扱い**: UR44 は USB Audio Class 2 compliant なので、Microsoft 新 driver
  が public preview に出れば **chouta-surface で plug-and-play で動く可能性が高い**

→ **これが chouta-surface での UR44 安定化の最も筋の良い path**。Steinberg 公式
ARM64 native UR44 driver を待つより、Microsoft 新 driver の preview を試す方が
現実的。

### 2.3 ASIO4ALL

- **最新版**: v2.20 (2026-04-27 公開)
- **ARM64 ネイティブ**: なし。Windows 11 ARM64 では x64 emulation 経由で動作
- **位置付け**: Microsoft 新 driver が普及する前の繋ぎ。Microsoft の native ASIO
  initiative が出れば asio4all の必要性は下がる
- **UR44 の扱い**: UR44 を Windows の汎用 USB audio として認識させた上で
  ASIO4ALL を被せれば DAW から ASIO で叩ける。ただし全部 emulation を通るため
  レイテンシ / 安定性は限定的

### 2.4 generic Windows USB Audio Class 2 driver (`usbaudio2.inf` 既存)

- Microsoft が Windows 10 Release 1703 から in-box で持っている既存の generic
  class driver
- USB Audio Class 2 compliant device が plug-and-play で動く
- ただし ASIO サポート無し、低レイテンシ最適化なし
- 2.2 の新 driver が **これの後継** に位置付けられる

---

## 3. chouta-surface で UR44 を試す時の推奨順序

実機テストは user (human) が UR44 を chouta-surface に接続して行う。本セクションは
試す順序と判定ポイントの整理。

### Step 1: 現状確認 (まず) — Windows 標準で何が動くか

```powershell
# UR44 を USB で接続
# デバイスマネージャで認識を確認
Get-PnpDevice | Where-Object FriendlyName -like '*Steinberg*'
Get-PnpDevice | Where-Object FriendlyName -like '*UR44*'
Get-PnpDevice | Where-Object FriendlyName -like '*Yamaha*'
```

- **期待**: USB Audio Class 2 device として認識される (generic `usbaudio2.inf` で
  ステレオ in/out くらいは取れる可能性)
- **判定**: Windows 標準音声で出音できるか。サウンド設定で UR44 を出力デバイスに
  指定して任意の音源を再生。
- **問題が出るパターン**: コネクタ抜き差しで device hand 不安定、driver re-enum
  必要、サンプリングレート変更で stall 等。これらが「不安定」報告の正体の可能性。

### Step 2: Yamaha Steinberg USB Driver V2.1.9 を x64 emulation で

```text
1. https://o.steinberg.net/en/support/downloads_hardware/yamaha_steinberg_usb_driver.html
   から V2.1.9 Win 11/10 64-bit 版をダウンロード
2. インストーラ実行 (Windows on ARM の x64 emulation で起動するはず)
3. 再起動後、dspMixFx Yamaha Steinberg USB が起動するか確認
4. ASIO バッファサイズを 256 / 512 / 1024 で試す
```

- **期待**: x64 emulation でインストール + 動作するが、ARM ネイティブと比べ
  レイテンシ / CPU 負荷で劣る可能性
- **判定**: Hazama FM をブラウザで開き、UR44 経由で出音した時に dropout が出るか。
  pad `maxPolyphony` 24 cap (BL-022 fix 1) で出音している状態で chouta-surface
  ARM + UR44 emulation が破綻するなら、UR44 を chouta-surface 用にするのは
  時期尚早。

### Step 3: Microsoft 新 in-box USB Audio Class 2 driver (Windows Insider Canary)

```text
1. chouta-surface を Windows Insider Program に登録、Canary channel に切替
2. Canary build で Microsoft 新 driver が in-box に入っているか確認 (2026
   中の preview 配布スケジュール待ち)
3. UR44 を接続、generic driver が新 driver に置き換わって認識されるか確認
4. ネイティブ ASIO が見えるか DAW (Cubase / Ableton Trial) で確認
```

- **期待**: UR44 が **plug-and-play で ARM64 ネイティブ動作** する。レイテンシは
  vendor driver より劣るが安定性は高い見込み (MS の native low-latency driver)
- **判定**: dropout / device hang 無く UR44 経由で出音できれば成功。chouta-surface
  での UR44 接続が安定したと宣言可能。
- **リスク**: Canary channel は安定版より不安定。chouta-surface はメイン開発機
  なので、Canary 化は WIP 開発が落ちる可能性あり。**実施前に user 側で全
  feature branch を push し、main を clean にして worktree backup を取っておく**。

### Step 4: ASIO4ALL v2.20 fallback

Step 1-3 が全部だめだった時のみ。Windows 11 ARM64 で x64 emulation 経由で動く。
レイテンシ要求が緩い (Hazama FM の試聴くらい) なら使えるかもしれないが、
そもそも chouta-surface で UR44 を本格運用しないなら無理筋。

---

## 4. 判定 matrix (このまま BL-023 を進めるか)

| 観点 | 評価 |
|---|---|
| 急ぎ度 | **低**。studio-surface (Intel) で UR44 試聴の運用が回るため、chouta-surface での UR44 接続は nice-to-have |
| Steinberg 公式 ARM64 native UR44 サポート | **見込み薄**。UR44 が 2014 年発売の旧モデル、IXO series しか公式 ARM64 native に入っていない |
| Microsoft 新 driver の見込み | **2026 中に Insider Canary で出る予定**。UR44 は USB Audio Class 2 compliant なので、出れば plug-and-play で動く可能性高 |
| x64 emulation 経由の Steinberg driver | **動くかもしれない**。レイテンシ / 安定性は要検証 |
| ASIO4ALL ARM64 | **fallback 専用**。ネイティブ ARM 無し |
| chouta-surface を Canary 化するリスク | **メイン開発機なので注意**。Canary は build 不安定で WIP repository state が壊れるリスクあり |

→ **推奨方針**: 
1. 短期 (今すぐ実施可能): Step 1 + Step 2 で「現状 emulation でどの程度動くか」を
   user が一度だけ実機確認
2. 中期 (2026 中後半): Microsoft 新 driver の Canary preview が出たら別 PC
   (例: 普段使わない予備機、または worker-gaming) で先に Canary build を試し、
   UR44 が plug-and-play で動くことを確認してから chouta-surface 上で同 driver を
   試す
3. **chouta-surface を直接 Canary 化しない** (メイン開発機を unstable build に
   する経由費用が大きい)

---

## 5. human-gate test checklist (user 用)

user が実機テスト時に確認する項目:

### Step 1 確認 (Windows 標準のみ)

- [ ] `Get-PnpDevice` で UR44 が認識される (Steinberg / Yamaha / UR44 文字列のいずれか)
- [ ] サウンド設定で UR44 が出力デバイスに選べる
- [ ] Windows Media Player / VLC 等で UR44 経由で音が出る
- [ ] サンプリングレート (44.1 / 48 / 96 kHz) 切替が落ちずに通る
- [ ] USB ケーブル抜き差し後、自動で再認識される
- [ ] 30 分連続再生で hang / dropout 無し

### Step 2 確認 (Yamaha Steinberg USB Driver V2.1.9 x64 emulation)

- [ ] V2.1.9 installer が x64 emulation で完走する
- [ ] dspMixFx Yamaha Steinberg USB が起動する
- [ ] Hazama FM をブラウザで起動、UR44 経由で出音、dropout 無し
- [ ] DAW (Cubase / Ableton Trial 等) から ASIO driver として見える
- [ ] ASIO buffer 256 / 512 / 1024 サンプルでレイテンシ計測
- [ ] CPU 使用率 emulation 経由でも常用可能なレベル (< 30% アイドル) か確認
- [ ] 30 分連続録音 (UR44 input → DAW) で glitch 無し

### Step 3 確認 (Microsoft 新 driver Canary、2026 中後半に preview 出たら)

- [ ] Windows Insider Canary build に切替
- [ ] UR44 接続、新 driver が in-box で適用される
- [ ] DAW から native ASIO として見える
- [ ] ASIO buffer 128 / 256 / 512 でレイテンシ計測 (vendor driver と比較)
- [ ] Hazama FM ブラウザ再生で dropout 無し
- [ ] 試聴運用に堪える品質か判定

### 完了条件

- Step 1 + 2 を user が試して結果を SESSION-LEDGER または USER-NOTES-MEMO に記録
- Step 3 は Microsoft 新 driver の preview が出てから別 session で実施
- Step 2 がだめ・Step 3 がまだ未配布なら、chouta-surface での UR44 運用は
  **保留** にして studio-surface 集約のまま (現状運用)。BL-023 は「調査済み・
  実機 step 2 まで完了・step 3 は Microsoft 新 driver 待ち」で Done に移す

---

## 6. Related

- `docs/PC-REGISTRY.md` chouta-surface 行 (ARM 版で UR44 不安定の前提)
- `docs/PC-REGISTRY.md` studio-surface 行 (Intel CPU で UR44 / 音響サブシステム安定)
- `docs/autonomy/BACKLOG.md` BL-023
- `docs/NEW-PC-SETUP.md` (新 PC セットアップ用、本 doc は ARM 版固有の補足)

## 7. Sources

- [Steinberg UR44 Updates and Downloads](https://o.steinberg.net/en/support/downloads_hardware/downloads_ur44.html)
- [Yamaha Steinberg USB Driver V2.1.9 for Windows 11/10 (64-bit) — Yamaha USA](https://usa.yamaha.com/support/updates/yamaha_steinberg_usb_driver_for_win.html)
- [Yamaha Steinberg USB Driver Updates and Downloads — Steinberg](https://o.steinberg.net/en/support/downloads_hardware/yamaha_steinberg_usb_driver.html)
- [Windows Arm64 drivers — UR Series — Steinberg Forums](https://forums.steinberg.net/t/windows-arm64-drivers/920131)
- [About Steinberg products for Windows on Arm — Steinberg Help Center](https://helpcenter.steinberg.de/hc/en-us/articles/21829527504530-About-Steinberg-products-for-Windows-on-Arm) (403 — 直接 fetch 不可、ブラウザでアクセス推奨)
- [Microsoft Windows MIDI and Music dev: Fall 2025 Windows Musician Technology and Arm64 Update](https://devblogs.microsoft.com/windows-music-dev/fall-2025-windows-musician-technology-and-arm64-update/)
- [Microsoft's In‑Box Low Latency USB Audio ASIO Driver for Windows on Arm — Windows Forum](https://windowsforum.com/threads/microsofts-in-box-low-latency-usb-audio-asio-driver-for-windows-on-arm.389050/)
- [Windows on Arm to Get Microsoft's New Low-Latency Audio Driver in 2026 — Windows Report](https://windowsreport.com/windows-on-arm-to-get-microsofts-new-low-latency-audio-driver-in-2026/)
- [USB Audio 2.0 Drivers — Windows drivers | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/usb-2-0-audio-drivers)
- [ASIO4ALL Official Home](https://asio4all.org/)
- [Microsoft USB Audio ASIO open source: aka.ms/asio](https://aka.ms/asio)
