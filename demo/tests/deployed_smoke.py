#!/usr/bin/env python3
"""Verify the exact deployed bundle and real Play/pause/chapter behavior."""
import hashlib
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = hashlib.sha256((ROOT / 'index.html').read_bytes()).hexdigest()
REVISION = os.environ['DEPLOYED_SHA']
ENGINE = os.environ.get('BROWSER_ENGINE', 'chromium')
if ENGINE not in ('chromium', 'webkit'):
    raise ValueError('Unsupported browser')
if len(REVISION) != 40 or any(c not in '0123456789abcdef' for c in REVISION):
    raise ValueError('Expected a commit SHA')
URL = f'https://natanelia.github.io/dom-director/?v={REVISION}'

with sync_playwright() as p:
    browser = getattr(p, ENGINE).launch()
    try:
        for mobile in (False, True):
            context = browser.new_context(
                viewport={'width': 390 if mobile else 1440, 'height': 844 if mobile else 1100},
                has_touch=mobile, is_mobile=mobile)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                for attempt in range(12):
                    response = page.goto(URL + f'&check={attempt}', wait_until='load')
                    if response and response.ok and hashlib.sha256(response.body()).hexdigest() == EXPECTED:
                        break
                    page.wait_for_timeout(5000)
                else:
                    raise AssertionError('Public page does not match the deployed commit')
                play = page.locator('#stage-play' if mobile else '#hero-play')
                play.tap() if mobile else play.click()
                page.wait_for_timeout(600)
                position = float(page.locator('#seek').input_value())
                assert .1 < position < 3, f'Play jumped or stalled: {position}'
                assert page.locator('#stage').get_attribute('data-state') == 'playing'
                assert page.locator('#shot-title').inner_text() == 'The bigger picture'
                page.locator('#play').click()
                paused = float(page.locator('#seek').input_value())
                page.wait_for_timeout(250)
                assert abs(float(page.locator('#seek').input_value()) - paused) < .05
                page.locator('[data-scene="signal"]').click()
                page.wait_for_timeout(450)
                position = float(page.locator('#seek').input_value())
                assert 7 < position < 10, f'Chapter jumped or stalled: {position}'
                assert page.locator('#stage').get_attribute('data-state') == 'playing'
                assert not errors, errors
                print(f'PASS {ENGINE} {"touch" if mobile else "desktop"}: exact bundle, Play, pause, chapter progression')
            finally:
                context.close()
    finally:
        browser.close()
