"""Creator-facing local-render settings; no actual command execution or uploads."""
from pathlib import Path
import json
from browser_test import StudioTests


class StudioVideoHandoffTests(StudioTests):
    def open_video(self):
        self.page.locator('#export-open').click()
        self.page.locator('#video-open').click()
        self.page.locator('#video-command').wait_for()

    def test_export_menu_explains_local_delivery_and_does_not_fetch_media(self):
        before=self.project()
        self.open_video()
        text=self.page.locator('#dialog-body').inner_text()
        self.assertIn('does not render video in this browser',text)
        self.assertIn('Python, Chromium and FFmpeg',text)
        self.assertEqual(self.page.locator('#video-command').input_value(),'python3 tools/render_video.py --project walkthrough.director --output walkthrough.mp4 --width 1280 --fps 30')
        self.assertFalse([u for u in self.requests if '.mp3' in u])
        self.page.locator('#video-close').click()
        self.assertEqual(before,self.project())
        self.assertFalse([u for u in self.requests if not u.startswith(self.url.rsplit('/',1)[0]+'/') and not u.startswith('blob:')])

    def test_range_and_independent_caption_voice_and_motion_settings(self):
        self.open_video()
        self.page.locator('#video-format').select_option('webm')
        self.page.locator('#video-width').select_option('1920')
        self.page.locator('#video-fps').select_option('60')
        self.page.locator('#video-range').select_option('range')
        self.page.locator('#video-start').fill('6.980')
        self.page.locator('#video-end').fill('7.081')
        for name in ['audio','captions']:self.page.locator('#video-'+name).uncheck()
        self.page.locator('#video-reduced').check()
        command=self.page.locator('#video-command').input_value()
        self.assertIn('--output walkthrough.webm --width 1920 --fps 60',command)
        self.assertTrue(command.endswith('--start-ms 6980 --end-ms 7081 --silent --no-captions --reduced-motion'))
        self.assertIn('7 frames',self.page.locator('#video-summary').inner_text())
        self.page.locator('#video-end').fill('6')
        self.assertTrue(self.page.locator('#video-copy').is_disabled())
        self.assertEqual(self.page.locator('#video-command').input_value(),'')
        self.assertIn('End must be after start',self.page.locator('#video-summary').inner_text())
        self.page.locator('#video-end').fill('127')
        self.assertIn('at most 120 seconds',self.page.locator('#video-summary').inner_text())
        self.page.locator('#video-range').select_option('all')
        self.assertTrue(self.page.locator('#video-copy').is_enabled())
        self.assertNotIn('--end-ms',self.page.locator('#video-command').input_value())
        self.page.locator('#video-close').click()
        self.assertEqual(self.page.locator('#captions').get_attribute('aria-pressed'),'true')
        self.assertEqual(self.page.locator('#sound').get_attribute('aria-pressed'),'false')

    def test_save_reuses_current_editor_project_not_the_original_sample(self):
        self.edit('#caption-text','A caption for the actual saved video.')
        self.open_video()
        with self.page.expect_download() as pending:self.page.locator('#video-save').click()
        self.assertEqual(pending.value.suggested_filename,'walkthrough.director')
        saved=json.loads(Path(pending.value.path()).read_bytes().splitlines()[0])['project']
        self.assertEqual(self.clip(saved,'cc.overview.0')['text'],'A caption for the actual saved video.')
        self.assertEqual(self.page.locator('#dialog-title').inner_text(),'Prepare a local video export')
        self.assertIn('not later edits in this tab',self.page.locator('#dialog-body').inner_text())

    def test_keyboard_mobile_and_export_navigation_preserve_the_project(self):
        before=self.project()
        self.page.set_viewport_size({'width':390,'height':844})
        self.open_video()
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('#video-copy').focus()
        self.page.keyboard.press('s');self.page.keyboard.press('Delete')
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.page.screenshot(path=str(self.output/'video-local-mobile.png'),full_page=True)
        self.page.locator('#video-back').click()
        self.assertEqual(self.page.locator('#video-open').count(),1)
        self.page.locator('#video-open').click();self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#export-open').evaluate('e=>e===document.activeElement'))
        self.assertEqual(before,self.project())

    def test_clipboard_fallback_is_selectable_and_late_reply_cannot_change_new_dialog(self):
        self.open_video()
        self.page.evaluate("() => { Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('denied'))}}); }")
        self.page.locator('#video-copy').click()
        self.page.wait_for_function("document.querySelector('#video-copy-status').textContent.includes('Clipboard unavailable')")
        self.assertTrue(self.page.locator('#video-command').evaluate('e=>e===document.activeElement&&e.selectionEnd===e.value.length'))
        # Returning the assigned function would make Playwright invoke it and await
        # its deliberately pending promise before the button can ever be clicked.
        self.page.evaluate("() => { navigator.clipboard.writeText=()=>new Promise(resolve=>{ window.resolveVideoCopy=resolve; }); }")
        self.assertFalse(self.page.evaluate('Boolean(window.resolveVideoCopy)'))
        self.page.locator('#video-copy').click()
        self.page.wait_for_function("typeof window.resolveVideoCopy==='function'", timeout=8000)
        self.page.locator('#video-close').click();self.page.locator('#shortcuts').click()
        self.page.evaluate('() => { window.resolveVideoCopy(); }')
        self.assertEqual(self.page.locator('#dialog-title').inner_text(),'Editing shortcuts')
        self.assertEqual(self.page.locator('#video-copy-status').count(),0)

    def test_settings_persist_in_memory_but_not_after_reload_and_opening_pauses(self):
        self.page.locator('#preview-tour').click()
        self.page.wait_for_function("document.querySelector('#studio').dataset.playback==='playing'")
        self.open_video()
        self.assertEqual(self.page.locator('#studio').get_attribute('data-playback'),'paused')
        self.page.locator('#video-fps').select_option('24');self.page.locator('#video-close').click()
        self.open_video();self.assertEqual(self.page.locator('#video-fps').input_value(),'24')
        self.page.reload();self.page.wait_for_function("document.querySelector('#studio').dataset.ready==='true'")
        self.open_video();self.assertEqual(self.page.locator('#video-fps').input_value(),'30')
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.page.screenshot(path=str(self.output/'video-local-desktop.png'),full_page=True)
