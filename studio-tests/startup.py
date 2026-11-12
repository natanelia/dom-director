"""Bounded diagnostics for the synthetic Studio fixture; never retries a failure."""
import json
import time
from pathlib import Path
from urllib.parse import urlsplit

READY = """() => {
  const root = document.querySelector('#studio');
  return !!root && ['true', 'error'].includes(root.dataset.ready);
}"""
STATE = """() => ({
  documentState: document.readyState,
  ready: document.querySelector('#studio')?.dataset.ready ?? null,
  status: (document.querySelector('#status')?.textContent ?? '').slice(0, 500)
})"""


def navigate_studio(page, url, report_path, *, timeout_ms=8000):
    """Require a real ready state, retaining startup evidence before rethrowing.

    The caller owns/cleans the page, including when this function fails in setUp.
    Diagnostic requests contain paths/status only: no queries, headers or bodies.
    Reduced timeouts are for deliberately broken fixtures, not production retries.
    """
    origin = urlsplit(url)
    requests, errors, listeners = {}, [], []
    started = time.monotonic()

    def path(value):
        try:
            parsed = urlsplit(value)
            if (parsed.scheme, parsed.netloc) != (origin.scheme, origin.netloc):
                return '<external>'
            return parsed.path[:250]
        except ValueError:
            return '<invalid-url>'

    def requested(request):
        if len(requests) < 100 and request.resource_type in ('document', 'script', 'stylesheet'):
            requests[request] = {'path': path(request.url), 'type': request.resource_type, 'state': 'pending'}

    def responded(response):
        if response.request in requests:
            requests[response.request].update(status=response.status)

    def finished(request):
        if request in requests:
            requests[request]['state'] = 'finished'

    def failed(request):
        if request in requests:
            requests[request]['state'] = 'failed'

    def page_error(error):
        # Counts and error classes identify evaluation failure without retaining
        # arbitrary exception messages, source text or a user-authored value.
        if len(errors) < 16:
            errors.append(type(error).__name__)

    def on(event, callback):
        page.on(event, callback)
        listeners.append((event, callback))

    for event, callback in [('request', requested), ('response', responded),
                            ('requestfinished', finished), ('requestfailed', failed),
                            ('pageerror', page_error)]:
        on(event, callback)
    try:
        response = page.goto(url)
        if response is None or response.status != 200:
            raise AssertionError('Studio document did not return HTTP 200.')
        page.wait_for_function(READY, timeout=timeout_ms)
        if page.locator('#studio').get_attribute('data-ready', timeout=1000) != 'true':
            raise AssertionError('Studio reported an initialization error.')
        if errors:
            raise AssertionError('Studio raised a JavaScript error during startup.')
        if any(row['state'] == 'failed' or row.get('status', 200) >= 400 for row in requests.values()):
            raise AssertionError('A Studio startup resource failed to load.')
    except Exception as error:
        report = {'errorType': type(error).__name__, 'elapsedMs': round((time.monotonic() - started) * 1000),
                  'document': path(url), 'requests': list(requests.values()), 'pageErrors': errors}
        try:
            report['state'] = page.evaluate(STATE)
        except Exception:
            report['state'] = {'unavailable': True}
        output = Path(report_path)
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, indent=2) + '\n')
        except OSError:
            report['reportWriteFailed'] = True
        # CI logs retain the bounded report even when artifact upload is unavailable.
        print('STUDIO_STARTUP_FAILURE ' + json.dumps(report), flush=True)
        try:
            page.screenshot(path=str(output.with_suffix('.png')), timeout=1000)
        except Exception:
            pass  # Diagnostic capture must never replace the original failure.
        raise
    finally:
        for event, callback in listeners:
            page.remove_listener(event, callback)
