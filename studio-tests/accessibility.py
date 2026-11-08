"""Studio-only automated audit; retain incomplete findings, never claim certification."""
import json
import os
from pathlib import Path
from browser_test import StudioTests, ROOT


def main():
    axe = Path(os.environ['AXE_PATH'])
    if not axe.is_file():
        raise ValueError('Provide the pinned local axe-core script.')
    report = {'revision': os.environ.get('GITHUB_SHA', 'local'), 'automatedOnly': True,
              'axeVersion': '4.10.3', 'audits': [], 'passed': False}
    StudioTests.setUpClass()
    case = StudioTests('runTest')
    case.setUp()
    page = case.page
    output = ROOT / 'studio-results' / 'accessibility'
    output.mkdir(parents=True, exist_ok=True)
    def save():
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    def audit(name):
        result = page.evaluate("""async()=>{
          if(axe.version!=='4.10.3')throw Error('Unexpected axe version');
          return axe.run(document,{runOnly:{type:'tag',values:
            ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']} });
        }""")
        report['audits'].append({'name': name, 'violations': result['violations'],
                                'incomplete': result['incomplete'], 'passes': len(result['passes'])})
        page.screenshot(path=str(output / (name + '.png')), full_page=True)
        print(json.dumps({'state': name, 'violations': [v['id'] for v in result['violations']],
                          'incomplete': len(result['incomplete'])}), flush=True)
        save()
    try:
        report['browser'] = StudioTests.browser.version
        page.add_script_tag(path=str(axe))
        page.emulate_media(reduced_motion='reduce')
        audit('caption-ready')
        for kind in ['voice', 'cursor', 'camera']:
            case.choose(kind)
            audit(kind + '-inspector')
        case.choose('captions')
        page.get_by_text('Word highlighting', exact=True).click()
        page.locator('#add-word-timing').click()
        audit('word-timing')
        page.get_by_text('Scene and clip timing', exact=True).click()
        case.edit('#clip-end', '-1')
        audit('invalid-timing')
        page.locator('#clip-end').press('Escape')
        page.set_viewport_size({'width': 390, 'height': 844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        audit('mobile-caption')
        page.locator('#export-open').click()
        audit('project-export-dialog')
        page.get_by_role('button', name='Voice WAV…', exact=True).click()
        audit('voice-export-options')
        page.locator('#mix-render').focus()
        page.keyboard.press('Enter')
        page.locator('#mix-download').wait_for(timeout=15000)
        audit('voice-export-ready')
        page.keyboard.press('Escape')
        assert page.locator('#export-open').evaluate('el=>el===document.activeElement')
        page.locator('#export-open').click()
        page.locator('#video-open').click()
        audit('video-local-options')
        page.locator('#video-range').select_option('range')
        page.locator('#video-end').fill('0')
        audit('video-local-invalid-range')
        page.keyboard.press('Escape')
        assert page.locator('#export-open').evaluate('el=>el===document.activeElement')
        assert page.locator('#timecode').get_attribute('aria-live') == 'off'
        report['passed'] = not any(a['violations'] for a in report['audits'])
        report['manualReviewStillRequired'] = True
        assert not case.errors, case.errors
        if not report['passed']:
            raise AssertionError('Studio accessibility violations require repair; inspect retained report.')
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        save()
        try:
            case.tearDown()
        finally:
            StudioTests.tearDownClass()

if __name__ == '__main__':
    main()
