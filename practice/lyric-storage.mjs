// Digests of unchanged v43 bundled copies, without retaining old lyric text.
// Used only to migrate those copies; actual personal edits are never replaced.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function packLyricRecord(preset,{text,cues,notes,follow,manualLine}){
 const position={version:2,follow,manualLine,syncVersion:preset?.syncVersion||0};
 if(preset&&text===preset.text&&equal(notes,preset.notes||[]))return {...position,preset:true,...(!equal(cues,preset.cues||[])?{cues}:{})};
 return {...position,text,cues,notes};
}
// Old copies contain no provenance flag. Only a byte-for-byte known bundled
// text AND annotation signature can become a reference. Personal cues survive.
export async function migratePresetCopy(key,stored,preset,history=LEGACY_PRESET_COPIES){
 const known=history[key];
 if(!known||stored?.preset===true||typeof stored?.text!=='string'||!Array.isArray(stored.notes))return stored;
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(await digest([stored.text,stored.notes])!==known.content)return stored;
 const personalCues=Array.isArray(stored.cues)&&await digest(stored.cues)!==known.cues;
 return {version:2,preset:true,follow:stored.follow,manualLine:stored.manualLine,syncVersion:preset?.syncVersion||stored.syncVersion||0,...(personalCues?{cues:stored.cues}:{})};
}
export const LEGACY_PRESET_COPIES={
  "song:tsukinu": {
    "content": "c8a737a7e388893efae2dea099bb74e9ebfc5dd13493bf56832db4d8529f0b12",
    "cues": "612e5929f824809f912c27d0be57f4d4f8d1e50470dd65dbb7689c392098d8fc"
  },
  "song:tinsagu": {
    "content": "9cba69d9d9ccc2ee0d4c78c411f247777114f25d29fc9d455f12928cee6743ae",
    "cues": "1b5093ed61fac33888ab7ab291ae376f66d222cb992ea39054ae89e0305fa858"
  },
  "song:amazing-grace": {
    "content": "8ba87fd1d2677be54c70394d92bffd2e72eec4ae117cb928b5a83dd0048fa029",
    "cues": "e6e3ee0c9d48fd0f6d798a1a498d8042a7425afcfcea65436a95251d8e948e68"
  },
  "song:twinkle": {
    "content": "6c80d30044152b0dfddf95dec3ad65f8528c079378208e714f4a8cac7f62af7d",
    "cues": "c9035917b506823852e90237e3dcc77c01d5ae227da255506512dc66615ae612"
  },
  "song:tinsagu:verse:2": {
    "content": "a1160fa60ee8dc6ce58c06b074312a16f1ec1e3fdd9cc448665d5c63af653494",
    "cues": "1b5093ed61fac33888ab7ab291ae376f66d222cb992ea39054ae89e0305fa858"
  },
  "song:tinsagu:verse:3": {
    "content": "ba9f1a58791c4d126630c99e9e3a54be7498195a336e99b5d69aff2c3c2c69ea",
    "cues": "1b5093ed61fac33888ab7ab291ae376f66d222cb992ea39054ae89e0305fa858"
  },
  "song:tsukinu:verse:2": {
    "content": "0d6662fb9243af99873ed700b4b51223a73d19634d044f6e265eb3dbdb74d75f",
    "cues": "612e5929f824809f912c27d0be57f4d4f8d1e50470dd65dbb7689c392098d8fc"
  },
  "song:tsukinu:verse:3": {
    "content": "ab7a649f5a68929cd8d9666ba6ac97e9696475cc1fc7797b0c27dc7f2b3cdc34",
    "cues": "612e5929f824809f912c27d0be57f4d4f8d1e50470dd65dbb7689c392098d8fc"
  },
  "song:aha": {
    "content": "b8fe6a9b29407a83c7ff7858aa29f685a5fd6a8577f20be91b4bec49f640f724",
    "cues": "3191fcb2210dd81acb44787b4566f81e9fef8e0a802ece0bba769e0220ba0820"
  },
  "video:sanshin:akata": {
    "content": "f734953661ce6e060c5415caf4e42a2caee6afb7692979b4dba883421b19981a",
    "cues": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  },
  "video:sanshin:tancha": {
    "content": "57dabaf8862a9a0e90bf856ed4d18700f5f256e8e85649c02e13be7f1d16cbe7",
    "cues": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
  }
};
