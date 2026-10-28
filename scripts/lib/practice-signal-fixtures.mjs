import {frequencyFor} from '../../practice/music.mjs';
export function spectrum(midis,sampleRate=48000,{detune=0,harmonics=[1,.5,.26,.14,.08,.04,.02],noise=0}={}){
 const size=16384,re=new Float64Array(size),im=new Float64Array(size);let seed=34;
 for(let i=0;i<size;i++){
  let value=0;for(let j=0;j<midis.length;j++){const f=frequencyFor(midis[j])*2**(detune/1200);for(let h=0;h<harmonics.length;h++)value+=Math.sin(2*Math.PI*f*(h+1)*i/sampleRate+j*.41)*harmonics[h]/midis.length;}
  seed=(seed*1664525+1013904223)>>>0;value+=(seed/2**32-.5)*noise;
  re[i]=value*(.42-.5*Math.cos(2*Math.PI*i/size)+.08*Math.cos(4*Math.PI*i/size));
 }
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
 for(let length=2;length<=size;length*=2)for(let base=0;base<size;base+=length)for(let j=0;j<length/2;j++){
  const angle=-2*Math.PI*j/length,c=Math.cos(angle),s=Math.sin(angle),a=base+j,b=a+length/2,tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;
  re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
 }
 return Float32Array.from({length:size/2},(_,i)=>20*Math.log10(Math.max(1e-12,Math.hypot(re[i],im[i])/size)));
}
