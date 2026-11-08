#!/usr/bin/env python3
"""Render an Orbit Studio project to MP4/WebM locally. No screen capture or uploads.

Requires a built site-dist, Playwright Chromium, ffmpeg and ffprobe. The application
is rendered at exact timeline positions; wall-clock rendering speed is irrelevant.
"""
from __future__ import annotations

import argparse
import base64
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import struct
import subprocess
import tempfile
import threading
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
MAX_INPUT = 36 * 1024 * 1024
MAX_OUTPUT = 512 * 1024 * 1024
MAX_SECONDS = 120
FPS = (24, 30, 60)
WIDTHS = (960, 1280, 1920)
SAMPLES = ('voice.overview', 'voice.signal', 'voice.story')
RENDER_CSS = """
html,body{margin:0!important;padding:0!important;overflow:hidden!important}
#studio,.workspace,.canvas-panel,.canvas-stage-wrap{display:block!important;position:static!important;width:960px!important;height:540px!important;min-width:0!important;min-height:0!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important}
.topbar,.scene-panel,.inspector-panel,.canvas-toolbar,.transport,.seek-label,.canvas-help,.timeline-panel,.statusbar,.stage-label,#canvas-picker,#edit-handles{display:none!important}
#stage{width:960px!important;height:540px!important;min-width:960px!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
"""
POLICY = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def frame_count(start_ms: int, end_ms: int, fps: int) -> int:
    if type(start_ms) is not int or type(end_ms) is not int or not 0 <= start_ms < end_ms:
        raise ValueError('Choose integer millisecond boundaries with end after start.')
    if end_ms - start_ms > MAX_SECONDS * 1000 or fps not in FPS:
        raise ValueError('Use 24, 30 or 60 fps and a range no longer than two minutes.')
    return ((end_ms - start_ms) * fps + 999) // 1000


def render_template(template: str) -> bytes:
    script = '<script type="module" src="./studio.mjs"></script>'
    if template.count(script) != 1 or template.count('</head>') != 1:
        raise ValueError('The Studio host template changed; review the renderer before exporting.')
    result = template.replace(script, '<script type="module" src="./render-host.mjs"></script>')
    result = result.replace('</head>', '<style>' + RENDER_CSS + '</style></head>')
    return result.encode()


def load_site(site: Path, project: Path | None) -> tuple[dict[str, bytes], str]:
    """Serve only verified first-party fixture inputs, never a filesystem directory."""
    site = site.resolve()
    manifest = json.loads((site / '_build.json').read_text())
    from build_site import STUDIO_MODULES
    names = {'studio.html', 'studio.css', 'studio-view.mjs'}
    names.update('studio-sdk/' + name for name in STUDIO_MODULES)
    names.update('assets/' + name + '.mp3' for name in SAMPLES)
    names.update(name for name in manifest['files'] if re.fullmatch(r'sdk/[A-Za-z0-9.-]+\.js', name))
    if len(names) > 128 or 'sdk/index.js' not in names:
        raise ValueError('Unexpected SDK artifact inventory.')
    files = {}
    for name in sorted(names):
        path = site / name
        if path.is_symlink() or not path.resolve().is_relative_to(site) or not path.is_file():
            raise ValueError('Missing or unsafe fixture input: ' + name)
        data = path.read_bytes()
        if len(data) > 8 * 1024 * 1024 or sha(data) != manifest['files'].get(name):
            raise ValueError('Fixture does not match its build manifest: ' + name)
        files[name] = data
    files['render.html'] = render_template(files.pop('studio.html').decode())
    files['render-host.mjs'] = (ROOT / 'tools/video-render-host.mjs').read_bytes()
    if project is not None:
        if project.stat().st_size > MAX_INPUT:
            raise ValueError('Project file exceeds 36 MiB.')
        files['project.director'] = project.read_bytes()
        if len(files['project.director']) > MAX_INPUT:
            raise ValueError('Project file exceeds 36 MiB.')
    return files, manifest['revision']


@contextmanager
def local_fixture(files: dict[str, bytes]):
    token = secrets.token_urlsafe(24)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            base = f'http://127.0.0.1:{self.server.server_port}'
            if self.headers.get('Host') != base.removeprefix('http://') or self.headers.get('Origin', base) != base:
                self.send_error(403)
                return
            prefix = '/' + token + '/'
            path = urlsplit(self.path).path
            name = path[len(prefix):] if path.startswith(prefix) else ''
            if name not in files:
                self.send_error(404)
                return
            mime = ('text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else
                    'text/javascript' if name.endswith(('.mjs', '.js')) else 'audio/mpeg' if name.endswith('.mp3') else 'application/octet-stream')
            data = files[name]
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Security-Policy', POLICY)
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/{token}/'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def check_encoders(extension: str):
    for name in ('ffmpeg', 'ffprobe'):
        if not shutil.which(name):
            raise ValueError('Install ' + name + ' before rendering video.')
    text = subprocess.run(['ffmpeg', '-hide_banner', '-encoders'], capture_output=True, text=True, check=True, timeout=15).stdout
    available = {line.split()[1] for line in text.splitlines() if len(line.split()) > 1}
    needed = ('libx264', 'aac') if extension == '.mp4' else ('libvpx-vp9', 'libopus')
    if not set(needed) <= available:
        raise ValueError('This FFmpeg build needs the following encoders: ' + ', '.join(needed))


