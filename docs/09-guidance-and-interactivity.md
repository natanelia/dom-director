# 09 · Guidance, practice, user interaction, and takeover

## Interaction contract

A walkthrough is a guest in the host app. It can explain, request an approved reveal, wait for a condition, or invoke an explicitly granted host action. It does not own the user's workflow. Stop and Escape remain available even when a script says a step is required.

The default input policy is `pause-on-user-input` for cinematic watch mode and `allow` for guide mode. A production page is not made safe by an overlay: keyboard shortcuts, background work, and existing event handlers may still act. Truly safe demonstrations use a fixture with isolated data and no production credentials.

## Watch mode

Camera, captions, cursor, and annotations run on presentation time. Optional fixture actions are distinct barriers. Decorative gestures are visibly simulated. Users can pause, inspect, read a transcript, skip an explanation, or switch to guide mode when supported. Never hide an effect failure behind a convincing cursor animation.

Read-only live demonstrations can focus real data without acting. Sensitive labels/values are shown only to the local authorized viewer; recording/export requires a separate privacy gate. A host may disable both recording and agent discovery while allowing local playback.

## Try mode

Requires `fixture.reset` or an equivalent explicit host adapter and a declared isolated context. Capture a checkpoint, demonstrate or explain the objective, let the learner act, evaluate the outcome, and offer targeted hints. Reset only the fixture, never the user's unrelated production state.

An objective consists of an instructional description, named success condition, optional evidence descriptor, and permitted hints. Do not score completion from a click alone when the real objective is “the change was saved.” A save button click may fail validation or network transport.

## Guide mode

Prefer stable target highlighting and concise instructions over aggressive zoom. A gate can wait for `panel.open`, `selection.valid`, or `draft.saved`; the host declares how these conditions are observed. Observe meaningful state after the user acts. Explain prerequisites when an expected control is disabled instead of trying to click through it.

Conditions have levels of evidence: user acknowledgment, UI state, local domain state, and server-confirmed result. The host supplies the actual level; completion UI should not imply stronger evidence. “I understand” is not proof of task completion.

## Guide progression

1. Resolve and preflight the target and required context.
2. Reveal it through an authorized adapter when necessary.
3. Present the instruction and accessible alternative.
4. Subscribe to the expected outcome, then check its current state.
5. Let the user act, pause, request a hint, skip, or exit.
6. On outcome, show feedback and advance according to user pacing.

A condition already true can satisfy a level-triggered gate, but an edge-triggered task requires a new event/revision after entry. This avoids incorrectly completing “save your edit” because the app was saved before the tutorial started.

## Hints and branches

Hints are ordered, authored information: restate the goal → point to a target → demonstrate in a fixture. Do not automatically invoke a real action as the final hint. Choice branches are explicit and accessible, with stable IDs. A skipped required step can mark the learning path incomplete while still allowing exit; “required” must never disable the escape route.

P0 uses an acyclic graph. Adaptive agents may propose a revised branch, but it must validate and receive the same policy checks before replacing the loaded plan. An in-flight action cannot be retargeted by a patch.

## Focus and input

Camera movement is not focus movement. Do not call focus on every shot. In watch mode focus normally stays in player controls. In guide mode offer an explicit “Go to control” action that focuses a meaningful host element. An interactive step must not set the entire host app inert. Blocking surfaces are for intentionally modal dialogs, with a tested focus strategy and escape behavior.

Do not globally capture common keys while a user is typing. Scope player shortcuts to the player or explicit focus state. Screen readers, IME composition, browser search, text selection, and assistive shortcuts must remain usable.

## Takeover and return

When the user touches or edits the scene, pause automated motion by default. The host can offer “Continue explanation,” “Restart fixture,” or “End guide.” Continuing revalidates targets and conditions against the current state; it does not restore an old snapshot over the user's work.

A native domain gesture, such as panning a map, suspends the director's camera lease for that domain. Resuming requires a predictable handoff, not a camera fight. Manual changes made while paused are part of current host state, not glitches to erase.

## Recovery UX

Missing target: “This control is not available in the current view,” with safe navigation or text alternatives. Timeout: explain the expected condition, offer more time or exit. Permission denied: show what the walkthrough wanted to do without pressuring the user. Version mismatch: show the supported app version and a read-only explanation. Unknown action outcome: ask the host to reconcile; never say “nothing happened” without evidence.

## Mode changes

`setMode` is a prepare/commit operation. Pause, inspect new capability needs, show any new permissions, establish the appropriate fixture or user-driven gate mapping, then commit. An unsupported mode switch returns a typed diagnostic and leaves the original mode paused. The visual script remains reusable, but action behavior may require an authored variant rather than automatic conversion.
