"""Run without a browser; verify failure evidence, cleanup and unchanged budgets."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from startup import navigate_studio, READY


class FakePage:
    def __init__(self, state='true', failure=None, status=200):
        self.state, self.failure, self.status = state, failure, status
        self.listeners, self.calls, self.events = {}, [], []
        self.capture_failure = False
        self.before_capture = None

    def on(self, event, callback):
        self.listeners.setdefault(event, []).append(callback)

    def remove_listener(self, event, callback):
        self.listeners[event].remove(callback)

    def goto(self, url):
        self.calls.append(('goto', url))
        for event, data in self.events:
            for callback in self.listeners.get(event, []):
                callback(data)
        if self.failure and self.failure[0] == 'goto':
            raise self.failure[1]
        return SimpleNamespace(status=self.status)

    def wait_for_function(self, script, *, timeout):
        self.calls.append(('wait', script, timeout))
        if self.failure and self.failure[0] == 'wait':
            raise self.failure[1]

    def locator(self, selector):
        def read(*args, timeout):
            self.calls.append(('read', selector, timeout))
            if timeout == 500:
                if self.before_capture:
                    self.before_capture()
                if self.capture_failure:
                    raise TimeoutError('Synthetic frozen renderer')
            return self.state if selector == '#studio' else 'Synthetic fixture'
        return SimpleNamespace(get_attribute=read, text_content=read)

    def evaluate(self, script):
        if self.capture_failure:
            raise RuntimeError('Capture unavailable')
        return {'ready': self.state, 'documentState': 'complete', 'status': 'Synthetic fixture'}

    def screenshot(self, **kwargs):
        self.calls.append(('screenshot', kwargs))
        if self.capture_failure:
            raise RuntimeError('Capture unavailable')


class StartupContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'failure.json'
        self.url = 'https://example.test/studio.html?verify=private-token'

    def run_page(self, page, **kwargs):
        return navigate_studio(page, self.url, self.path, **kwargs)

    def test_success_does_not_write_and_removes_all_probe_listeners(self):
        page = FakePage()
        self.run_page(page)
        self.assertFalse(self.path.exists())
        self.assertTrue(all(not listeners for listeners in page.listeners.values()))
        self.assertEqual([c for c in page.calls if c[0] == 'wait'], [('wait', READY, 8000)])
        self.assertIn('!!root', READY)

    def test_timeout_rethrows_same_error_without_retry_or_budget_change(self):
        error = TimeoutError('original failure')
        page = FakePage('false', ('wait', error))
        with self.assertRaises(TimeoutError) as caught:
            self.run_page(page)
        self.assertIs(caught.exception, error)
        self.assertEqual(len([c for c in page.calls if c[0] == 'goto']), 1)
        self.assertEqual(len([c for c in page.calls if c[0] == 'wait']), 1)
        self.assertTrue(all(not listeners for listeners in page.listeners.values()))
        self.assertEqual(json.loads(self.path.read_text())['state']['ready'], 'false')

    def test_error_and_missing_root_never_count_as_ready(self):
        for state in ['error', None, 'false']:
            with self.subTest(state=state), self.assertRaises(AssertionError):
                self.run_page(FakePage(state))

    def test_navigation_and_status_failures_are_captured_without_wait(self):
        for page in [FakePage(failure=('goto', RuntimeError('navigation failed'))), FakePage(status=503)]:
            with self.assertRaises((RuntimeError, AssertionError)):
                self.run_page(page)
            self.assertFalse(any(c[0] == 'wait' for c in page.calls))
            self.assertTrue(self.path.exists())
            self.assertTrue(all(not listeners for listeners in page.listeners.values()))

    def test_diagnostic_failures_cannot_hide_the_original_failure(self):
        error = TimeoutError('original failure')
        page = FakePage('false', ('wait', error))
        page.capture_failure = True
        with self.assertRaises(TimeoutError) as caught:
            self.run_page(page)
        self.assertIs(caught.exception, error)
        self.assertEqual(json.loads(self.path.read_text())['state'], {'ready': None, 'status': None, 'unavailable': True})

    def test_request_metadata_is_bounded_and_queries_headers_bodies_are_not_retained(self):
        page = FakePage('false', ('wait', TimeoutError()))
        for i in range(120):
            request = type('Request', (), {'url': 'https://example.test/sdk/m'+str(i)+'.js?token=SECRET', 'resource_type': 'script'})()
            page.events.extend([('request', request), ('response', SimpleNamespace(request=request, status=503)), ('requestfailed', request)])
        with self.assertRaises(TimeoutError):
            self.run_page(page)
        raw = self.path.read_text()
        report = json.loads(raw)
        self.assertEqual(len(report['requests']), 100)
        self.assertEqual(report['requests'][0], {'path': '/sdk/m0.js', 'type': 'script', 'status': 503, 'state': 'failed'})
        for secret in ['SECRET', 'private-token', 'token=', 'headers', 'body']:
            self.assertNotIn(secret, raw)

    def test_js_error_blocks_success_and_does_not_store_authored_message(self):
        page = FakePage()
        page.events = [('pageerror', RuntimeError('SECRET_VALUE'))] * 20
        with self.assertRaisesRegex(AssertionError, 'JavaScript error'):
            self.run_page(page)
        self.assertEqual(len(json.loads(self.path.read_text())['pageErrors']), 16)
        self.assertNotIn('SECRET_VALUE', self.path.read_text())

    def test_external_addresses_are_not_retained(self):
        page = FakePage(failure=('wait', TimeoutError()))
        request = type('Request', (), {'url': 'https://user:SECRET@other.test/private.js?q=PRIVATE', 'resource_type': 'script'})()
        page.events = [('request', request), ('requestfinished', request)]
        with self.assertRaises(TimeoutError):
            self.run_page(page)
        report = json.loads(self.path.read_text())
        self.assertEqual(report['requests'], [{'path': '<external>', 'type': 'script', 'state': 'finished'}])

    def test_report_exists_before_renderer_inspection_and_reads_have_independent_deadlines(self):
        page = FakePage('false', ('wait', TimeoutError('initial failure')))
        page.capture_failure = True
        observed = []
        def before_capture():
            report = json.loads(self.path.read_text())
            observed.append(report['errorType'])
            self.assertTrue(report['state']['unavailable'])
        page.before_capture = before_capture
        with self.assertRaises(TimeoutError):
            self.run_page(page)
        self.assertEqual(observed, ['TimeoutError', 'TimeoutError'])
        self.assertEqual([c for c in page.calls if c[0] == 'read'],
                         [('read', '#studio', 500), ('read', '#status', 500)])

    def test_failures_after_metadata_limit_still_block_startup(self):
        for failure in ['http', 'network']:
            with self.subTest(failure=failure):
                page = FakePage()
                for i in range(101):
                    request = type('Request', (), {'url': 'https://example.test/' + str(i) + '.js', 'resource_type': 'script'})()
                    page.events.append(('request', request))
                    if i == 100 and failure == 'network':
                        page.events.append(('requestfailed', request))
                    else:
                        status = 503 if i == 100 else 200
                        page.events.extend([('response', SimpleNamespace(request=request, status=status)), ('requestfinished', request)])
                with self.assertRaisesRegex(AssertionError, 'resource failed'):
                    self.run_page(page)
                report = json.loads(self.path.read_text())
                self.assertEqual(len(report['requests']), 100)
                self.assertTrue(report['resourceFailure'])
                self.assertTrue(all(row['status'] == 200 for row in report['requests']))

    def test_non_startup_media_failure_does_not_fail_an_otherwise_ready_page(self):
        page = FakePage()
        request = type('Request', (), {'url': 'https://example.test/later.mp3', 'resource_type': 'media'})()
        page.events = [('request', request), ('response', SimpleNamespace(request=request, status=503)), ('requestfailed', request)]
        self.run_page(page)
        self.assertFalse(self.path.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
