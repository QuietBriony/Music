// Each note is bound to its exact lyric text, so edited lyrics cannot inherit a stale meaning.
export function normalizeLyricNotes(notes,lines){
 return lines.map((text,i)=>{
  const note=Array.isArray(notes)?notes[i]:null;
  const clean=value=>typeof value==='string'?value.slice(0,2000):'';
  return note?.text===text?{text,reading:clean(note.reading),meaning:clean(note.meaning),words:clean(note.words)}:{text,reading:'',meaning:'',words:''};
 });
}
export function readParallelNotes(lines,reading,meaning){
 const column=(value,label)=>{
  if(typeof value!=='string'||value.length>20000)throw new Error(`${label}は2万字までです。`);
  if(!value.trim())return lines.map(()=>'');
  const rows=value.replace(/\r/g,'').split('\n').map(s=>s.trim());
  if(rows.length!==lines.length)throw new Error(`${label}は歌詞と同じ${lines.length}行にしてください。空行で省略できます。`);
  if(rows.some(s=>s.length>2000))throw new Error(`${label}は1行2000字までです。`);
  return rows;
 };
 const readings=column(reading,'読み方'),meanings=column(meaning,'意味');
 return lines.map((text,i)=>({text,reading:readings[i],meaning:meanings[i],words:''}));
}
