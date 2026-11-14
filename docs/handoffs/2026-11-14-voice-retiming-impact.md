# Next-agent handoff: Voice replacement retiming review

**Status:** Draft handoff only. No runtime implementation is claimed in this PR; leave it open for the next agent.  
**Recorded:** 14 November 2026. **Baseline:** main at bee5a0c496ec40f5583b4d52fb0c54f1eec0347a (PR #46 merged). There were no open PRs when this branch was created. Refresh remote refs before continuing.

## Why this work exists

DOM Director Studio is a video-style editor with CC, Voice, Cursor and Camera tracks. The voice-take comparison (#38), caption-word timing-link model (#36), its editor controls (#37), caption search/review (#45) and scene duplication (#46) are **already merged**. Do not redo them.

The remaining creator-facing gap selected for the next PR is **explaining the precise impact of “Fit scene to voice” before accepting a replacement**. The current dialog only reports the scene duration change, that later scenes move, and the number of visual clips retimed. It does not identify which captions, word boundaries, or camera/cursor keys move, and by how much. Solve the review experience without replacing the existing timing engine.

## Current code map (verified against the baseline)

- **site/studio.mjs** — voiceInspector and offerTake/replace(fit). The A/B comparison opens silently, lets the creator listen to current/new takes, and stops listening on cancellation. The next dialog shows “Review timing changes” and commits proposal.value with the originating revision. It currently has only a count of affected visual clips.
- **packages/studio/src/editing.js** — proposeVoiceReplacement(project, clipId, asset, {fitScene}) returns {value, changes, deltaMs}. Without fitting it rejects an overlong take. Fitting requires one voice clip beginning at the scene boundary, then uses proposeRetime. The audio is not time-stretched.
- **packages/studio/src/project.js** — proposeRetime, editProject, createProjectStore. Existing transformations proportionally change eligible clip/caption positions, update caption-word timings, validate links/locks, and enforce expected-revision single-step undo.
- **packages/studio/src/timing-links.js** and **timing.js** — persistent links connect camera/cursor keys to authored caption-word start/end boundaries plus millisecond offsets; they are not speech-recognition or media-alignment tools.
- **packages/studio/src/media.js** and **docs/voice-audition.md** — current auditioner has cancellation, stale-result protection and owned-node cleanup. Keep one audio/transport authority.
- Read docs/timing-links.md, docs/studio-word-link-controls.md, docs/studio-media.md, docs/studio-workspace.md, and AGENTS.md before editing.

## Proposed implementation slices (unchecked)

- [ ] **Pure impact descriptor:** derive bounded, deterministic before/after changes from the validated original and proposed projects. Cover scene length, shifted later scenes, caption clip and authored-word boundaries, camera/cursor clips and keyframes (including linked/off-window keys), and the chosen voice source window. Preserve stable IDs. Compare the actual proposed result; **do not create a second retiming algorithm**. Put testable logic in the Studio package with declarations only if deliberately exposed as an API.
- [ ] **Readable review UI:** replace vague counts with an old → new scene duration, delta, number of later scenes shifted, and expandable track-group details for CC / Camera / Cursor / Voice. Show meaningful before/after positions to 0.001 s. Explain links instead of implying automatic speech alignment. Keep lists bounded/paginated without silently hiding changes. Use text nodes, not HTML injection.
- [ ] **Safety:** listening remains opt-in; preview is read-only; Cancel/Escape does not change project, take, playhead or undo. Existing expected-revision commit is the sole acceptance path. Stale reviews, locked tracks, conflicting keys, multiple voice clips or invalid lengths fail atomically; one Undo restores the accepted replacement. Do not add application actions, remote providers, or new permissions.
- [ ] **Focused model coverage:** same-duration, shorter and longer takes; later-scene shift; source trim; caption word/link exact timing and stable IDs; hidden languages; split-source/off-window motion keys; locked and stale proposals; proposal immutability; one-undo and save/reopen. Verify the descriptor agrees exactly with the final committed project.
- [ ] **Creator/browser coverage:** actual comparison and review text, keyboard focus/Escape, mobile and reduced motion, long impact summaries, rejection recovery, and playback after accept. Run Chromium, Firefox, WebKit, existing Studio regressions, TypeScript/packed consumers and a11y/CSP. Review screenshots and incomplete audit findings.
- [ ] **Review/finish:** inspect current main and PR comments, run all checks, fix findings without weakening tests, update docs and evidence, then authorize squash merge and verify the exact public revision. Author-account self-review is not independent approval.

## Recommended tests and release gates

Run the Studio Node tests with: node --test packages/studio/test/*.test.js  
Run package consumers with: python3 tools/check_studio.py  
Use the repository Studio workflow for real-browser and exact staged-artifact acceptance. Do not claim a local browser pass if navigation is blocked. Preserve the existing deployment artifact allowlist and check post-merge public playback.

Baseline evidence only (these are **not** tests of the proposed new UI):
- [Studio checks at the checked main](https://github.com/natanelia/dom-director/actions/runs/43360769618)
- [Exact public playback verification](https://github.com/natanelia/dom-director/actions/runs/43361514144)
- [Package contracts](https://github.com/natanelia/dom-director/actions/runs/43360769755)
- [Pages deployment](https://github.com/natanelia/dom-director/actions/runs/43360769700)

## Non-goals and unresolved gates

No automatic speech alignment, voice generation/voice cloning, provider connection, new microphone request, audio stretching, arbitrary-page capture, registry publication, extra public route, telemetry, cloud storage or business-state rollback. Existing manual physical iOS/Android, VoiceOver/NVDA, device audio, browser zoom and first-time usability acceptance remains in [issue #19](https://github.com/natanelia/dom-director/issues/19).

This is a **handoff checkpoint**, not a release or completed feature. Update the PR body with new head SHA, test evidence, unresolved issues and user-visible changes as actual implementation proceeds.