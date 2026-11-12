from pathlib import Path
import hashlib
expected={
 'packages/studio/src/media.js':'1f56a77d410b86fc5c55cca4507c1c814b616235',
 'site/studio.mjs':'bcf695f1c2b820e77eb3c3fedc15ae1e13db667a',
 'packages/studio/src/media.d.ts':'f50a6d2d72a190f2107852ac08afcc306e05c6d6',
 'tools/check_studio.py':'1f2a85c2a18606943c3229b2e09fcadcf0951b3c',
 'studio-tests/review_test.py':'e1431b7bad4c922c4a643c4f1539fa7778044986',
 'studio-tests/accessibility.py':'064af4bfe576a22ecbb8eabd072da8bb3ba7c325',
 'docs/studio-workspace.md':'6417dfc88967e3e4c21021addf7a708c70e7e06a',
}
def sha(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
texts={}
for name,digest in expected.items():
 p=Path(name);assert p.is_file() and not p.is_symlink(),name
 data=p.read_bytes();assert sha(data)==digest,(name,sha(data));texts[name]=data.decode()
def replace(name,old,new):
 assert texts[name].count(old)==1,(name,old)
 texts[name]=texts[name].replace(old,new)
texts['packages/studio/src/media.js']+=Path('.transfer/audition.js').read_text()
texts['packages/studio/src/media.d.ts']+=Path('.transfer/types.txt').read_text()
name='site/studio.mjs'
replace(name,'saveProjectBundle,readProjectBundle,generateVoiceTake}', 'saveProjectBundle,readProjectBundle,generateVoiceTake,createTakeAuditioner}')
replace(name,'let voiceProvider=null;', 'let voiceProvider=null,activeAudition=null;')
replace(name,'function stop(){if(transport)', 'function stop(){activeAudition?.stop();if(transport)')
replace(name,'function play(fromStart=false){if(!ensure())return;', 'function play(fromStart=false){if(!ensure())return;activeAudition?.stop();')
s=texts[name];a=s.index('function offerTake(');b=s.index('\nasync function runAsync',a);texts[name]=s[:a]+Path('.transfer/dialog.js').read_text()+s[b:]
replace(name,"  on($('dialog'),'cancel',()=>{dialogCleanup?.();dialogCleanup=null;});", "  on($('dialog'),'cancel',()=>{dialogCleanup?.();dialogCleanup=null;});\n  on($('dialog'),'close',()=>{if(!$('dialog').open){dialogCleanup?.();dialogCleanup=null;}});")
replace(name,'if(e.persisted)return;disposed=true;', 'if(e.persisted)return;closeDialog();disposed=true;')
assert sha(texts[name].encode())=='8e7ad779f0d568903fb7fe4b6b9b5e0874324882'
assert sha(texts['packages/studio/src/media.js'].encode())=='a4360c9db5a730e848806c6c83c237990daf5fb2'
name='studio-tests/review_test.py'
replace(name,'from timing_link_test import StudioTimingLinkTests','from voice_audition_test import StudioVoiceAuditionTests\nfrom timing_link_test import StudioTimingLinkTests')
replace(name,'for case in (StudioTimingLinkTests,','for case in (StudioVoiceAuditionTests, StudioTimingLinkTests,')
name='tools/check_studio.py'
needle="    (consumer/'timeline.ts').write_text((ROOT/'package-tests/studio-timeline.ts').read_text())"
addition="    (consumer/'audition.ts').write_text((ROOT/'package-tests/studio-audition.ts').read_text())\n    (consumer/'audition.mjs').write_text(\"import {createTakeAuditioner} from '@dom-director/studio/media'; const a=createTakeAuditioner({bank:{context(){throw Error('Unexpected context access');},async load(){throw Error('Unexpected loading');}}}); if(a.inspect().state!=='idle')throw Error('Audition import failed');a.destroy();if(a.inspect().state!=='destroyed')throw Error('Audition lifecycle failed');\")\n    run(['node','audition.mjs'],cwd=consumer)\n"
replace(name,needle,addition+needle)
replace(name,"'audio-export.ts','timing-links.ts'],cwd=consumer)","'audio-export.ts','timing-links.ts','audition.ts'],cwd=consumer)")
name='studio-tests/accessibility.py'
needle="        assert page.locator('#timecode').get_attribute('aria-live') == 'off'"
addition="""        page.set_viewport_size({'width': 1440, 'height': 1000})
        case.choose('voice')
        page.get_by_text('Available takes', exact=True).click()
        page.locator('#inspector details').filter(has=page.get_by_text('Available takes', exact=True)).locator('.clip-list-item').nth(1).click()
        audit('voice-audition-ready')
        page.set_viewport_size({'width': 390, 'height': 844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        audit('voice-audition-mobile')
        page.keyboard.press('Escape')
"""
replace(name,needle,addition+needle)
name='docs/studio-workspace.md'
replace(name,'Replacing a take has a review step.', 'The [A/B voice comparison](voice-audition.md) lets you listen to the current clip and proposed take before replacing anything. Opening it is silent; explicit Listen buttons play sound even when tour preview is muted. Switching, closing or editing stops the audition without changing the draft or playhead.\n\nReplacing a take has a review step.')
for name,text in texts.items():Path(name).write_text(text)
print('Applied exact-preimage edits to',len(texts),'product files; source hashes verified.')
