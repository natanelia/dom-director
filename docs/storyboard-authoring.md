# Storyboard authoring

The optional `@dom-director/core/storyboard` entry turns a small, data-only storyboard into the same canonical tour used by the runtime and agent bridge. It is implemented, requires no DOM, and adds no runtime dependency. Packages remain local/private candidates, not npm releases.

```ts
import {compileStoryboard, readStoryboard, type Storyboard} from '@dom-director/core/storyboard';

const board = {
  version: 1,
  id: 'first-tour',
  title: 'Find the important detail',
  locale: 'en',
  scenes: [{
    id: 'overview',
    title: 'Your reports',
    target: 'app.reports',
    description: 'Start with the reports overview.',
    durationMs: 3500,
    transitionMs: 900,
    maxScale: 2,
    cursor: true,
  }],
} satisfies Storyboard;

const result = compileStoryboard(board);
if (result.ok) {
  // Save/export result.value, or pass it to the existing review/load flow.
  // Generating a script never authorizes it or starts playback.
  const imported = readStoryboard(result.value);
}
```

## Contract

All compact fields are required. The helper accepts a plain data object or JSON text and returns the normal discriminated `Result`. It rejects unknown fields, callbacks, getters, cycles, duplicate JSON keys and out-of-budget data. Diagnostics do not echo supplied content. Successful results are frozen copies; source objects are never changed.

The bounded subset is 1–50 linear Watch scenes, 250–60,000 milliseconds per scene, a camera transition from zero through the scene duration, a maximum scale of 0.1–4, an outline highlight, an optional simulated pointing cursor, and one caption/transcript per scene. Text is not synthesized into audio. Blank titles/instructions are rejected. Scene and tour IDs are at most 64 ASCII identifier characters; target references use the canonical 80-character identifier bound. Titles are at most 200 Unicode code points, instructions 4,000, and locale strings 64 characters. The existing 1 MiB JSON budget also applies.

Scene, target-alias, cue and caption IDs derive from the authored scene identity, not array position. Reordering rewires only the linear `next` edges and entry scene. To duplicate a scene, assign it a new unique ID. Removing a scene does not leave a dangling edge when the storyboard is recompiled.

`readStoryboard` accepts canonical JSON only when rebuilding it preserves every canonical field, ignoring object-property order. Metadata, audio assets, custom IDs, alternate easing, additional cues, branches, gates or effects cause an explicit refusal, not a lossy conversion. Keep using the canonical JSON editor for those scripts. This is a deliberately narrow round-trip contract, not a general-purpose tour importer.

## Authority and privacy

Target references are syntax, not authorization. The helper performs no page queries, target discovery, permission grants, recording, persistence or network requests. An integrating editor must obtain its target choices from the host-approved catalog and still use the ordinary validate/review/load path. The generated tour requests no capabilities and cannot perform application actions. Reduced motion remains respected by the existing player. Rendering supplied text safely remains the host's responsibility.

## Verification

`node --test packages/core/test/storyboard.test.js` exercises round-trips, stable identities, bounds, malformed/untrusted inputs and refusal of advanced scripts. Package checks install the actual tarballs with installation scripts disabled, run a DOM-free consumer, and compile positive/negative TypeScript cases through the exported subpath. Check current CI before treating the package and browser matrix as passed.
