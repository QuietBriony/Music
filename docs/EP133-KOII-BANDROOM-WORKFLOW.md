# EP-133 K.O.II / Band Room Workflow

## Position

Use EP-133 K.O.II as a hand-operated sampler and rhythm sketch box that can
reshape material prepared around Band Room. Music owns the reusable workflow;
an optional private `music-ops` overlay owns the actual unit, machine, cabling,
placement, and verified route.

This repository never treats device access as permission to write. EP-133
sample/project writes, pad assignment, backup/restore, firmware updates, and
listening decisions remain human gates.

## Do not break defaults

- Do not change Band Room default playback, runtime, presets, or service worker
  for a hardware experiment.
- Keep generated audio, transfer packs, recordings, and DAW projects outside
  Git.
- Commit only public-safe docs, code, schemas, and reviewed metadata.
- Do not store a private asset register, site labels, hostnames, exact wiring,
  device identifiers, or machine snapshots in Music.

## Documentation timeline

An OS 2.0-era manual reflects the feature set at that time. It is historical
documentation and must not be used to conclude that current EP-133 USB audio is
unsupported.

When checked on 2026-08-16:

- the current online guide identified itself as version 2.5;
- OS 2.5 (2026-06-24) documented USB audio input and output with a
  class-compliant host;
- OS 2.5.1 (2026-07-03) followed with fixes.

The current official guide outranks the older manual. The installed unit's OS,
Windows endpoints, DAW compatibility, and audible result still require direct
verification. Do not update firmware just to complete documentation.

## Do not mix up the USB directions

| Lane | Direction | Purpose | Write risk |
|---|---|---|---|
| USB audio out | EP-133 -> host | record/play EP-133 into a computer or DAW | read/capture until the DAW records |
| USB audio in | host -> EP-133 | feed host audio to EP-133; select USB as sampling source when sampling | sampling writes a sound and needs a human gate |
| USB MIDI | either direction | notes, clock, transport, control | messages may trigger actions; review mappings |
| EP sample tool | file/data transfer | sample management and project backup/restore | writes/restores device content; human gate |
| USB power | host/charger -> EP-133 | power | not an audio or data claim |

Sample transfer is not audio streaming. MIDI is not audio. USB audio in and out
are separate endpoint directions. State the intended lane every time.

## 公式「tects tools」の完成プロジェクトを試す

