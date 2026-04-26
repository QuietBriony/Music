# Preset Translation Schema

## 1. Purpose

Music stack の Reference-Driven Generative Rig では、参照情報と聴感レビューを `preset`/`engine parameter` へ変換する前提で運用を進める。  
このドキュメントは、その変換設計の共通仕様（実装ではなく docs 専用）を固定する。

- reference は「コピー元」ではなく、**production parameter の情報源**として扱う。  
- 音源・サンプル・歌詞は保存しない。  
- このPRでは `engine.js` への接続は行わない。  

## 2. Input sources

- `references/apple-music-refs.json`
- `docs/reference-analysis-template.md`
- Music recorder の `m4a` 録音
- user taste notes
- manual production review

## 3. Translation dimensions

以下を固定的に扱う:

- `timbre`
- `rhythm`
- `space`
- `structure`
- `gesture`
- `safety`

## 4. Preset translation object

Translation は、参照メモを直接音楽へ実装するのではなく、まず以下のような中間オブジェクトとして定義する。  
将来 `engine_targets` の値を実行計画（preset/ノブ）へ翻訳する。

```json
{
  "id": "field_murk_xtal_like",
  "label": "Field Murk / Soft Glass",
  "source_refs": [
    "Aphex Twin - Xtal",
    "Aphex Twin - Tha"
  ],
  "taste_notes": [
    "soft haze",
    "rounded highs",
    "subtle pulse"
  ],
  "translation": {
    "timbre": {
      "low_mid": "muffled but not muddy",
      "bass": "soft unstable F#2/D3 area",
      "highs": "rounded transparent glass",
      "texture": "tape-like floor"
    },
    "rhythm": {
      "density": "quiet but audible",
      "microtiming": "drifted",
      "repeat": "rare short fragments"
    },
    "space": {
      "reverb": "wide but dark",
      "delay": "short resampled echoes",
      "void": "open space, not mute"
    },
    "structure": {
      "loop_feel": "hypnotic",
      "collapse_recover": "1-4 bar drift",
      "variation": "small parameter shifts"
    },
    "gesture": {
      "drift": "floating scatter",
      "repeat": "brief repeat visibility",
      "punch": "bounded body accent",
      "void": "transparent opening"
    }
  },
  "engine_targets": {
    "ucm_bias": {
      "energy": "medium_low",
      "wave": "medium_high",
      "mind": "medium",
      "creation": "medium_high",
      "void": "medium",
      "circle": "medium_high",
      "body": "medium",
      "resource": "medium",
      "observer": "medium_high"
    },
    "audio_targets": {
      "bass_cutoff": "rounded_lowpass",
      "glass_modulation": "soft",
      "texture_floor": "quiet_audible",
      "reverb_wet": "dark_medium",
      "repeat_density": "rare"
    }
  },
  "safety": {
    "no_samples": true,
    "no_lyrics": true,
    "no_audio_import": true,
    "requires_m4a_review_before_engine_change": true
  }
}
```

## 5. Engine mapping notes

本仕様はドキュメント定義であり、**直接実装ではない**。  

- `engine.js` に入れる前提は、必ず m4a review を通す。  
- `ucm_bias` は初期値設計・preset seed として参照可能。  
- `audio_targets` は将来、以下へ変換される前提:
  - cutoff / velocity / probability
  - delay / reverb / pad behavior

安全性は常に優先:

- master limiter
- bassBus
- recorder
- Start/Stop
- AutoMix
- DRIFT / REPEAT / PUNCH / VOID lifecycle

## 6. Preset families

初期候補（抽象名）:

- `field_murk_soft_glass`
- `transparent_idm_drift`
- `burial_rain_ghost`
- `boc_warped_memory`
- `autechre_broken_logic`
- `opn_chrome_hymn`

## 7. Validation workflow

1. reference intake
2. translation object draft
3. optional docs review
4. engine implementation PR is only for 5.5 high/xhigh
5. Pages で m4a 録音
6. audio review
7. small correction PR

## 8. What this PR does not do

- no runtime implementation
- no preset loader
- no engine.js change
- no audio import
- no external services
- no Apple Music API integration

## 9. Source mapping note

`source_refs` に artist / title のみを保持し、`preset` 名は作品名を直接使わない。  
つまり preset 名はコピー防止・再利用性を優先した抽象名へ統一する。
