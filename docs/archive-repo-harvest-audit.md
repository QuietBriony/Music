# Archive Repo Harvest Audit

## 1. Purpose

`chill` / `test` / `namima-lab` は archive / staging候補として整理済みだが、  
実際に拾える設計は harvest して Music stack の将来実装に転記する。  

- 音源や sample は移植しない。  
- 保存対象は design pattern / production idea / interaction model。  
- runtime code は無検証のままコピーしない。

## 2. chill harvest

### 観測

- Chill v2.3 / Cyber-Zen Pro  
- Tone.js  
- START / STOP / ACID / AUTO  
- Energy / Creation / Nature faders  
- piano sampler / pad / acid bass / kick / hat  
- Cyber-Zen canvas rings  

### 拾うもの

- 3 macro fader model: Energy / Creation / Nature  
- Acid toggle as performative state  
- piano-like melodic layer as design reference  
- Cyber-Zen visual mood  
- simple public UI compactness  

### 拾わないもの

- external piano sample URLs  
- audio files  
- sample-based implementation  
- direct code copy into Music engine  

### Music への翻訳

- Nature macro could inform Wave / Circle / Observer interaction  
- Acid toggle could inform future PUNCH / REPEAT mode  
- Piano-like layer should be recreated with synth/pluck, not samples  

### namima への翻訳

- calm melodic ambient / simple controls / public-friendly UI  

## 3. test harvest

### 観測

- UCM Mandala Engine – Style Blend  
- Style fader: Ambient ⇄ Lo-Fi ⇄ Goa ⇄ HardTechno  
- Energy / Creation / Void faders  
- style archetype blending  
- 16step probability pattern interpolation  
- BPM / swing / distortion blending  
- sample fallback pattern references  

### 拾うもの

- continuous style blend fader  
- archetype interpolation  
- pattern probability blending  
- style label + BPM label  
- Ambient → Lo-Fi → Goa → HardTechno as transition model  

### 拾わないもの

- sample references  
- hard techno defaults as Music baseline  
- direct runtime copy without review  

### Music への翻訳

- future preset morph / reference morph system  
- style blend could map reference profiles into engine targets  
- candidate for preset translation schema implementation  

### drum-floor への翻訳

- pattern probability blending can inform groove profile generator  

## 4. namima-lab harvest

### 観測

- patch selector: A-min stable / v2 / v3 / v4  
- p5.js particle field  
- tap-to-start iOS safe overlay  
- touch ripple -> particle source  
- particle energy -> audio modulation  
- PolySynth pad + PluckSynth  
- noteFromX mapping  
- filter/reverb/master/limiter  

### 拾うもの

- patch selector / lab variants  
- touch ripple -> audio energy  
- x-position -> note selection  
- PluckSynth organic texture  
- particle field as modulation source  
- iOS safe start overlay  
- ambient interaction model  

### 拾わないもの

- direct p5 dependency in Music  
- uncontrolled visual runtime  
- runtime code copy without review  

### Music への翻訳

- organic pluck / acoustic illusion layer  
- gesture-to-note mapping for future performance pad mode  
- visual energy as non-audio control source  

### namima への翻訳

- primary candidate for public ambient interaction  
- water/ripple UI metaphor  
- gentle tap-to-sound interface  

## 5. Priority

### High

- namima-lab touch ripple -> namima future runtime  
- test style blend -> Music preset morph  
- chill macro faders -> Music/namima simplified controls  

### Medium

- chill acid toggle -> Music punch / repeat inspiration  
- namima-lab PluckSynth -> Music organic texture layer  
- test pattern interpolation -> drum-floor generator  

### Low / do not copy

- external samples  
- CDN sample instruments  
- hard techno sample references  
- direct visual dependency migration  

## 6. Archive rule

- `chill` / `test` can remain archive candidates after harvest docs.  
- `namima-lab` should remain staging/reference until namima interaction direction is decided.  
- archive means *not primary runtime*, not “no value”.

## 7. Next suggested PRs

- Music: docs: add preset morph design from test style blend  
- namima: docs: add ripple interaction design from namima-lab  
- Music: feat later with 5.5 high: pad signature + organic pluck layer  
- drum-floor: docs/runtime design using pattern probability blending  
