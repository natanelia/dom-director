"""Repeated real pointer disclosure checks with bounded, synthetic-only diagnostics."""
import json
from pathlib import Path
import unittest
from browser_test import StudioTests

class DisclosureTests(StudioTests):
    def test_caption_edit_then_open_word_controls(self):
        failures = []
        for attempt in range(12):
            self.page.goto(self.url)
            self.page.wait_for_function("document.querySelector('#studio')?.dataset.ready==='true'")
            self.page.evaluate("""()=>{
              window.disclosureEvents=[];
              for(const type of ['focusin','change','pointerdown','pointerup','click','toggle'])
                document.addEventListener(type,event=>{
                  const target=event.target;
                  if(!target.closest?.('#inspector'))return;
                  const summary=[...document.querySelectorAll('#inspector summary')].find(e=>e.textContent==='Word highlighting');
                  const rect=summary?.getBoundingClientRect();
                  disclosureEvents.push({type,target:target.id||target.tagName,text:target.tagName==='SUMMARY'?target.textContent:null,
                    open:summary?.parentElement.open,scroll:document.querySelector('#inspector').scrollTop,
                    summary:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
                    pointer:{x:event.clientX,y:event.clientY},revision:document.querySelector('#revision').textContent});
                  if(disclosureEvents.length>80)disclosureEvents.shift();
                },true);
            }""")
            try:
                self.edit('#caption-text', 'A much longer explanation.')
                self.page.get_by_text('Word highlighting', exact=True).click()
                self.page.locator('#add-word-timing').click(timeout=2000)
                self.assertNotIn('error', self.page.locator('#status').get_attribute('class') or '')
                self.assertIn('Add approximate word timing', self.page.locator('#status').inner_text())
            except Exception as error:
                report={'attempt':attempt,'error':str(error),'events':self.page.evaluate('window.disclosureEvents')}
                failures.append(report)
                self.page.screenshot(path=str(self.output / ('disclosure-' + str(attempt) + '.png')), full_page=True)
                print(json.dumps(report),flush=True)
        (self.output / 'disclosure.json').write_text(json.dumps({'attempts':12,'failures':failures},indent=2))
        self.assertEqual(len(failures),0,'Disclosure activation failed; inspect retained event/geometry evidence.')

def load_tests(loader, tests, pattern):
    return unittest.TestSuite([DisclosureTests('test_caption_edit_then_open_word_controls')])

if __name__=='__main__':
    unittest.main(verbosity=2)