def encoder_command(output: Path, fps: int, frames: int, audio: Path | None) -> list[str]:
    command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-f', 'image2pipe', '-framerate', str(fps), '-vcodec', 'png', '-i', 'pipe:0']
    if audio:
        command += ['-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad']
    else:
        command += ['-map', '0:v:0', '-an']
    if output.suffix == '.mp4':
        command += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
        if audio:
            command += ['-c:a', 'aac', '-b:a', '192k']
    else:
        command += ['-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-crf', '28', '-b:v', '0', '-pix_fmt', 'yuv420p']
        if audio:
            command += ['-c:a', 'libopus', '-b:a', '160k']
    return command + ['-threads', '2', '-frames:v', str(frames), '-t', f'{frames / fps:.9f}', '-map_metadata', '-1', str(output)]


def probe_output(path: Path, width: int, height: int, fps: int, frames: int, audio: bool) -> dict:
    result = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(path)], capture_output=True, text=True, check=True, timeout=60)
    data = json.loads(result.stdout)
    videos = [s for s in data['streams'] if s['codec_type'] == 'video']
    sounds = [s for s in data['streams'] if s['codec_type'] == 'audio']
    if len(videos) != 1 or len(sounds) != int(audio):
        raise ValueError('Encoded output has an unexpected stream inventory.')
    video = videos[0]
    if (video['width'], video['height'], int(video['nb_read_frames'])) != (width, height, frames):
        raise ValueError('Encoded dimensions or frame count do not match the project render.')
    if abs(float(data['format']['duration']) - frames / fps) > max(0.05, 1 / fps):
        raise ValueError('Encoded duration differs from the frame schedule.')
    return {'videoCodec': video['codec_name'], 'audioCodec': sounds[0]['codec_name'] if sounds else None,
            'durationSeconds': float(data['format']['duration'])}


@contextmanager
def encoder_diagnostics(log_path: Path):
    """Preserve diagnostics when either a buffered write or close loses its reader."""
    try:
        yield
    except BrokenPipeError:
        with log_path.open('rb') as log:
            log.seek(0, os.SEEK_END)
            log.seek(max(0, log.tell() - 2000))
            tail = log.read().decode('utf-8', errors='replace').strip()
        detail = tail or 'No encoder diagnostics were produced; the export may have timed out.'
        raise ValueError('Video encoder stopped early: ' + detail) from None


def publish_files(staged: list[tuple[Path, Path]]):
    """Same-filesystem exclusive creation: never overwrite another export, even on a race."""
    created = []
    try:
        for source, target in staged:
            os.link(source, target)
            created.append(target)
    except BaseException:
        for path in created:
            path.unlink()
        raise


