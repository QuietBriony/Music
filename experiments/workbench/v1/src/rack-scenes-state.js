// Small, portable tone scenes. Scores, levels, tempo and lock maps stay outside.
const synth={cutoff:100,reso:15,env:100,decay:100,delayWet:100};
export const SCENE_TONES={tb303_1:synth,tb303_2:synth,
  bd:{tune:100,attack:100,decay:100},sd:{tune:100,tone:100,snappy:100},
  lt:{tune:100,decay:100},mt:{tune:100,decay:100},ht:{tune:100,decay:100},
  rs:{},cp:{decay:100},ch:{ch_tune:100,ch_decay:100},oh:{oh_tune:100,oh_decay:100},
  cr:{cr_tune:100},rd:{rd_tune:100}};
export const MACROS=[
  {id:'hard',title:'硬さ',help:'303の明るさ・共鳴、キックの硬さ、スネアのざらつき',targets:[
    ['tb303_1','cutoff',20,80],['tb303_2','cutoff',20,80],['tb303_1','reso',2,10],['tb303_2','reso',2,10],['bd','attack',20,70],['sd','snappy',20,80]]},
  {id:'motion',title:'うねり',help:'303のうねりの深さ・長さ、閉／開ハットの余韻',targets:[
    ['tb303_1','env',20,80],['tb303_2','env',20,80],['tb303_1','decay',15,70],['tb303_2','decay',15,70],['ch','ch_decay',15,55],['oh','oh_decay',20,65]]},
  {id:'space',title:'空間',help:'2台の303のディレイ量。音量・ディレイ時間はそのまま',targets:[['tb303_1','delayWet',0,40],['tb303_2','delayWet',0,40]]},
];
const fail=()=>{throw new Error('音色の場面データが不正です。保存元のアプリで確認してください。');};
export function normalizeSceneTones(value) {
  if(!value || typeof value!=='object')fail();
  return Object.fromEntries(Object.entries(SCENE_TONES).map(([unit,fields])=>{
    const source=value[unit],out={};if(!source||typeof source!=='object')fail();
    for(const [key,max] of Object.entries(fields)) {
      const v=source[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)fail();out[key]=v;
    }
    if(unit.startsWith('tb303')) {if(!['sawtooth','square'].includes(source.waveform))fail();out.waveform=source.waveform;}
    return [unit,out];
  }));
}
export function emptyRackScenes() {return {version:1,slots:Array(8).fill(null),auto:{enabled:false,bars:8}};}
export function normalizeRackScenes(value) {
  if(!value||value.version!==1||!Array.isArray(value.slots)||value.slots.length!==8
    ||typeof value.auto?.enabled!=='boolean'||![4,8,16].includes(value.auto.bars))fail();
  const slots=value.slots.map(slot=>{
    if(slot===null)return null;
    if(typeof slot?.name!=='string'||slot.name.length>48||!slot.name.trim())fail();
    return {name:slot.name,tones:normalizeSceneTones(slot.tones)};
  });
  if(value.auto.enabled&&slots.filter(Boolean).length<2)fail();
  return {version:1,slots,auto:{enabled:value.auto.enabled,bars:value.auto.bars}};
}
