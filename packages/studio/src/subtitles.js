import {sceneTimeline} from './project.js';
function stamp(ms,srt=false){const total=Math.round(ms),h=Math.floor(total/3600000),m=Math.floor(total/60000)%60,s=Math.floor(total/1000)%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+(srt?',':'.')+String(total%1000).padStart(3,'0');}
export function exportSubtitles(project,{trackId=project.captionTrack,format='vtt'}={}){
  if(!['vtt','srt'].includes(format))throw new Error('Choose WebVTT or SRT.');
  const track=project.tracks.find(t=>t.id===trackId&&t.kind==='captions');if(!track)throw new Error('Caption track is missing.');
  const offsets=new Map(sceneTimeline(project).map(s=>[s.id,s.startMs]));
  const cues=track.clips.map(c=>({...c,start:offsets.get(c.sceneId)+c.startMs})).sort((a,b)=>a.start-b.start);
  const escape=text=>{const escaped=text.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/\r/gu,'');if(/\n\s*\n/u.test('\n'+escaped+'\n'))throw new Error('Blank lines cannot be represented inside a subtitle cue. Edit the line breaks before export.');return escaped;};
  return {text:(format==='vtt'?'WEBVTT\n\n':'')+cues.map((c,i)=>(format==='srt'?i+1:c.id)+'\n'+stamp(c.start,format==='srt')+' --> '+stamp(c.start+c.durationMs,format==='srt')+'\n'+escape(c.text)+'\n').join('\n'),warnings:['Text and timing only. Studio font, position, animation, and word highlighting are not embedded.']};
}
export function parseSubtitles(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)throw new Error('Subtitle file limit is 256 KiB.');
  const blocks=text.replace(/^\uFEFF/u,'').replace(/\r\n?/gu,'\n').trim().split(/\n\s*\n/gu),cues=[];
  const parse=s=>{const m=/^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/u.exec(s);if(!m||+m[2]>59||+m[3]>59)throw new Error('Invalid subtitle time.');return ((+(m[1]||0)*60 + +m[2])*60 + +m[3])*1000 + +m[4];};
  for(const block of blocks){if(block==='WEBVTT')continue;const lines=block.split('\n'),line=lines.findIndex(l=>l.includes('-->'));if(line<0||line>1)throw new Error('Unsupported subtitle block. Use plain timed text.');const m=/^(\S+)\s+-->\s+(\S+)\s*$/u.exec(lines[line]);if(!m)throw new Error('Subtitle layout settings are not supported by this importer.');const startMs=parse(m[1]),endMs=parse(m[2]),raw=lines.slice(line+1).join('\n');if(raw.includes('<'))throw new Error('Styled subtitle markup is not supported; import plain text.');const content=raw.replace(/&lt;/gu,'<').replace(/&gt;/gu,'>').replace(/&amp;/gu,'&');if(endMs<=startMs||!content.trim()||content.length>4000||cues.length>=1000)throw new Error('Invalid or oversized caption.');cues.push({startMs,endMs,text:content});}
  if(!cues.length)throw new Error('No subtitle cues found.');cues.sort((a,b)=>a.startMs-b.startMs);for(let i=1;i<cues.length;i++)if(cues[i].startMs<cues[i-1].endMs)throw new Error('Overlapping subtitle cues require separate tracks.');return cues;
}
