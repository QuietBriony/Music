// Mount the complete phrase once; moving the viewport never replaces notes.
export function mountScoreStrip(viewport){
 let previous=null,grid=null,anchor=null;
 function place(index,smooth=true){
  const cell=grid?.children[index];if(!cell)return;
  const right=viewport.getBoundingClientRect().right-viewport.clientLeft-4;
  const left=viewport.scrollLeft+cell.getBoundingClientRect().right-right;
  viewport.scrollTo({left,behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
 }
 let lastIndex=0;
 new ResizeObserver(()=>{if(grid?.isConnected)place(lastIndex,false);}).observe(viewport);
 return{update({notes,current,accepted,start,end,page}){
  const fresh=previous!==notes||!viewport.contains(grid);
  if(fresh){
   previous=notes;anchor=null;grid=document.createElement('div');grid.className='kunkun kunkun-strip';
   notes.forEach((n,i)=>{const b=document.createElement('button'),s=document.createElement('small');b.dataset.index=i;b.append(n.symbol);s.textContent=`${i+1}${Number.isFinite(n.beats)?` · ${Number(n.beats.toFixed(2))}拍`:''}`;b.append(s);b.setAttribute('aria-label',`${i+1}音目 ${n.symbol} ${n.position}`);grid.append(b);});
   viewport.replaceChildren(grid);
  }
  for(const [i,cell] of [...grid.children].entries()){
   cell.classList.toggle('current',i===current);cell.setAttribute('aria-current',String(i===current));
   cell.classList.toggle('passed',i<accepted);cell.classList.toggle('outside',i<start||i>=end);
  }
  const column=page===null?Math.max(0,Math.floor(current/3)-1):page*2;
  if(anchor!==column){lastIndex=column*3;place(lastIndex,!fresh);anchor=column;}
 }};
}
