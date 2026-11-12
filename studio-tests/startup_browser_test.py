"""Controlled startup fault injection. Runs only against the local CI fixture."""
import json
import os
import tempfile
import time
from pathlib import Path
import unittest
from browser_test import StudioTests
from startup import navigate_studio


class StudioStartupTests(StudioTests):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('STUDIO_PUBLIC_URL'):
            raise ValueError('Fault injection runs against the staged synthetic fixture only.')
        super().setUpClass()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        self.addCleanup(lambda: self.page.close() if not self.page.is_closed() else None)
        self.page.set_default_timeout(8000)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.report = Path(self.temp.name) / 'expected-failure.json'

    def tearDown(self):
        pass  # addCleanup also executes when setUp or a test raises.

    def broken(self, expected):
        # Deliberately broken fixtures use a short bound. Ordinary navigation
        # retains the existing 8000 ms deadline and never retries.
        with self.assertRaises(Exception) as caught:
            navigate_studio(self.page, self.url, self.report, timeout_ms=500)
        self.assertEqual(type(caught.exception).__name__, expected)
        return json.loads(self.report.read_text())

    def test_cold_start_requires_ready_and_actual_tracks_without_retries(self):
        navigate_studio(self.page, self.url, self.report)
        self.assertEqual(self.page.locator('#studio').get_attribute('data-ready'), 'true')
        # Scene navigation is also a lane, not a fifth editing track.
        kinds = self.page.locator('#lanes > .lane').evaluate_all(
            'rows => rows.map(row => row.dataset.kind)')
        self.assertEqual(kinds, ['scenes', 'camera', 'cursor', 'voice', 'captions'])
        self.assertFalse(self.report.exists())

    def test_failed_dependency_is_recorded_not_treated_as_ready(self):
        self.page.route('**/studio-selection.mjs', lambda route: route.abort('failed'))
        report = self.broken('TimeoutError')
        self.assertEqual(report['state']['ready'], 'false')
        self.assertTrue(any(row['path'].endswith('/studio-selection.mjs') and row['state'] == 'failed'
                            for row in report['requests']))
        self.assertNotIn('headers', report)

    def test_module_evaluation_error_is_distinguished_from_network_failure(self):
        self.page.route('**/studio.mjs', lambda route: route.fulfill(status=200, content_type='text/javascript',
                         body="throw new Error('Synthetic startup fault');"))
        report = self.broken('TimeoutError')
        self.assertEqual(report['state']['ready'], 'false')
        self.assertTrue(report['pageErrors'])
        self.assertFalse(any(row['state'] == 'failed' for row in report['requests']))

    def test_missing_root_cannot_satisfy_readiness_via_undefined(self):
        self.page.route('**/studio.html', lambda route: route.fulfill(status=200, content_type='text/html',
                         body='<!doctype html><html lang="en"><title>Missing fixture</title><body>No Studio root</body></html>'))
        report = self.broken('TimeoutError')
        self.assertIsNone(report['state']['ready'])
        self.assertTrue(report['state']['unavailable'])

    def test_explicit_startup_error_is_immediate_failure_not_a_timeout(self):
        self.page.route('**/studio.mjs', lambda route: route.fulfill(status=200, content_type='text/javascript',
                         body="document.querySelector('#studio').dataset.ready='error'; document.querySelector('#status').textContent='Synthetic initialization failure';"))
        report = self.broken('AssertionError')
        self.assertEqual(report['state']['ready'], 'error')
        self.assertEqual(report['state']['status'], 'Synthetic initialization failure')

    def test_frozen_renderer_still_preserves_evidence_and_rethrows_within_bound(self):
        # Only this intentionally frozen fixture has a short navigation deadline.
        self.page.set_default_navigation_timeout(500)
        self.page.route('**/studio.mjs', lambda route: route.fulfill(status=200, content_type='text/javascript',
                         body='while (true) {}'))
        started = time.monotonic()
        report = self.broken('TimeoutError')
        self.assertLess(time.monotonic() - started, 6)
        self.assertTrue(report['state']['unavailable'])
        self.assertTrue(any(row['path'].endswith('/studio.mjs') for row in report['requests']))


def load_tests(loader, tests, pattern):
    return unittest.TestSuite(StudioStartupTests(name) for name in StudioStartupTests.__dict__ if name.startswith('test_'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
