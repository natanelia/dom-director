# Local video export: real DOM frames, not a screen recording

`tools/render_video.py` renders a saved Studio project for the controlled Orbit
host into MP4 (H.264/AAC) or WebM (VP9/Opus). It uses the existing Studio canvas,
camera/cursor evaluator, caption renderer and offline voice mix. Rendering samples
the project at exact frame times; a slow machine does not slow down the finished
walkthrough. No screen picker, microphone, provider, remote rendering service or
production application action is involved.

This is the first **local rendering path**, not an in-browser video-download
button, arbitrary-site recorder, interactive bundle publisher or general host
adapter. Studio's Save project remains the way to transfer the editable draft.
The CLI itself is not published to the website. Studio provides the separate
local-export settings panel described below.

## Prepare settings in Studio

Open **Export → Video (local)…** to choose MP4/WebM, resolution, frame rate,
an entire saved project or exact time range, narration, styled captions and
reduced motion. The panel generates a command for this CLI; it does not start a
render, execute shell commands, contact a rendering service or upload your work.
These output choices are independent of preview Sound off, CC and Motion switches.

Use **Save current project (.director)** in that panel. Place the intended download
in the prepared checkout as `walkthrough.director`; browsers may rename repeated
downloads, so check the filename. Copy the command, then run it locally after the
setup below. It reads that saved project, not later edits in the browser. Existing
output files and their reports are never overwritten. Settings live only in memory.
Closing the panel keeps the draft; opening it pauses preview without resetting it.

The command accepts only supported format/resolution/frame-rate choices and exact
millisecond ranges. Invalid or over-two-minute ranges clear the command and disable
Copy. When clipboard permission is unavailable, the command remains selectable.
The Studio publication allowlist includes the small settings module explicitly;
the render-only host removes it and never runs the editor or export-panel code.

## Run it

From a source checkout, build the public fixture and install the browser used by
the renderer. Install FFmpeg and ffprobe through your normal system package manager;
the selected FFmpeg build must include the requested video and audio encoders.
The CLI checks availability and does not silently switch formats.

```sh
python3 -m pip install -r demo/requirements-browser.txt
python3 -m playwright install chromium
python3 tools/build_runtime.py
python3 tools/build_site.py

# Prepared sample, 720p at 30 fps, styled captions and narration included.
python3 tools/render_video.py --sample --output walkthrough.mp4

# A .director file saved from Studio. Local audio is read from its checked bundle.
python3 tools/render_video.py --project my-tour.director --output my-tour.webm

# Export a chosen project-time range. End is exclusive; times are milliseconds.
python3 tools/render_video.py --project my-tour.director --output excerpt.mp4 \
  --start-ms 6980 --end-ms 15188 --width 1920 --fps 30
```

On Linux, browser dependencies may require `python3 -m playwright install --with-deps
chromium`. The builder requires a new output directory; remove an earlier build
explicitly before rebuilding, or use its `--output` option and the renderer's
`--site` option. The renderer does not build, download dependencies, or overwrite
files on your behalf. The reference acceptance environment is Linux Chromium;
no cross-platform/device certification is implied.

Choose 960 × 540, 1280 × 720 or 1920 × 1080 output with `--width`; choose 24, 30 or
60 fps. The logical application canvas stays 960 × 540. Output resolution changes
raster density rather than rearranging the application. Other aspect ratios and
custom application surfaces need a separately reviewed host integration.

`--no-captions` omits the active caption language from the picture. By default,
its styling and authored word highlighting are burned into the video. Export
VTT/SRT separately from Studio when a player needs selectable captions.
`--silent` explicitly omits the audio stream; it is not inferred from the editor's
Sound off switch. `--reduced-motion` uses the existing reduced-motion evaluator.
Disabled tracks, source windows, gain and fades retain their existing semantics.

An enabled voice clip with no take, missing media, incompatible host dimensions,
unavailable target or invalid project stops export. A non-narrated project can be
exported with `--silent`. The prepared sample uses approved local build assets;
custom takes stay in the saved `.director` bundle. Nothing is uploaded.

## Timing and output

The frame count is `ceil((endMs - startMs) × fps / 1000)`. Frame zero samples exactly
`startMs`; each later frame samples `startMs + frameIndex × 1000 / fps`, never the
exclusive end. There is no accumulated rounded-millisecond clock. A partial final
frame holds until its frame boundary, and the audio tail is padded with silence.
Voice processing uses the same 48 kHz stereo mix as the WAV exporter. The mix is not
audio recorded from live playback; waveform decoding/resampling is browser-owned.

The CLI streams PNG frames to FFmpeg without keeping a whole image sequence in
memory or on disk. It validates the finished stream dimensions, decoded frame count,
and duration using ffprobe. Only then are the output and a `.mp4.json` / `.webm.json`
report installed with exclusive file creation. Existing videos or reports are never
overwritten, including a concurrent creation during rendering. Save to a local
filesystem that supports hard links.

The report includes the project hash, site build revision, browser version, exact
range, frame count, output digest, codecs and voice clipping report. It does not
include the authored script, caption text, voice names or input file contents.
It is evidence about that render, not a universal pixel-identical output guarantee.
Fonts, browser rasterization, decoding and encoder builds can vary by machine.

Press Ctrl+C to cancel. The browser, owned audio/canvas resources and encoder are
closed, temporary data is removed, and no incomplete final file is published.
Encoding is bounded by a watchdog; each export is limited to two minutes and
512 MiB of encoded output. Export smaller ranges for longer projects. A clipped
voice mix remains clipped in the video: lower gain and render again. There is no
hidden normalization, mastering, time-stretching or automatic repair of missing media.

## Trust boundary

The tool serves only hash-verified, explicitly selected files from a local Studio
build, plus the chosen project and render host. It binds to loopback on a random
port with a per-run unguessable path. It provides no directory listing or generic
file endpoint. A fresh browser context has no user profile, cookies, permissions
or service workers; outgoing requests are restricted to those exact local inputs.
A project is bounded data validated by the existing bundle reader, never executable
HTML or a URL to navigate. The trusted source checkout/build remains executable
application code, so review it before running it, as with other development tools.

The app stays inert. The renderer never calls Studio's editor boot script, starts
its playback transport, or dispatches simulated app events. Captions and cursor
layers share the ordinary canvas renderer; editing handles, editor chrome and
LIVE DOM badges are excluded. This pipeline captures the supplied fixture only,
not arbitrary changing host state, browser dialogs, cross-origin frames or a desktop.

## Verification

`python3 studio-tests/video_export_test.py VideoModelTests` checks frame schedules,
encoder arguments, manifest checks, the loopback allowlist, template boundaries and
exclusive publication. The full suite adds actual Chromium/FFmpeg renders, decoded
MP4 frame comparisons at a scene boundary, encoded audio onset/silence checks with
a bundled synthetic tone, WebM output, 1080p silent output, cancellation and failures.

The `Studio video export` workflow keeps synthetic videos, sampled DOM frames and
render reports for review. No user project or private audio is used in those tests.
Inspect its actual result before claiming a particular revision passed; a test
being present is not a passing measurement. This renderer does not close the
hands-on usability, physical-device or assistive-technology work in issue #19.

Platform references, consulted 8 November 2026:
[Playwright screenshot API](https://playwright.dev/python/docs/api/class-locator#locator-screenshot),
[FFmpeg input/encoding options](https://ffmpeg.org/ffmpeg.html), and
[FFmpeg image-sequence formats](https://ffmpeg.org/ffmpeg-formats.html#image2).
