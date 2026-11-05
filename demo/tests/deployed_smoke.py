#!/usr/bin/env python3
"""Verify deployed bytes and bounded, sustained Play/pause/chapter progression."""
import hashlib
import math
import os
from pathlib import Path
import time
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


def snapshot(page):
    return page.evaluate('''() => ({
        position: Number(document.querySelector('#seek').value),
        state: document.querySelector('#stage').dataset.state,
        clock: document.querySelector('#stage').dataset.clock,
        title: document.querySelector('#shot-title').textContent,
        hidden: document.hidden,
        now: performance.now()
    })''')


def expect_progress(page, start, title, started_at):
    """Allow a cold first frame, not a jump, stuck clock, or wrong chapter.

    WebKit can delay animation frames during the hero's smooth page scroll.
    Poll boundedly instead of declaring a failure from one fixed 600ms sample.
    Once started, require another 200ms of progress to catch a one-frame stall.
    """
    deadline = time.monotonic() + 2.5
    first = None
    previous = start
    while True:
        sample = snapshot(page)
        position = sample['position']
        elapsed = max(0, (sample['now'] - started_at) / 1000)
        assert sample['state'] == 'playing', sample
        assert sample['title'] == title, sample
        assert not sample['hidden'], sample
        assert math.isfinite(position) and start - .02 <= position < start + 3, sample
        # At the default 1x rate the timeline cannot outrun elapsed wall time.
        assert position <= start + elapsed + .25, sample
        assert position >= previous - .02, sample
        previous = position
        if first is None and position >= start + .2:
            first = position
        elif first is not None and position >= first + .2:
            return sample
        assert time.monotonic() < deadline, f'Playback stalled: {sample}'
        page.wait_for_timeout(50)


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
                started_at = page.evaluate('performance.now()')
                play.tap() if mobile else play.click()
                expect_progress(page, 0, 'The bigger picture', started_at)
                page.locator('#play').click()
                paused = float(page.locator('#seek').input_value())
                assert page.locator('#stage').get_attribute('data-state') == 'paused'
                page.wait_for_timeout(250)
                assert abs(float(page.locator('#seek').input_value()) - paused) < .05
                chapter = page.locator('[data-scene="signal"]')
                title = chapter.locator('strong').inner_text()
                started_at = page.evaluate('performance.now()')
                chapter.click()
                expect_progress(page, 7, title, started_at)
                assert not errors, errors
                print(f'PASS {ENGINE} {"touch" if mobile else "desktop"}: exact bundle, sustained Play, pause, chapter progression')
            finally:
                context.close()
    finally:
        browser.close()