[公式告知（2025-07-01）](https://teenage.engineering/now/2025#:~:text=tects%20tools)のサンプル集（ZIP）とは別の **EP project** を選ぶ。
完成構成はAがドラム、Bがパーカッション（各scenes 1–3）、Cがサイドチェイン済みループ、Dが声とギター。
以下は手動手順の記録で、実機転送・試奏・別PC確認は未実施。USB AudioやDAWは転送の前提ではない。

1. 配布物をrepo外へ保存し、ファイルの実体・必要容量を確認する。音源や配布バイナリをGitへ追加しない。
2. どちらのPCでもデータ対応USB-CケーブルとデスクトップのChrome／EdgeなどWeb MIDI対応ブラウザを使い、
   [EP sample tool](https://teenage.engineering/apps/ep-sample-tool)で本体の認識と空き容量を確認する。
   認識できなければ転送せず止める。
3. `Backup & Restore`の`System`で本体全体のバックアップを取得し、ローカル・非公開共有ストレージなど
   **repo外**へ保全する。保存ファイルの存在を確かめてから先へ進む。
4. `Backup & Restore → Projects`で、**使用中でないと現物確認できたproject番号だけ**を選び、
   `Upload`で完成EP projectを入れる。告知の“new project”は空き枠へ入れる手順として扱う。
   [公式サポート](https://support.teenage.engineering/hc/en-us/articles/11639171890204-how-to-use-the-EP-sample-tool)のとおり、
   Uploadは選択枠を書き換える操作で、空き枠の自動選択ではない。

**空きが不明、既存データへの上書きになる、認識に失敗する場合は中止する。**
取り込みにFactory ResetやSystem復元を使わない。バックアップがあるだけで上書きを承認したことにしない。

手動チェック（すべて未実施）:

- [ ] 取り込んだ枠でScene 1のPLAYを確認する。
- [ ] Aを鳴らしたままBのパターンを切り替え、組み合わせを聴く。
- [ ] 再生を止めて同一本体を別PCへ差し替え、同じproject番号・音を確認する（再Uploadしない）。

自作素材はこの完成projectとは別の未使用枠で扱う。完成mixのステレオWAV 1本と、別パッドで足す音は区別する。
元マルチトラックがある場合は同じ開始位置・同長のステムを別に用意できるが、完成mixから元マルチが戻るとはしない。
小WAVの準備は[既存の転送パック導線](WORKER-GAMING-RUNBOOK.md#standard-jobs)を使う。
個人のPC名・資産名・Drive URL・実配線や音源は、この公開手順へ記録しない。

## Capture choices

### USB audio capture candidate

```text
EP-133 USB audio output
  -> verified host input endpoint
  -> DAW audio track
```

This is current manufacturer-documented capability. It becomes a usable DAW
route only after the current host proves the endpoint and driver combination.
A DAW may not be able to take EP-133 USB input while using a different ASIO
interface for output; verify rather than assuming multi-device support.

### Analog fallback/capture route

```text
EP-133 3.5 mm stereo output
  -> suitable stereo breakout cable
  -> verified interface stereo line inputs
  -> DAW stereo track
```

Keep this route as a fallback and as an intentional analog capture option. The
operator must confirm the cable, input pair, gain, monitor level, and clipping.

## Public-safe workflow

### 1. Prepare outside Git

Generate or collect short candidate material under a repo-external worker
directory. The preparation step may create a naming sheet, conversion report,
and suggested pad map, but it must not write to EP-133.

### 2. Review the transfer boundary

Before opening the sample tool:

1. confirm which EP-133 project/group/pads are in scope;
2. decide whether a backup is required;
3. verify that each file is authorized and stored outside Git;
4. keep the first transfer deliberately small;
5. let the operator approve the browser/device permission and the actual write.

### 3. Perform on-device variation

Chop, sequence, resample, and use performance effects by hand. Do not automate
pad, fader, project, or firmware changes from repository tooling.

### 4. Capture to a DAW

Inspect current endpoints and DAW settings first. Prefer the verified USB audio
route when the host supports the required input/output combination; otherwise
use the analog fallback. Do not copy exact driver settings from an old machine
snapshot.

### 5. Review in Band Room

Export a review take outside Git and load it through Band Room's existing
external-file workflow. Do not change default playback or presets. Promote
only the reusable timing, texture, or process observation—not the recording or
private route.

## What repo automation may do

- inspect device and endpoint visibility read-only;
- prepare transfer files and reports outside Git;
- generate a suggested pad map;
- prepare a DAW/Band Room handoff checklist;
- compare current observations with a private routing profile;
- open a tool or report without granting permissions or writing the device.

## Human gates

- identifying the physical unit and installed OS;
- cable, power, gain, monitor volume, and ear checks;
- browser device permission;
- project backup/restore;
- sample transfer and pad assignment;
- firmware update;
- DAW record-arm and recording;
- choosing the take that sounds good.

## Verification record

Keep `documented_proposed` separate from `verified_on_device`. A complete
private verification record should include:

- installed EP-133 OS and observation date;
- Windows endpoint names and audio directions;
- DAW driver/input/output behavior;
- selected USB or analog lane;
- cable and physical constraints;
- whether EP-133 needed any setting change;
- audible result and operator;
- rollback steps.

If the private overlay is unavailable, do not invent those fields.

## Troubleshooting

- USB supplies power but no endpoints appear: verify a data-capable cable and
  direct connection, then recheck the host.
- USB MIDI appears but audio does not: confirm the installed EP-133 OS and look
  separately for audio input/output endpoints.
- Host audio does not reach EP-133 sampling: select EP-133 as the host output,
  then select USB as the sampling source on the device under a human gate.
- DAW cannot combine EP-133 input with another interface output: use one
  supported driver path or the analog fallback; do not force an undocumented
  aggregate setup.
- No analog capture: check the stereo breakout, line-input pair, DAW input, and
  operator-controlled gain.
- Sample tool does not see the device: check browser permission and cable, but
  do not retry writes blindly.

## Official references

- Current EP-133 guide:
  <https://teenage.engineering/guides/ep-133>
- OS 2.5 changes:
  <https://teenage.engineering/guides/ep-133/whats-new>
- USB audio sampling direction:
  <https://teenage.engineering/guides/ep-133/how-to>
- Hardware overview and USB audio output:
  <https://teenage.engineering/guides/ep-133/hardware-overview>
- Current downloads/releases:
  <https://teenage.engineering/downloads/ep-133>
- EP sample tool:
  <https://teenage.engineering/apps/ep-sample-tool>
