# Earth: an interactive statistics story

The default live demo and Studio example now use **Earth Observatory**, a locally
rendered globe whose controls change the application itself. All statistics are
fictional, and the authored continent outlines are simplified. The app labels both
as illustrative demo content; it is not a geographic or statistical data source.

## Six checkpoints

| Checkpoint | Real interaction | Visible result |
|---|---|---|
| Take the planet for a spin | Drag the globe or press an arrow key | Rotate the sphere and reveal different places |
| See a different world | Select Energy | Change data colors and pillar heights |
| Move through time | Move the year to 2020 or later | Change the data pillars and summary |
| Bring a region into focus | Select Asia Pacific | Rotate toward Asia and emphasize the region |
| Connect the dots | Turn on Connections | Add raised arcs between sample cities |
| Discover the world after dark | Turn on Night view | Change the lighting and reveal city lights |

The homepage starts in **Watch** mode. Playing the tour automatically demonstrates
all six controls: rotation, Energy, 2025, Asia Pacific, connections and night view.
Each local demonstration runs through an explicitly registered temporary host
action; the simulated pointer never dispatches input. Watch reports controls
demonstrated, rather than claiming that the visitor completed them personally.

**Try** remains available and waits for each actual control interaction.
**Guide** retains those real-input checkpoints and also waits for an explicit next
step between scenes. All three modes have separate, in-memory globe state and
completion records. Switching modes starts a fresh presentation run and preserves
that mode's globe. Reset practice resets only Try. Reset world changes the view
without erasing learned checkpoints.

**Replay demo** explicitly resets Watch's globe and starts a new automatic run.
Watch's restart button resets the same demo and leaves it paused. Try's restart
remains a visual rewind and does not undo practice interactions. Actual input or
Explore freely pauses Watch so visitors can take over.

The existing core owns timing, captions, the visual cursor, gates, pause, exit,
seeking and saved visual positions. A simulated pointer never clicks the app.
Seeking, replaying captions or restoring a visual position never applies or
reverses globe settings. Changing globe settings invalidates a saved position's
fixture version; the checkpoint store reports that mismatch. A forward seek
cannot cross an unplayed host action; normal playback demonstrates it first.
Resolved actions are not repeated by seeking backward and playing again in the
same run. Explicit Watch replay is the separate fresh-run operation.

Each checkpoint starts a neutral cursor journey toward its control at scene time
zero, alongside the camera cue. The existing highlight and arrival cues still
start at 700 ms, and the real interaction gate remains at 1800 ms. Cursor travel
continues between controls even when the camera keeps the same overview pose.
The Watch action precedes the gate at 1800 ms; it is a no-op in Try and Guide,
which still require the real input. A 700 ms click ring marks Watch's demonstrated
control and follows the presentation clock, including pause and visual seeking.
Real pointer and keyboard inputs also receive short, bounded click feedback.

This story is caption-first. It does not reuse the unrelated Orbit narration.
Studio's six voice clips have text and no audio asset, ready for an explicitly
imported or recorded take through the existing controls.

## Studio and compatibility

The normal Studio route opens the six-scene Earth sample. **Try controls**
pauses the preview and enables the real app. Returning to editing preserves its
live view. The timeline edits presentation tracks; saved .director files do not
record globe interactions or persist its live settings.
Each Earth cursor clip includes a click gesture at 1.8 seconds. Its ring appears
in Studio preview and video export, but this visual track does not execute the
public Watch host actions or change the globe itself.

The original examples remain available through the **Original Orbit example**
and **Orbit example** links, using the example=orbit query parameter.
Opening an existing project chooses its matching host from its semantic targets.
Mixed Earth and Orbit targets are rejected rather than silently redirected.
The original createSample() API still returns Orbit; createEarthSample() is additive.

The local video renderer supports both controlled hosts. Earth video rendering
uses the initial globe view and the project's camera, cursor, captions and audio.
It does not reconstruct live exploration performed before saving. Use silent
export until narration takes have been attached; missing takes remain errors.
No general 3D camera adapter, arbitrary-page integration or interaction recorder
is implied.

## Rendering and accessibility

The Earth host owns a Canvas 2D rendering of spherical 3D geometry. It draws
depth-clipped land, city pillars and curved connections, with bounded transitions
only when a view changes. No animation loop runs while the globe is idle.
The app has no runtime dependency, texture download, remote statistics request,
analytics, account connection or default storage.

Native DOM controls expose the same settings as the globe. The canvas supports
arrow keys, plus/minus and Home. The Motion control and operating-system reduced
motion preference suppress animated transitions. Public mobile and Studio Try
layouts use native-size controls below the globe. Captions, progress, instructions
and exit remain outside the transformed scene.
Reduced motion hides the authored moving click ring and gives real inputs a short
static outline. Click feedback does not dispatch events or change the app state.

## Validation

The sample and canonical tutorial have model coverage. The browser review runner
includes the Earth journeys in the same staged and deployed checks as Studio:
all six automatic Watch changes and Try gates, pixel changes for every control,
click timing, keyboard/drag interaction, seeking, replay, reset, mobile layout,
mode isolation, host switching and cleanup.
Earth states are also included in the existing accessibility audit.

Run the existing package, site, Studio, video and publication checks. Browser
results and screenshots must be inspected for the current PR head before claiming
visual acceptance. Automated browser and accessibility evidence does not certify
physical mobile devices or screen-reader behavior.
