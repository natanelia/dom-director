# 22 · Flagship demo: a living story

**Decision:** The demo is a core product workstream, not decoration postponed until M6. Its job is to make someone say, “Wait—that was not a video?” and then prove why that matters.

**Current artifact:** [Interactive concept demo](../demo/index.html), [source and running instructions](../demo/README.md). The standalone fixture implements a narrow presentation experience. It is not the reusable SDK, does not consume the proposed canonical tour schema, and does not close M1–M6. See [demo evidence](../demo/VALIDATION.md) for what was actually exercised.

## Creative direction

Working title: **Not a video. A living story.**

Avoid a generic dark-gradient software landing page, decorative moving particles, or six feature cards masquerading as a demonstration. Use an editorial film-studio identity: warm paper, dark olive ink, restrained vermilion, oversized typography, fine technical labels, and a carefully composed green mission-control application. The live product is the visual centerpiece. Its supporting page stays still enough that the camera movement has meaning.

Use a synthetic application called Orbit. No employer screenshots, real route data, customer names, accounts, backend credentials, or company branding. Its city map is illustrative SVG, not an actual geographic claim. Its apparent metrics describe only the fictional fixture.

The first meaningful action is **Roll the demo**. Do not force installation, sign-in, a newsletter, microphone permission, or an AI key. Audio begins muted and the story works without it. Do not autoplay a moving hero or make the visitor hunt for the exit.

## Three proof moments

**1. The interface becomes the shot.** Start with a recognizable working application; then focus on one detail without replacing the app with a picture. A persistent “real DOM” label is a claim the visitor can verify by inspecting or interacting. Do not fake browser chrome or a remote session.

**2. Break the fourth wall.** Pause at a real checkpoint. The visitor clicks the actual app button, sees its state and metric change, and continues. The simulated cursor is labeled. It never stands in for consent and never secretly dispatches a trusted click.

**3. Reveal the machinery.** Show the exact current cue and a selectable transcript. Scrubbing changes the camera and captions, not the committed fixture action. The same experience can be watched, practiced, or followed at the visitor's pace.

## Current 45-second storyboard

The exact millisecond boundaries come from [the cue sheet](../demo/assets/cues.json), not rounded marketing timestamps.

| Shot | Composition | Proof |
|---|---|---|
| The bigger picture | Establish the Orbit workspace | A real interface, not a recording |
| Find the signal | Move to route metrics | Attention is directed without reflowing the scene |
| Follow the story | Move across the route map | Camera, caption and visual cursor share a time source |
| Take the wheel | Frame the review card; on phones, the approval control | Try mode waits for an actual user action |
| Make it yours | Frame the live approval control | Watch / Try / Guide alter the pacing, not the identity of the app |
| Still your app | Return to the workspace | The final frame remains interactive |

The page includes a chapter rail, seek control, play/pause, restart, playback rate, captions, transcript, mute, reduced-motion setting, takeover, live cue view, JSON export, and three easing personalities. These are fixture features, not a guarantee that equivalent public APIs exist.

## Modes and contracts

**Watch:** continuous presentation. Clicking into the application pauses presentation and hands over control. Seeking is presentation-only. No application state is implicitly reset.

**Try:** pause at the checkpoint until the user approves it. Forward seeking cannot bypass an unfinished gate. A completed approval remains completed when the user seeks backward. Resetting the sandbox is a separate explicit control.

**Guide:** hold at chapter boundaries for Next or Play, and additionally hold at the checkpoint until completion. This is a small fixture guide, not a general outcome/condition engine.

**Reduced motion:** keep the camera in its overview framing and suppress the simulated cursor. Retain captions and transcript. The small controls inside the scaled mobile overview still need further usability work; do not call the prototype accessibility-certified.

**Audio:** use the prepared embedded narration's media position as the visual time authority. A rejected play request falls back to a text-only clock, with an explicit notice. This prototype uses locally generated eSpeak narration as a placeholder. Commission or create a better licensed voice before judging the production experience. No live TTS provider is part of the page.

## Responsive cinematography

Do not shrink a desktop film and call it mobile support. Compose the shot for the available aperture. Orbit retains its layout dimensions while the demo camera changes. The mobile checkpoint shot frames the approval control itself rather than trying to make every line of the full side panel readable.

Clamp camera translation to the scene's boundaries where possible: zooming into a right-edge control must not reveal a large empty region outside the application. Captions, player controls, and exit stay outside the transform. Resize invalidates measurements; animation frames use cached geometry rather than continuously measuring the DOM.

