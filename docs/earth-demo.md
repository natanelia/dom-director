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

The homepage starts in **Try** mode. Each checkpoint waits for its actual control
interaction. **Watch** introduces controls without requiring completion;
**Guide** also waits for an explicit next step between scenes. All three modes have
separate, in-memory globe state and completion records. Reset practice explicitly
resets only Try. Reset world changes the view without erasing learned checkpoints.

The existing core owns timing, captions, the visual cursor, gates, pause, exit,
seeking and saved visual positions. A simulated pointer never clicks the app.
Seeking, replaying captions or restoring a visual position never applies or
reverses globe settings. Changing globe settings invalidates a saved position's
fixture version; the checkpoint store reports that mismatch.

This story is caption-first. It does not reuse the unrelated Orbit narration.
Studio's six voice clips have text and no audio asset, ready for an explicitly
imported or recorded take through the existing controls.

## Studio and compatibility

The normal Studio route opens the six-scene Earth sample. **Try controls**
pauses the preview and enables the real app. Returning to editing preserves its
live view. The timeline edits presentation tracks; saved .director files do not
record globe interactions or persist its live settings.

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

## Validation

The sample and canonical tutorial have model coverage. The browser review runner
includes the Earth journeys in the same staged and deployed checks as Studio:
all six Try gates, pixel changes for every control, keyboard/drag interaction,
seeking, reset, mobile layout, mode isolation, host switching and cleanup.
Earth states are also included in the existing accessibility audit.

Run the existing package, site, Studio, video and publication checks. Browser
results and screenshots must be inspected for the current PR head before claiming
visual acceptance. Automated browser and accessibility evidence does not certify
physical mobile devices or screen-reader behavior.
