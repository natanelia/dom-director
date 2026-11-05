# Example scripts

These are validated **design fixtures**, not runnable tours. The runtime and corresponding host applications/adapters have not been implemented. All content and identifiers are synthetic.

| File | Demonstrates |
|---|---|
| [minimal.tour.json](minimal.tour.json) | Simple camera, annotation, cursor, and reset |
| [narrated-settings.tour.json](narrated-settings.tour.json) | Narration phrase anchors, captions, transcript; text-only until an approved audio asset is supplied |
| [guided-task.tour.json](guided-task.tour.json) | User-driven condition gate and timeout |
| [branching.tour.json](branching.tour.json) | Accessible choices in an acyclic scene graph |
| [safe-fixture.tour.json](safe-fixture.tour.json) | Separate host action and outcome gate; requires a real isolated fixture implementation |
| [semantic-map.tour.json](semantic-map.tour.json) | Registered non-DOM semantic target projected by a host |
| [seek.command.json](seek.command.json) | Revision-checked, presentation-only agent seek |
| [preview.command.json](preview.command.json) | Static agent preview request |
| [blocked-seek.diagnostic.json](blocked-seek.diagnostic.json) | Machine-readable recovery choices |
| [media/settings.en.vtt](media/settings.en.vtt) | Caption interchange derived from the narrated-settings fixture |

The word “safe” in a filename does not grant permission or establish sandboxing. The host must implement and authorize every action and condition. None of these examples contacts a production app or contains a voice recording.