The prototype proves this only for its controlled wrapper and viewport. Portals, native top-layer controls, nested scrollers, browser zoom and arbitrary apps remain M1/M5 integration work.

## The next remarkable experiences — proposals, not implemented

Keep one excellent default film. Add scenarios only when each proves a different property of the engine:

| Concept | Memorable moment | Requirement / dependency |
|---|---|---|
| **The page directs itself** | A tour moves from its own launch button into its player, pauses over the actual narration controls, then reveals the script that caused it | Reusable engine first; explicit whole-page surface contract; no scroll trap |
| **A question becomes a scene** | A visitor chooses “show me what changed,” sees an approved script preview, then gets a focused visual explanation | Real capability catalog, validation and provenance; never present canned output as live AI |
| **Choose your ending** | The same story branches based on an actual user decision, then shows the resulting app state | Canonical branching semantics, safe fixture effects |
| **The data explains itself** | A chart directs attention to an outlier, exposes its underlying rows, and returns to the broader story | Allowlisted chart/virtual-target adapter; synthetic or approved data |
| **A map tells the investigation** | DOM framing hands off to a native map camera to explain a route and its checkpoints | Separate camera leases; do not magnify the page and the map accidentally |
| **A replay you can repair** | A bug reproduction pauses before failure; the learner changes a local setting and explores another path | Deterministic isolated fixture; not a claim to undo production state |
| **A story in your language** | Switch language, voice and captions while preserving the semantic point in the story | Locale-specific cue alignment; no assumption that translations share durations |
| **An agent shows its work** | Preview the proposed action visually, then allow the human to approve the exact action and parameters | M5 policy/agent bridge; simulated gestures never grant authority |
| **One take, three framings** | A visitor switches phone/tablet/desktop aperture and sees shots recomposed without losing their place | Geometry/target evidence; layout resizing is distinct from camera movement |
| **The freeze-frame test** | Pause anywhere, select text, use a control and inspect the DOM | Real app integration; no screenshot overlay impersonating interactivity |

Remote collaboration, export to video, user app embedding, narration upload and live AI are deliberately excluded from this initial page. They bring separate security, privacy, hosting and compatibility requirements.

## Developer conversion without breaking the spell

After the film, reveal a small honest implementation example and the live cue inspector. The current cue inspector exposes the actual **demo-local** data; do not label it as the canonical SDK schema. A later production site should let developers edit bounded camera/caption fields, validate the result, and replay a fixture. Editing narration text must either update the prepared audio or switch explicitly to text-only playback.

Offer a single copyable integration path only once it genuinely runs. Do not publish fictional npm install instructions, a non-existent repository link, fabricated download numbers, testimonials, star counts, “60 fps” badges, or a fake AI chat.

## Demo workstream across milestones

| Stage | Deliverable | Evidence needed |
|---|---|---|
| D0 / M0–M1 | Creative direction + standalone fixture prototype | This page, repeatable fixture tests, clear limits |
| D1 / M1–M2 | Replace fixture camera/player with the real packages | Same story driven by canonical script; actual integration and lifecycle tests |
| D2 / M3 | Production narration, controls and transcript | Measured media skew; real keyboard/screen-reader review; Safari/iOS checks |
| D3 / M4 | Trustworthy Watch / Try / Guide | One script, permission-aware fixture effects, cancellation and seek barriers |
| D4 / M5 | Agent-directed scenario and framework example | Real discovery/validation/preview; no canned response labeled as AI |
| D5 / M6 | Public launch site and evidence | Approved hosting, support table, budgets/traces, package/repository links that exist |

D0 does not reorder the library's dependency chain. It lets design lead the implementation while preserving truthful release status. The flagship is a living acceptance fixture, not a second independent product maintained forever.

## Release bar

The hero must explain itself in seconds and make the primary button obvious. The mobile flow must keep its important controls usable. Visitors must be able to stop, mute, read, inspect or leave at any point. No default telemetry, capture or persistence. No third-party requests simply to load a font or play narration.

Production release requires keyboard and screen-reader review, reduced-motion verification, contrast and target-size review, automated browser coverage, long-run cleanup checks, real browser/device performance traces, and deployment validation. Existing fixture tests are not a substitute for those gates.

Measure actual supported-device behavior before making numeric performance claims. A future opt-in evaluation can examine comprehension and successful interaction; completion alone is not proof that users understood the product.

## Platform references

The implementation uses the browser's [media currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime) and [playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate), not a second independent audio timer. The containing-block implications of [CSS transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform) are why this demo uses an intentional scene wrapper and a separate overlay. These platform references support architectural choices, not a cross-browser certification of this prototype.
