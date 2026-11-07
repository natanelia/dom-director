#!/usr/bin/env python3
"""Verify exact SDK site bytes and real interaction, locally or on public Pages."""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = 'https://natanelia.github.io/dom-director/'
MAX_FILE_BYTES = 2 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def expected_files(revision):
    """Derive first-party bytes from this checkout, not the remote manifest."""
    spec = importlib.util.spec_from_file_location('site_builder', ROOT / 'tools/build_site.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    tour = json.loads((ROOT / 'site/orbit.tour.json').read_text())
    css = (ROOT / 'demo/src/style.css').read_text() + '\n' + (ROOT / 'site/style.css').read_text()
    files = {
        'index.html': builder.render_html((ROOT / 'demo/src/index.html').read_text(), css, revision).encode(),
        'tour.generated.js': ('export const ORBIT_TOUR = ' + json.dumps(tour, ensure_ascii=True).replace('<', '\\u003c') + ';\n').encode(),
        'orbit.tour.json': (ROOT / 'site/orbit.tour.json').read_bytes(),
        'LICENSE.txt': (ROOT / 'LICENSE').read_bytes(),
        '.nojekyll': b'',
        'prototype/index.html': (ROOT / 'demo/index.html').read_bytes(),
    }
    for name in ('app.mjs', 'model.mjs', 'agent.html', 'agent.mjs'):
        files[name] = (ROOT / 'site' / name).read_bytes()
    for module in (ROOT / 'packages/core/src').glob('*.js'):
        files['sdk/' + module.name] = module.read_bytes()
    if 'sdk/schema.generated.js' not in files:
        raise ValueError('Build the canonical schemas before verification.')
    files.update(builder.studio_files(revision))
    audio = set()
    for scene in tour['scenes']:
        identifier = scene['narration']['audioAsset']
        if not re.fullmatch(r'voice\.[A-Za-z0-9.-]+', identifier):
            raise ValueError('Unexpected prepared audio identifier.')
        audio.add('assets/' + identifier + '.mp3')
    return files, audio, tour['schemaVersion']


def validate_manifest(manifest, revision, files, audio, schema_version):
    if not isinstance(manifest, dict) or set(manifest) != {'revision', 'runtime', 'schemaVersion', 'files'}:
        raise ValueError('Unexpected build manifest shape.')
    if manifest['revision'] != revision or manifest['runtime'] != '@dom-director/core' or manifest['schemaVersion'] != schema_version:
        raise ValueError('The published revision or runtime does not match this checkout.')
    hashes = manifest['files']
    if not isinstance(hashes, dict) or set(hashes) != set(files) | audio or len(hashes) > 128:
        raise ValueError('Unexpected or missing public artifact path.')
    if not all(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value) for value in hashes.values()):
        raise ValueError('Malformed artifact digest.')
    for path, content in files.items():
        if hashes[path] != sha(content):
            raise ValueError('First-party artifact differs from checkout: ' + path)
    return hashes


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        raise ValueError('Public verification does not follow redirects.')


def fetch(base, path, revision):
    # All paths have already been constructed locally or checked against the exact allowlist.
    url = base + path + '?' + urlencode({'verify': revision})
    request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'DOM-Director-public-check'})
    with build_opener(NoRedirect()).open(request, timeout=20) as response:
        data = response.read(MAX_FILE_BYTES + 1)
        if response.status != 200 or len(data) > MAX_FILE_BYTES:
            raise ValueError('Invalid or oversized public response.')
        return data


def verify_bytes(base, revision):
    files, audio, schema = expected_files(revision)
    last_error = None
    for attempt in range(12):
        try:
            manifest = json.loads(fetch(base, '_build.json', revision))
            hashes = validate_manifest(manifest, revision, files, audio, schema)
            for path, digest in hashes.items():
                data = fetch(base, path, revision)
                if sha(data) != digest:
                    raise ValueError('Published bytes differ from the build manifest: ' + path)
                if path in audio and len(data) < 1000:
                    raise ValueError('Prepared audio is unexpectedly empty.')
            return len(hashes)
        except (ValueError, OSError) as error:
            last_error = error
            if attempt < 11:
                time.sleep(3)
    raise RuntimeError('The expected deployment was not verified within the retry bound.') from last_error