def render(args, *, on_frame=None) -> dict:
    output = args.output.absolute()
    if output.suffix not in ('.mp4', '.webm'):
        raise ValueError('Use an .mp4 or .webm output path.')
    report_path = output.with_suffix(output.suffix + '.json')
    if output.exists() or output.is_symlink() or report_path.exists() or report_path.is_symlink():
        raise ValueError('Output or report already exists. Choose a new filename; exports never overwrite.')
    if not output.parent.is_dir():
        raise ValueError('Create the output directory before exporting.')
    if args.width not in WIDTHS or args.fps not in FPS:
        raise ValueError('Choose a supported 16:9 resolution and frame rate.')
    check_encoders(output.suffix)
    files, revision = load_site(args.site, args.project)
    from playwright.sync_api import sync_playwright
    height = args.width * 9 // 16
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='.director-render-', dir=output.parent) as temp, local_fixture(files) as base:
        temp = Path(temp)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context(viewport={'width': 960, 'height': 540}, device_scale_factor=args.width / 960,
                locale='en-US', timezone_id='UTC', color_scheme='light', reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.set_default_timeout(30000)
            blocked, errors = [], []
            def route(request_route):
                request = request_route.request
                parsed = urlsplit(request.url)
                name = parsed.path.removeprefix(urlsplit(base).path)
                if request.method == 'GET' and request.url.startswith(base) and not parsed.query and name in files:
                    request_route.continue_()
                else:
                    blocked.append(request.url)
                    request_route.abort()
            context.route('**/*', route)
            page.on('pageerror', lambda error: errors.append(str(error)))
            process = None
            try:
                page.goto(base + 'render.html', wait_until='load')
                page.wait_for_function('Boolean(window.directorVideo)')
                metadata = page.evaluate('(options) => directorVideo.prepare(options)', {'sample': args.project is None,
                    'startMs': args.start_ms, 'endMs': args.end_ms, 'audio': not args.silent,
                    'captions': not args.no_captions, 'reducedMotion': args.reduced_motion})
                frames = frame_count(metadata['startMs'], metadata['endMs'], args.fps)
                audio = None
                if metadata['audio']:
                    audio = temp / 'mix.wav'
                    with audio.open('wb') as target:
                        for offset in range(0, metadata['audio']['bytes'], 262144):
                            chunk = page.evaluate('([offset, count]) => directorVideo.audioChunk(offset, count)', [offset, 262144])
                            target.write(base64.b64decode(chunk, validate=True))
                video = temp / ('video' + output.suffix)
                stderr_path = temp / 'encoder.log'
                with stderr_path.open('wb') as encoder_log, encoder_diagnostics(stderr_path):
                    process = subprocess.Popen(encoder_command(video, args.fps, frames, audio), stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=encoder_log)
                    # Bound a stalled pipe/encoder as well as ordinary per-frame work.
                    watchdog = threading.Timer(1200, process.kill)
                    watchdog.daemon = True
                    watchdog.start()
                    try:
                        for index in range(frames):
                            timestamp = metadata['startMs'] + index * 1000 / args.fps
                            frame = page.evaluate('(time) => directorVideo.frame(time)', timestamp)
                            image = page.locator('#stage').screenshot(type='png', caret='hide', animations='disabled', scale='device')
                            if struct.unpack('>II', image[16:24]) != (args.width, height):
                                raise ValueError('Captured frame dimensions differ from the selected output.')
                            if blocked or errors:
                                raise ValueError('Render-only host failed or attempted a non-approved request.')
                            if on_frame:
                                on_frame(index, image, frame)
                            process.stdin.write(image)
                            if video.exists() and video.stat().st_size > MAX_OUTPUT:
                                raise ValueError('Encoded output exceeds 512 MiB; choose a shorter range.')
                            if index % args.fps == 0:
                                print(json.dumps({'stage': 'frames', 'completed': index + 1, 'total': frames}), flush=True)
                        process.stdin.close()
                        if process.wait(timeout=180):
                            raise ValueError('Video encoder failed: ' + stderr_path.read_text(errors='replace')[-2000:])
                    finally:
                        watchdog.cancel()
                        if process.poll() is None:
                            process.terminate()
                            try:
                                process.wait(timeout=5)
                            except subprocess.TimeoutExpired:
                                process.kill(); process.wait(timeout=5)
                        if not process.stdin.closed:
                            try:
                                process.stdin.close()
                            except BrokenPipeError:
                                pass
                if video.stat().st_size > MAX_OUTPUT:
                    raise ValueError('Encoded output exceeds 512 MiB; choose a shorter range.')
                encoded = probe_output(video, args.width, height, args.fps, frames, not args.silent)
                report = {'rendererVersion': 1, 'fixture': 'orbit-960x540', 'siteRevision': revision,
                    **metadata, **encoded, 'width': args.width, 'height': height, 'fps': args.fps, 'frames': frames,
                    'captionsBurnedIn': not args.no_captions, 'reducedMotion': args.reduced_motion,
                    'chromium': browser.version, 'outputSha256': sha(video.read_bytes()), 'bytes': video.stat().st_size,
                    'elapsedSeconds': round(time.monotonic() - started, 2), 'warnings': [
                        'Fixed linear Orbit fixture, not arbitrary-site capture or interactive output.',
                        'Fonts, browser rasterization and codecs may vary by machine.',
                        'The last video frame is held to the next whole frame boundary; audio tail is padded with silence.',
                    ]}
                if metadata['audio'] and metadata['audio']['clippedSamples']:
                    report['warnings'].append('The voice mix clipped. Lower voice gain before rendering again.')
                staged_report = temp / 'report.json'
                staged_report.write_text(json.dumps(report, indent=2) + '\n')
                publish_files([(video, output), (staged_report, report_path)])
                return report
            finally:
                try:
                    if not page.is_closed():
                        page.evaluate('window.directorVideo?.close()')
                finally:
                    context.close()
                    browser.close()


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    source = result.add_mutually_exclusive_group(required=True)
    source.add_argument('--sample', action='store_true', help='Render the prepared Orbit sample.')
    source.add_argument('--project', type=Path, help='Render a saved .director project for the Orbit host.')
    result.add_argument('--output', type=Path, required=True, help='New .mp4 or .webm file; existing files are never overwritten.')
    result.add_argument('--site', type=Path, default=ROOT / 'site-dist', help='Local build directory, never a remote URL.')
    result.add_argument('--width', type=int, choices=WIDTHS, default=1280)
    result.add_argument('--fps', type=int, choices=FPS, default=30)
    result.add_argument('--start-ms', type=int, default=0)
    result.add_argument('--end-ms', type=int)
    result.add_argument('--silent', action='store_true', help='Explicitly omit audio, including missing takes.')
    result.add_argument('--no-captions', action='store_true', help='Do not burn in the active caption track.')
    result.add_argument('--reduced-motion', action='store_true', help='Use the viewer reduced-motion rendering.')
    return result


def main():
    try:
        result = render(parser().parse_args())
        print(json.dumps({'stage': 'complete', **result}, indent=2))
        return 0
    except KeyboardInterrupt:
        print(json.dumps({'stage': 'cancelled', 'message': 'Render cancelled; no incomplete output was published.'}))
        return 130
    except Exception as error:
        print(json.dumps({'stage': 'error', 'message': str(error)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
