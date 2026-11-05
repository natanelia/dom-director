#!/usr/bin/env python3
"""Build local placeholder narration and exact chapter boundaries. No network/TTS API."""
from pathlib import Path
import json, subprocess, tempfile, wave
ROOT=Path(__file__).resolve().parent
SCENES=[
 ('overview','The bigger picture','overview',1.0,'This looks like a product video. But every pixel you see belongs to a real, working interface.',None,False),
 ('signal','Find the signal','metrics',1.6,'Instead of pointing at everything, bring the important detail into focus. Your layout stays exactly where it was.','metrics',False),
 ('story','Follow the story','routes',1.65,'Now follow the route. The camera, captions, and simulated cursor all move together on one timeline.','routes',False),
 ('handoff','Take the wheel','review',1.85,'Here is the difference. This checkpoint is a real button. Take over, approve it, and make this story yours.','approve',True),
 ('possibility','Make it yours','approve',1.9,'Watch a story, try a task, or get step by step guidance. The interface never stops being an interface.','approve',False),
 ('outro','Still your app','overview',1.0,'No recording. No illusion. Just your product, with a little direction. What will you show next?',None,False)
]
def main():
    (ROOT/'assets').mkdir(exist_ok=True)
    scenes=[]; frames=[]; elapsed_frames=0; rate=None
    with tempfile.TemporaryDirectory() as td:
        for ident,title,target,zoom,text,cursor,gate in SCENES:
            wav=Path(td)/f'{ident}.wav'
            subprocess.run(['espeak','-v','en-us','-s','169','-p','44','-a','160','-w',str(wav),text],check=True)
            with wave.open(str(wav),'rb') as f:
                assert f.getnchannels()==1 and f.getsampwidth()==2
                if rate is None: rate=f.getframerate()
                assert rate==f.getframerate()
                pcm=f.readframes(f.getnframes())
            # All voices are a local placeholder; timing comes from actual PCM lengths.
            pcm=b'\0\0'*int(rate*.35)+pcm+b'\0\0'*int(rate*.6)
            length=len(pcm)//2
            scenes.append({'id':ident,'title':title,'target':target,'zoom':zoom,'startMs':round(elapsed_frames/rate*1000),
                           'durationMs':round(length/rate*1000),'caption':text,'cursor':cursor,'gate':gate})
            elapsed_frames+=length;frames.append(pcm)
        source=Path(td)/'narration.wav'
        with wave.open(str(source),'wb') as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(b''.join(frames))
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-af','lowpass=f=6500,highpass=f=80','-codec:a','libmp3lame','-b:a','64k',str(ROOT/'assets/narration.mp3')],check=True)
    data={'format':'dom-director-demo-cues/1','status':'fixture-only prototype; not the SDK schema','durationMs':round(elapsed_frames/rate*1000),'scenes':scenes}
    (ROOT/'assets/cues.json').write_text(json.dumps(data,indent=2)+'\n')
    print(f'{len(scenes)} scenes, {data["durationMs"]/1000:.2f} seconds, {(ROOT/"assets/narration.mp3").stat().st_size} audio bytes')
if __name__=='__main__':main()
