import { CHORDS } from './chords.mjs?v=28';
import { SING_SHAPES } from './singalong-core.mjs?v=28';
import { SMALL_GRIPS,FINGER_NAMES,fingerSteps,soundingStrings } from './hand-guide-core.mjs?v=28';
export const FINGER_COLORS=['','#245f9a','#915100','#804ba1','#14776f'];
export const guitarShape=(name,easy=true)=>easy?(SMALL_GRIPS[name]||SING_SHAPES[name]):CHORDS[name];
export const fingerLines=shape=>shape?fingerSteps(shape):[];
export function strumInstruction(shape){
 const strings=shape?soundingStrings(shape):[];if(!strings.length)return 'ここは弾かずに待ちます。';
 return `${strings[0]}弦から${strings.at(-1)}弦へ、下向きにジャーン。×の弦は弾きません。`;
}
export function drawChord(name,shape){
 if(!shape)return null;const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 180 164');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${name}の押さえ方。左が太い6弦、右が細い1弦。色と数字は左手の指。`);
 const add=(tag,attrs,value)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(value!==undefined)e.textContent=value;svg.append(e);};
 for(let i=0;i<6;i++){const x=28+i*25;add('line',{x1:x,x2:x,y1:32,y2:136});add('text',{x,y:156},6-i);}
 for(let f=0;f<=6;f++)add('line',{x1:28,x2:153,y1:32+f*17.3,y2:32+f*17.3,class:f===0?'nut':''});
 const b=fingerLines(shape).find(s=>s.barre)?.barre;if(b)add('line',{x1:28+(6-b.from)*25,x2:28+(6-b.to)*25,y1:32+(b.fret-.5)*17.3,y2:32+(b.fret-.5)*17.3,class:'barre',style:`stroke:${FINGER_COLORS[1]}`});
 shape.frets.forEach((f,i)=>{const x=28+i*25;if(f<=0)add('text',{x,y:21},f<0?'×':'○');else{const y=32+(f-.5)*17.3;add('circle',{cx:x,cy:y,r:8,style:`fill:${FINGER_COLORS[shape.fingers[i]]}`});add('text',{x,y:y+3.5,class:'finger'},shape.fingers[i]);}});return svg;
}
export function fillFingerList(host,shape){
 host.classList.add('chord-finger-list');host.replaceChildren(...fingerLines(shape).map(s=>{const li=document.createElement('li'),badge=document.createElement('b'),words=document.createElement('span');badge.textContent=s.finger;badge.style.background=FINGER_COLORS[s.finger];words.textContent=s.barre?`${FINGER_NAMES[s.finger]}：${s.barre.fret}フレットで${s.barre.from}〜${s.barre.to}弦をまとめる。`:`${FINGER_NAMES[s.finger]}：${s.positions.map(p=>`${p.string}弦・${p.fret}フレット`).join('、')}`;li.append(badge,words);return li;}));
}
export function gripCard(name,shape){
 const host=document.createElement('div');host.className='chord-track-grip';host.dataset.chord=name;
 if(shape){host.append(drawChord(name,shape));const text=document.createElement('small');text.className='chord-finger-short';text.textContent=fingerLines(shape).map(s=>`${FINGER_NAMES[s.finger]}：${s.positions.map(p=>`${p.string}弦${p.fret}F`).join('・')}`).join('\n');host.append(text);}return host;
}
export function mountGuitarGuides(){
 const key='music-practice-guitar-guide-v1',controls=[...document.querySelectorAll('[data-guitar-guide-select]')],modes=['fingers','diagram','names'];let mode='fingers';try{const value=localStorage.getItem(key);if(modes.includes(value))mode=value;}catch{}
 const show=()=>{document.body.dataset.guitarGuide=mode;for(const select of controls)select.value=mode;};
 for(const select of controls)select.onchange=()=>{mode=modes.includes(select.value)?select.value:'fingers';try{localStorage.setItem(key,mode);}catch{}show();if(mode==='fingers')document.getElementById('sing-finger-details').open=true;};show();
}
