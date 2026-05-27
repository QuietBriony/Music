# Band Room AI Recreation Export

## 目的

AI 再現ルートは、vocal stem に吸われた伴奏成分を原音から復旧するのではなく、
Band Room の drum frames / chord progression / sample kit から演奏を再構築します。
そのため、成果物は `repaired` ではなく `ai_recreation` として扱います。

このルートの主目的は次の 2 つです。

1. vocal OFF で原音 stem に穴が出る曲でも、独立した karaoke / drums / bass / other を試聴できること。
2. Band Room runtime の AI 再現ロジックを、mp3 stem として数値確認できること。

## Human Fly パイロット

Tabasco / Human Fly は、現測定で vocal OFF 時の中域欠けが目立つため、
AI 再現ルートの先行パイロットにします。

```powershell
python -X utf8 scripts/render-bandroom-ai-recreation.py tabasco human-fly `
  --output-root "C:\Users\平成造園\Desktop\bandroom-ai-recreation"
```

試聴用に Desktop へ出す場合の出力先:

```text
C:\Users\平成造園\Desktop\bandroom-ai-recreation\tabasco\human-fly\
```

Band Room の `stem source` selector から直接 A/B する場合は、同じ renderer を
repo 内の ignored preview mount へ出します。

```powershell
python -X utf8 scripts/render-bandroom-ai-recreation.py tabasco human-fly
```

この場合の出力先:

```text
presets/ai-recreation-stems/tabasco/human-fly/
```

主な出力:

- `drums.mp3`
- `bass.mp3`
- `other.mp3`
- `mix.wav`
- `ai-recreation-report.json`
- `ai-recreation-notes.md`

`mix.wav` は `scripts/compare-capture.py` に直接渡せます。

生成 mp3/wav は私的な試聴/検証用で、repo には追加しません。
`presets/ai-recreation-stems/` は `.gitignore` で除外し、本番 runtime からは
存在すれば読み、なければ original stem に fallback します。

## 試聴方法

Band Room runtime で AI 再現そのものを聴く場合は `AI 再現` モードを使います。
mp3 stem として A/B する場合は `原音 stems` モードで Human Fly を開き、
`stem source` を `AI recreation` にします。
Desktop 出力だけで試す場合は、external drums / bass / other に各 stem を読み込みます。

この A/B は「原音から戻せたか」ではなく、「vocal OFF の穴を避ける別演奏として使えるか」を見るためのものです。

## 判定メモ

Human Fly の現パイロットでは、hybrid/repaired ルートは Demucs no-vocals と相関が高く、
vocal-active 区間の body / presence 欠けを十分に直せませんでした。

AI recreation は別演奏なので原音 karaoke との相関は低い一方、
vocal-active 区間の帯域落ち込みは body / presence ともにプラス側へ戻っています。
この性質が、Band Room に統合する価値のあるルートです。

## 統合方針

- 既存 stems は上書きしない。
- 生成 mp3 は repo 外へ出す。
- runtime 統合は `stems_variants.ai_recreation` と `stem source` selector に限定する。
- 欠けた AI recreation stem は original に fallback する。
- `scripts/check-band-room-logic.mjs` で offline renderer の存在と主要 marker を見る。
- 試聴で良ければ、renderer で効いた density / timing / voicing を `band-room.js` の AI agents に戻す。
- runtime から mp3 export する UI は、パイロット試聴後に必要性が残った場合だけ追加する。
