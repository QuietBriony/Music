import { SANSHIN_POSITIONS, sanshinPosition, neckY, positionTip } from './sanshin-core.mjs?v=22';
const xFor = string => 42 + (3-string)*48;
export function neckDiagram(symbol) {
  const p=sanshinPosition(symbol);if(!p)return '';
  const label=`${p.symbol}（${p.reading}）。${p.position}。${p.finger?'色の点を押さえます。':'左手は押さえません。'}`;
  return `<svg class="sanshin-neck" viewBox="0 0 245 255" role="img" aria-label="${label}">
    <text x="90" y="14" text-anchor="middle" class="neck-direction">↑ 糸巻き側</text>
    <rect x="23" y="49" width="134" height="180" rx="7" fill="#ede4d2"/>
    ${[3,2,1].map(s=>`<text x="${xFor(s)}" y="36" text-anchor="middle">${['','女弦','中弦','男弦'][s]}</text><path d="M${xFor(s)} 52V229" stroke="${p.string===s?'#276652':'#a09886'}" stroke-width="${p.string===s?3:1.5}"/>`).join('')}
    <path d="M23 55H157" stroke="#5a6356" stroke-width="4"/>
    ${[2,4,5,7,9].map(f=>`<path d="M23 ${neckY(f)}H157" stroke="#bdb7a9" stroke-dasharray="2 5"/><text x="169" y="${neckY(f)+4}" class="neck-label">${SANSHIN_POSITIONS.filter(n=>n.fret===f&&!n.symbol.includes('♭')).map(n=>n.symbol).join('・')}</text>`).join('')}
    <circle class="neck-target" cx="${xFor(p.string)}" cy="${p.fret?neckY(p.fret):55}" r="15" fill="${p.finger?'#276652':'#fffdf8'}" stroke="#276652" stroke-width="2"/>
    <text x="${xFor(p.string)}" y="${(p.fret?neckY(p.fret):55)+5}" text-anchor="middle" fill="${p.finger?'white':'#276652'}" font-size="15" font-weight="bold">${p.finger||'○'}</text>
    <text x="90" y="249" text-anchor="middle" class="neck-direction">↓ 胴の方</text>
  </svg>`;
}
export function handDiagram(symbol) {
  const p=sanshinPosition(symbol);if(!p)return '';
  return `<svg class="sanshin-hand" viewBox="0 0 210 235" role="img" aria-label="左手の手のひら側。${p.finger?p.fingerName+'を使います':'開放弦なので押さえません'}">
    <path d="M65 215Q43 185 40 151L31 99Q31 82 42 82Q52 82 54 98L61 132V59Q61 45 73 45Q84 45 84 59L88 125V37Q88 23 100 23Q112 23 112 37L115 122V48Q115 34 127 34Q139 34 139 48L142 139L160 115Q169 104 179 111Q189 118 180 132L157 178Q148 197 143 215Z" fill="#ead6c1" stroke="#a68b70" stroke-width="2"/>
    ${[[4,43,99],[3,73,62],[2,100,40],[1,127,52]].map(([f,x,y])=>`<circle cx="${x}" cy="${y}" r="13" fill="${f===p.finger?'#276652':'#f5f0e6'}"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="${f===p.finger?'white':'#555f52'}">${f}</text>`).join('')}
  </svg>`;
}
export function renderSanshinTarget(container, note, next, done=false) {
  const p=sanshinPosition(note?.symbol), n=sanshinPosition(next?.symbol);
  const key=`${p?.symbol}|${n?.symbol}|${done}`;
  if(container.dataset.key===key)return;container.dataset.key=key;
  if(!p){container.replaceChildren();return;}
  container.innerHTML=`<div class="sanshin-now"><span>${done?'最後に弾いた音':'いま押さえる位置'}</span><strong>${p.symbol}<small>${p.reading}</small></strong><b>${p.position}</b></div><div class="sanshin-diagrams">${neckDiagram(p.symbol)}<div class="sanshin-next"><span>次の音</span><strong>${n?.symbol||'—'}</strong><p>${n?.position||(done?'できました':'ここまで')}</p>${n?neckDiagram(n.symbol):''}</div></div><p class="sanshin-tip">${positionTip(p)}</p>`;
}
