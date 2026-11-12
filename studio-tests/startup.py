"""Bounded diagnostics for the synthetic Studio fixture; never retries a failure."""
import json
import time
from pathlib import Path
from urllib.parse import urlsplit

READY = """() => {
  const root = document.querySelector('#studio');
  return !!root && ['true', 'error'].includes(root.dataset.ready);
}"""


def navigate_studio(page, url, report_path, *, timeout_ms=8000):
    """Require a real ready state, retaining startup evidence before rethrowing.

    The caller owns/cleans the page, including when this function fails in setUp.
    Diagnostic requests contain paths/status only: no queries, headers or bodies.
    Reduced timeouts are for deliberately broken fixtures, not production retries.
    """
    origin = urlsplit(url)
    requests, errors, listeners = {}, [], []
    resource_failure = False
    started = time.monotonic()

    def path(value):
        try:
            parsed = urlsplit(value)
            if (parsed.scheme, parsed.netloc) != (origin.scheme, origin.netloc):
                return '<external>'
            return parsed.path[:250]
        except ValueError:
            return '<invalid-url>'

    def relevant(request):
        return request.resource_type in ('document', 'script', 'stylesheet')

    def requested(request):
        if len(requests) < 100 and relevant(request):
            requests[request] = {'path': path(request.url), 'type': request.resource_type, 'state': 'pending'}

    def responded(response):
        nonlocal resource_failure
        if relevant(response.request) and response.status >= 400:
            resource_failure = True
        if response.request in requests:
            requests[response.request].update(status=response.status)

    def finished(request):
        if request in requests:
            requests[request]['state'] = 'finished'

    def failed(request):
        nonlocal resource_failure
        if relevant(request):
            resource_failure = True
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
        if resource_failure:
            raise AssertionError('A Studio startup resource failed to load.')
    except Exception as error:
        report = {'errorType': type(error).__name__, 'elapsedMs': round((time.monotonic() - started) * 1000),
                  'document': path(url), 'requests': list(requests.values()), 'pageErrors': errors,
                  'resourceFailure': resource_failure, 'state': {'unavailable': True}}
        output = Path(report_path)

        def persist():
            try:
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(report, indent=2) + '\n')
            except OSError:
                report['reportWriteFailed'] = True
            print('STUDIO_STARTUP_FAILURE ' + json.dumps(report), flush=True)

        # Retain transport evidence before making any call to a possibly frozen
        # renderer. Locator reads have explicit deadlines; page.evaluate does not.
        persist()
        state = {}
        for name, read in [
            ('ready', lambda: page.locator('#studio').get_attribute('data-ready', timeout=500)),
            ('status', lambda: page.locator('#status').text_content(timeout=500)),
        ]:
            try:
                value = read()
                state[name] = value[:500] if isinstance(value, str) else value
            except Exception:
                state[name] = None
                state['unavailable'] = True
        report['state'] = state
        persist()
        try:
            page.screenshot(path=str(output.with_suffix('.png')), timeout=1000)
        except Exception:
            pass  # Diagnostic capture must never replace the original failure.
        raise
    finally:
        for event, callback in listeners:
            page.remove_listener(event, callback)
