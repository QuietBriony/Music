# Listening Loop v1 — attribution and modifications

## Circuit DATA (not source code)

`circuit.json` is an unmodified byte-for-byte copy of:

https://raw.githubusercontent.com/Apolotary/fly-lab/631ada7f1e074581ac986e91c7e68ad7074fedb1/data/locomotor_circuit.json

1076374 bytes; SHA-256:
`8f76d94034dcf802453e3a0a8ed5342d122e57d37e2bb5ea28da66de0856f5d6`.

License: Creative Commons Attribution 4.0 International (CC BY 4.0).
Full terms: https://creativecommons.org/licenses/by/4.0/legalcode

Credit: MaleCNS collaboration — FlyEM at HHMI Janelia, University of Cambridge,
MRC Laboratory of Molecular Biology, Google Research.
Dataset: MaleCNS v1.0, male Drosophila melanogaster.
Dataset homepage: https://male-cns.janelia.org/download/

Extraction and original provenance: Denis Shiryaev / DesktopFly,
commit `32b00011e83c3dc85fa3ea0b3934155b04f1635d`.
Distribution source: Apolotary / Fly Lab,
commit `631ada7f1e074581ac986e91c7e68ad7074fedb1`.
Source notices: https://github.com/Apolotary/fly-lab/blob/631ada7f1e074581ac986e91c7e68ad7074fedb1/THIRD_PARTY_NOTICES.md

Data modifications: none. Music's `model.mjs` independently normalizes incoming
weights in memory, applies its own discrete-time recurrent dynamics, assumed
stimuli and fatigue, and maps motor readouts to original musical events.
The connection signs are modeling assumptions described in the source data.
This is a locomotor subset, not a whole brain or a validated physiological model.
Neither the dataset creators nor the extraction/distribution authors endorse Music.
No DesktopFly or Fly Lab source code is included.

## Existing Music runtime dependency

Tone.js 14.8.49, MIT, Yotam Mann and contributors.
Loaded only after a Play tap from https://unpkg.com/tone@14.8.49/build/Tone.js .
License: https://github.com/Tonejs/Tone.js/blob/e55cb153d33adcbef29eb3efebd762f361d6b332/LICENSE.md
Exact dependency record: `config/external-dependencies.json`, `tonejs-runtime`.
No sample files, recordings, lyrics, or new synthesis libraries are included.
