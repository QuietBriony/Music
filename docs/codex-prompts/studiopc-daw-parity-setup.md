# Codex prompt — StudioPC DAW / NI parity setup with about 50 GB free

StudioPC の Codex App で `C:\workspace\music-stack\Music` を開き、下の block を
そのまま貼る。容量と公式 Available 表示は実機で再調査し、このファイルの数値を
推測で置き換えない。

---

```text
この PC は `studioPC` です。WorkerPC と共有利用できる音楽制作環境へ整備して
ください。作業 Repo は `C:\workspace\music-stack\Music`。C drive 自体を Git
repository にしないでください。

現時点の想定は C drive 空き約 50 GB です。完全な製品ミラーではなく、同じ
DAW / plug-in version と共有 project で使う NI content を揃えることが目的です。
作業完了後の C drive 空きは最低 25 GB を残してください。25 GB はこの環境の
運用 guardrail で、公式要件ではありません。

最初に実施:

1. workspace root と Music repo の `AGENTS.md` を読む。
2. 次を読む。
   - `docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md`
   - `docs/PC-REGISTRY.md`
   - `docs/NEW-PC-SETUP.md`
   - `docs/HARDWARE-JAM-ROUTING.md`
3. `git status -sb`、current branch、remote を確認し、既存変更を消さない。
4. `git pull --ff-only origin main` は、working tree と branch が安全な場合だけ
   実行する。local変更がある場合は先に内容を報告する。
5. read-only で次を棚卸しする。
   - Windows / CPU、全 drive の total / free space
   - Sonar、Cakewalk Product Center、Ableton、Native Access の version
   - Kontakt 6 / 7 / 8、Reaktor 6、Komplete Kontrol、Traktor、Maschine、
     Guitar Rig の installed version
   - VST3 / VST2 path と実ファイル
   - Native Access の content / download location
   - installed NI library と可能なら各実容量
   - Windows が認識する UR44 / NI hardware と既存 driver
6. シリアル、password、token、MFA code は表示・記録しない。

WorkerPC parity target:

- Cakewalk Product Center `1.1.0.004`
- Sonar `2026.07` / build `32.07.0.021`
- Ableton Live 12 Lite `12.4.3`
- Native Access `3.25.2.893`
- Kontakt 8 Player `8.11.1`
- Kontakt 7 Player `7.10.9`（既存なら旧 project 用に維持）
- Kontakt 6 `6.8.0`（既存なら旧 project 用に維持）
- Reaktor 6 `6.5.0`
- Komplete Kontrol `3.5.4`
- Traktor Pro 3 `3.11.1.17`（既存 license の範囲）
- Maschine 2 `2.18.4` / Guitar Rig 6 LE `6.4.0` は使用する場合だけ同版

公式 installer / manager に上記より新しい安定版しか表示されない場合、
StudioPC だけを先行して新しくしないでください。WorkerPC も同時更新すべきか、
version と理由を報告して user の判断を待ってください。有料 major upgrade は
購入・導入しないでください。

容量ルール:

- 作業開始時の全 drive 空き容量を記録する。
- Native Access の update / install は必ず 1 製品ずつ。全 Available の一括
  queue は禁止。
- 各製品の download / installed size を画面で確認し、実行後に C drive の
  free space を再計測する。
- 次の 1 製品で C drive が 25 GB 未満になる見込みなら、その製品を入れる前で
  停止して報告する。
- 別の内蔵 drive / 外付け SSD があれば、大きい NI content の保存先候補として
  提案する。ただし既存 library の relocate は user 承認なしに実行しない。
- VST3 application は通常の system path
  `C:\Program Files\Common Files\VST3` を使う。
- cache、旧Kontakt、旧DAW、user preset、既存 libraryを勝手に削除しない。
- DAW project、録音、音源 library、download cache、plugin cache は Git に
  入れない。

導入優先順位:

P0 保護:
- 既存 Sonar / Ableton project を更新版で初回保存する前に、project folder
  全体を repo 外へ backup。
- 古い project で NI互換に不安があれば、該当 track を freeze / WAV 化。
- Kontakt 6 / 7 は削除しない。不要な旧版を勝手に uninstall しない。

P1 共通 application / plug-in:
- Cakewalk Product Center / Sonar
- Ableton Live 12 Lite
- Native Access
- Kontakt 8 Player
- Reaktor 6
- Komplete Kontrol

P2 共通必須 content:
- Scarbee Mark I
- Monark
- Prism
- TRK-01 Bass
- Reaktor Factory Selection R2

P3 残容量が十分なら共通化:
- Mikro Prism
- Blocks Base
- Kinetic Treats
- Kontakt Factory Selection
- Play Series Selection
- その他、既に両PCの同じlicenseで使っている小容量content

P4 延期可能:
- 共有 project で使っていない Expansion
- Maschine の追加 content
- VCV Rack / SuperCollider
- StudioPCで使わない追加音源

実行順序:

1. 調査結果を current / target / action / capacity risk の表で短く報告する。
2. 安全に進められる更新は Sonar → UR44 → Native Access / NI → Ableton の順で
   進める。
3. StudioPCで実際に使う機材は UR44。公式 Yamaha Steinberg USB Driver /
   dspMixFxだけを扱い、未接続・未使用NI hardwareのdriverは追加しない。
4. Native Access のlogin済みaccountと利用可能製品を確認し、P1 → P2 → P3を
   1本ずつ更新・installする。
5. sign-in、serial登録、利用規約、UAC、admin確認、再起動が必要になったら
   その画面で止め、userが押す場所だけを短く説明する。credentialをCodexへ
   入力させない。

検証:

- Sonar / Ableton で VST3 を再スキャン。
- 新規 Sonar project は Kontakt 8 VST3 / Reaktor 6 VST3 を使う。
- UR44を Yamaha Steinberg ASIO として選択し、48 kHz / 24 bitで確認。
- repo外に StudioPC専用 smoke test folderを作り、次を確認。
  - MIDI track
  - Kontakt 8 + Scarbee Mark I
  - Reaktor 6 + TRK-01 Bass または共通Reaktor音源
  - 短いaudio
  - track freeze
  - 非無音の24-bit / 48 kHz stereo WAV export
- Komplete Kontrol standaloneを起動してscanを完了。
- AbletonのKomplete Kontrol VST3からMonark presetを読み込み、
  `Plug-in not found`が出ないことと発音を確認。
- Abletonのedition固有機能は共有Setで使わない。
- 同じ編集中のprojectをWorkerPCと同時に開かない。Sonar共有時は`.cwp`
  単体ではなくproject folder全体を扱う。

Repoへの記録:

- 重複する新規環境文書を作らず、
  `docs/MUSIC-PC-DAW-PARITY-RUNBOOK.md` と `docs/PC-REGISTRY.md` を更新する。
- StudioPCの実測version、NI library、VST3 path、UR44 driver、作業前後の
  free space、延期した製品と理由を記録する。
- commit / push は差分と検査結果をuserへ報告し、承認を得てから行う。
- commit前にAGENTS.md指定のintegrity gateと`node scripts/stack-check.mjs`
  を実行する。

完了条件:

- StudioPCが共有projectに必要なDAW / plug-in / contentでWorkerPCと一致。
- C drive free spaceが25 GB以上。
- Sonar smoke test、Ableton VST3 test、UR44の実音確認が成功。
- 旧project互換用softwareとuser dataを破壊していない。

まず調査と容量差分の確認を行い、安全に実行できる更新はそのまま進めてください。
```