def verify_browser(base, revision, engine):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = getattr(playwright, engine).launch()
        report = {'engine': engine, 'version': browser.version}
        page = browser.new_page(viewport={'width':1440, 'height':1100})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '?verify=' + revision)
        page.wait_for_function("document.querySelector('#stage')?.dataset.runtime==='sdk'")
        assert page.locator('meta[name="dom-director-revision"]').get_attribute('content') == revision
        page.locator('#stage-play').click()
        start = time.monotonic()
        previous = 0
        first = None
        samples = []
        while time.monotonic() - start < 3:
            page.wait_for_timeout(50)
            position = float(page.locator('#seek').input_value())
            elapsed = time.monotonic() - start
            assert math.isfinite(position) and previous - .02 <= position <= elapsed + .4
            assert page.locator('#stage').get_attribute('data-scene') == 'overview'
            assert page.locator('#stage').get_attribute('data-status') == 'playing'
            samples.append({'elapsed':round(elapsed, 3), 'position':position})
            if first is None and position > .1:
                first = position
            elif first is not None and position > first + .2:
                break
            previous = position
        else:
            raise AssertionError('The public player did not sustain progression.')
        page.locator('#play').click()
        paused = float(page.locator('#seek').input_value())
        page.wait_for_timeout(200)
        assert abs(float(page.locator('#seek').input_value()) - paused) < .04
        page.set_viewport_size({'width':390, 'height':844})
        page.emulate_media(reduced_motion='reduce')
        page.locator('[data-mode="try"]').click()
        page.wait_for_function("document.querySelector('#stage').dataset.mode==='try' && !document.querySelector('[data-mode]').disabled")
        page.locator('.chapter-button[data-scene="handoff"]').click()
        page.wait_for_function("document.querySelector('#stage').dataset.state==='waiting'", timeout=6000)
        assert page.locator('#flag-count').inner_text() == '01'
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.locator('#approve-route').click()
        page.wait_for_function("document.querySelector('#flag-count').textContent==='00'")
        page.locator('#exit-tour').click()
        assert page.locator('#stage').get_attribute('data-state') == 'paused'
        page.goto(base + 'agent.html?verify=' + revision)
        page.wait_for_function("document.querySelector('#catalog')?.textContent.includes('app.reports')")
        page.locator('#draft').click()
        page.wait_for_function("document.querySelector('#agent-script').value.includes('catalog-authored-tour')")
        page.locator('#validate').click()
        page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Valid static plan')")
        page.locator('#reviewed-script').check()
        page.locator('#load-script').click()
        page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Reviewed script loaded')")
        page.locator('#agent-play').click()
        page.wait_for_function("JSON.parse(document.querySelector('#command-log').textContent).at(-1)?.command==='play'")
        reply = json.loads(page.locator('#command-log').inner_text())[-1]
        assert reply['ok'] is True
        assert page.locator('#action-count').inner_text() == '0 clicks'
        page.locator('#agent-stop').click()
        page.wait_for_function("document.querySelector('#agent-message').textContent.startsWith('Agent stopped')")
        assert not errors, errors
        report.update({'playbackSamples':samples, 'pauseStable':True, 'mobileReducedMotionTask':True, 'agentReviewFlow':True})
        browser.close()
        return report


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local-directory', type=Path)
    args = parser.parse_args()
    revision = os.environ.get('DEPLOYED_SHA') or os.environ.get('GITHUB_SHA')
    if not revision or not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise ValueError('DEPLOYED_SHA or GITHUB_SHA must identify the expected checkout.')
    base = PUBLIC
    server = thread = None
    if args.local_directory:
        directory = args.local_directory.resolve()
        if not (directory / '_build.json').is_file():
            raise ValueError('Build the SDK site before local verification.')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(directory.parent)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        # Exercise a project subpath, rather than assuming deployment at origin root.
        base = f'http://127.0.0.1:{server.server_port}/{directory.name}/'
    try:
        count = verify_bytes(base, revision)
        report = verify_browser(base, revision, os.environ.get('BROWSER_ENGINE', 'chromium'))
        print(json.dumps({'revision':revision, 'verifiedFiles':count, 'base':base, **report}, indent=2))
    finally:
        if server:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    main()
