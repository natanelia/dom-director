# 11 · Accessibility and inclusive interaction

## Release objective

Aim for WCAG 2.2 AA for the player and supplied examples, plus an explicit non-moving alternative informed by Animation from Interactions (a AAA criterion). This is a design target, not a conformance statement. The host application remains responsible for its own accessibility; zooming an inaccessible app does not repair it. [S6](21-sources.md).

## Equivalent experiences

The same explanation must be usable as a cinematic presentation, a stable step-by-step guide, and a transcript with semantic target links. Narration, cursor movement, color, spatial position, and sound must not be the only way to convey essential information. “Click over there” is not sufficient; name the control and outcome.

Respect `prefers-reduced-motion` at start and when it changes. The user's preference outranks the script. Offer a persistent motion toggle. The reduced-motion path uses no camera movement by default, not merely a faster zoom. Static highlights and text can convey the same sequence. Essential application motion is a separate host concern.

## Keyboard and focus

Every player control is keyboard reachable with a visible focus indicator and an accessible name. Do not steal focus when the camera pans. Keep controls outside the transformed scene and test that camera framing never makes them unreachable. Explicit “Go to target” controls may focus the host element; preserve logical reading order.

Space/arrow shortcuts apply only when the player owns the relevant focus, not while a user edits an input or uses another widget. Escape exits or presents a non-blocking stop path. Focus restoration respects user movement and disconnected elements. A guide is not automatically a modal dialog; do not trap focus unless the specific UI is genuinely modal.

## Captions and transcript

Provide captions for narrated content, including relevant non-speech audio and speaker identification. Make CC selection and language discoverable. Captions are outside the camera scene, can be enlarged, and avoid covering the active target. Keep a complete transcript available even when audio cannot play. [S5–S6](21-sources.md).

Screen-reader mode favors semantic step headings, summaries, and user-controlled progression. Do not announce captions continuously while a screen reader reads the same transcript. Live regions report concise state changes such as “Step 2: Review the issue,” not every camera frame or word.

## Time and attention

Pause and stop remain visible. Give users enough time to read; allow longer waits and avoid a hidden timer that forces task completion. Any unavoidable host deadline is stated explicitly. Do not use flashing indicators, repeated pulsing, or distracting background animation. A skip action must be reachable without navigating through every target.

The progress UI distinguishes nominal media time, current scene, and unknown interactive wait time. A screen reader should hear “Waiting for you to open Settings,” not an indefinitely stalled percentage.

## Contrast, zoom, and responsive behavior

Do not rely on spotlight contrast alone. Annotations need text/background contrast and a clear relationship to targets. Test high contrast/forced colors, dark mode, large text, browser zoom, narrow viewports, and orientation changes. Respect device safe areas and the on-screen keyboard. Do not disable browser zoom using viewport metadata or gesture interception.

Camera magnification can hide context. Offer an immediate overview/reset, and choose guide mode when a high scale would crop necessary controls. A tool-tip-like annotation should not become unreadable because it is scaled with the app.

## Choice and privacy

Do not infer disability from use of captions, slow playback, or reduced motion. Store preferences only with appropriate local/user consent and avoid transmitting them by default. Assessment and training features must distinguish optional usage analytics from task evidence, and neither should collect unnecessary personal data.

## Manual acceptance matrix

Keyboard-only users can load, start, pause, change speed, toggle captions, read the transcript, move between scenes, make branch choices, reach a target, and exit. Screen readers can understand scenes without following motion. Reduced-motion users receive equivalent content. Large-text/mobile users can reach controls and read captions without clipping. Real users should review a representative guide before claiming broad usability.

Automated accessibility checks are useful for obvious structural failures but do not certify narration quality, focus logic, motion comfort, reading order, or actual assistive-technology behavior.
