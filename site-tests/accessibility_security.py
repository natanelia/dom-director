#!/usr/bin/env python3
"""Automated synthetic-fixture review. Not a screen-reader or WCAG certification."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"

class Handler(SimpleHTTPRequestHandler):
    strict = False
    def log_message(self, *args):pass
    def do_GET(self):
        self.strict = self.path.startswith('/policy/')
        if self.strict:self.path = self.path[len('/policy'):]
        super().do_GET()
    def end_headers(self):
        if self.strict:self.send_header('Content-Security-Policy', POLICY)
        super().end_headers()

def main():
    axe = Path(os.environ['AXE_PATH'])
    if not axe.is_file():raise ValueError('Provide the pinned, locally installed axe-core script.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'site-dist')))
    thread = threading.Thread(target=server.serve_forever, daemon=True);thread.start()
    base = f'http://127.0.0.1:{server.server_port}/'
    output = ROOT / 'review-results';output.mkdir(exist_ok=True)
    report = {'revision':os.environ.get('GITHUB_SHA', 'local'), 'automatedOnly':True, 'axeVersion':'4.10.3', 'audits':[], 'security':{}, 'keyboard':{}}
    failures = []
    def save():(output / 'review.json').write_text(json.dumps(report, indent=2) + '\n')
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch();report['browser'] = browser.version
            page = browser.new_page(viewport={'width':1440, 'height':1100})
            errors = [];page.on('pageerror', lambda e: errors.append(str(e)))
            def until(check, description):
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    if check():return
                    page.wait_for_timeout(50)
                raise AssertionError(description)
            def ready(path=''):
                page.goto(base + path)
                # Python-side locator polling does not inject eval into the CSP fixture.
                until(lambda: (page.locator('#stage').count() and page.locator('#stage').get_attribute('data-runtime') == 'sdk') or
                    (page.locator('#catalog').count() and 'app.reports' in page.locator('#catalog').inner_text()), 'Page did not become ready.')
                page.emulate_media(reduced_motion='reduce')
            def audit(name):
                page.add_script_tag(path=str(axe))
                result = page.evaluate("""async()=>{
                  if(axe.version!=='4.10.3')throw Error('Unexpected axe version');
                  return axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
                }""")
                report['audits'].append({'name':name, 'violations':result['violations'], 'incomplete':result['incomplete'], 'passes':len(result['passes'])})
                page.screenshot(path=str(output / (name + '.png')), full_page=True)
                if result['violations']:
                    brief = [{'id':v['id'], 'impact':v['impact'], 'targets':[n['target'] for n in v['nodes']]} for v in result['violations']]
                    failures.append({'name':name, 'violations':brief});print(json.dumps(failures[-1]), flush=True)
                save()
            ready();audit('orbit-ready')
            assert page.locator('#stage').get_attribute('aria-pressed') is None
            page.locator('#transcript-toggle').focus();page.keyboard.press('Enter')
            assert not page.locator('#transcript').is_hidden()
            page.locator('#script-open').focus();page.keyboard.press('Enter')
            page.locator('#script-dialog').wait_for(state='visible');audit('orbit-script-dialog')
            page.keyboard.press('Escape')
            assert page.locator('#script-open').evaluate('el=>el===document.activeElement')
            report['keyboard']['dialogFocusRestored'] = True
            page.locator('button[data-mode="try"]').focus();page.keyboard.press('Enter')
            page.wait_for_function("document.querySelector('#stage').dataset.mode==='try' && !document.querySelector('button[data-mode]').disabled")
            page.locator('.chapter-button[data-scene="handoff"]').click()
            page.wait_for_function("document.querySelector('#stage').dataset.state==='waiting'")
            audit('orbit-waiting')
            page.locator('#approve-route').focus();page.keyboard.press('Enter')
            page.wait_for_function("document.querySelector('#flag-count').textContent==='00'")
            page.keyboard.press('Escape')
            assert page.locator('#stage').get_attribute('data-state') == 'paused'
            report['keyboard']['realTaskAndEscape'] = True
            page.set_viewport_size({'width':390, 'height':844});ready();audit('orbit-mobile')
            page.set_viewport_size({'width':1440, 'height':1100});ready('agent.html');audit('agent-ready')
            page.locator('#draft').click()
            page.wait_for_function("document.querySelector('#agent-script').value.includes('catalog-authored-tour')")
            page.locator('#validate').click()
            page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Valid static plan')")
            page.locator('#reviewed-script').check();page.locator('#load-script').click()
            page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Reviewed script loaded')")
            audit('agent-loaded')
            page.add_init_script("window.policyFailures=[];addEventListener('securitypolicyviolation',e=>policyFailures.push(e.violatedDirective));")
            ready('policy/');page.locator('#stage-play').click()
            until(lambda: float(page.locator('#seek').input_value()) > .2, 'CSP playback did not progress.')
            page.locator('#play').click()
            assert page.evaluate('() => window.policyFailures') == []
            ready('policy/agent.html');page.locator('#draft').click()
            until(lambda: 'catalog-authored-tour' in page.locator('#agent-script').input_value(), 'CSP draft did not appear.')
            page.locator('#validate').click()
            until(lambda: page.locator('#agent-message').inner_text().startswith('Valid static plan'), 'CSP validation did not finish.')
            assert page.evaluate('() => window.policyFailures') == []
            report['security'] = {'strictCspFixture':True, 'policy':POLICY, 'evalAndInlineScriptNotRequired':True, 'connectGrantNotRequired':True, 'publicPagesHeadersNotClaimed':True}
            assert not errors, errors
            report['passed'] = not failures;save();browser.close()
    except Exception as error:
        report['error'] = str(error);raise
    finally:
        save();server.shutdown();server.server_close();thread.join()
    if failures:raise AssertionError('Automated accessibility violations require review; see review-results/review.json.')
    print(json.dumps({'audits':len(report['audits']), 'passed':True, 'manualReviewStillRequired':True}))

if __name__ == '__main__':main()
