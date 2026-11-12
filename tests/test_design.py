"""Tests for design artifacts and offline validation, NOT a browser runtime."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

from tools.check_design import (
    ROOT, MAX_BYTES, MAX_DEPTH, DesignValidator, Diagnostic, InputError,
    caption_sidecar, check_limits, check_repository, graph_diagnostics,
    local_link_errors, local_asset_errors, parse_json, pointer, read_json, safe_asset_uri,
)


class DesignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.validator = DesignValidator()

    def example(self, name="minimal.tour.json"):
        return read_json(ROOT / "examples" / name)

    def assert_code(self, value, code):
        actual = self.validator.tour(value)
        self.assertIn(code, {d.code for d in actual}, actual)

    def test_all_positive_tours(self):
        paths = list((ROOT / "examples").glob("*.tour.json"))
        self.assertEqual(len(paths), 6)
        for path in paths:
            with self.subTest(path=path.name):
                self.assertEqual(self.validator.tour(read_json(path)), [])

    def test_all_positive_commands(self):
        for path in (ROOT / "examples").glob("*.command.json"):
            with self.subTest(path=path.name):
                self.assertEqual(self.validator.command(read_json(path)), [])

    def test_positive_diagnostic(self):
        self.assertEqual(self.validator.structure("diagnostic", self.example("blocked-seek.diagnostic.json")), [])

    def test_unknown_version(self):
        t = self.example(); t["schemaVersion"] = "999"
        self.assert_code(t, "SCHEMA_INVALID")

    def test_unknown_cue(self):
        t = self.example(); t["scenes"][0]["cues"][0]["kind"] = "executeJavaScript"
        self.assert_code(t, "SCHEMA_INVALID")

    def test_unknown_top_level_field(self):
        t = self.example(); t["bypassPolicy"] = True
        self.assert_code(t, "SCHEMA_INVALID")

    def test_unknown_cue_field(self):
        t = self.example(); t["scenes"][0]["cues"][0]["onclick"] = "arbitrary()"
        self.assert_code(t, "SCHEMA_INVALID")

    def test_missing_required_title(self):
        t = self.example(); del t["title"]
        self.assert_code(t, "SCHEMA_INVALID")

    def test_no_raw_selector_in_target_contract(self):
        t = self.example(); t["targets"]["overview"]["selector"] = "#admin"
        self.assert_code(t, "SCHEMA_INVALID")

    def test_empty_scenes(self):
        t = self.example(); t["scenes"] = []
        self.assert_code(t, "SCHEMA_INVALID")

    def test_duplicate_scene(self):
        t = self.example(); t["scenes"].append(deepcopy(t["scenes"][0]))
        self.assert_code(t, "DUPLICATE_SCENE")

    def test_duplicate_cue_across_scenes(self):
        t = self.example(); t["scenes"][1]["cues"][0]["id"] = t["scenes"][0]["cues"][0]["id"]
        self.assert_code(t, "DUPLICATE_CUE")

    def test_missing_entry(self):
        t = self.example(); t["entryScene"] = "nonexistent"
        self.assert_code(t, "ENTRY_REFERENCE")

    def test_missing_destination(self):
        t = self.example(); t["scenes"][0]["next"] = "nonexistent"
        self.assert_code(t, "SCENE_REFERENCE")

    def test_cycle(self):
        t = self.example(); t["scenes"][-1]["next"] = t["entryScene"]
        self.assert_code(t, "GRAPH_CYCLE")

    def test_unreachable_scene(self):
        t = self.example(); del t["scenes"][0]["next"]
        self.assert_code(t, "UNREACHABLE_SCENE")

    def test_branch_cannot_also_have_next(self):
        t = self.example("branching.tour.json"); t["scenes"][0]["next"] = t["scenes"][1]["id"]
        self.assert_code(t, "SCHEMA_INVALID")

    def test_duplicate_choice(self):
        t = self.example("branching.tour.json")
        t["scenes"][0]["choices"][1]["id"] = t["scenes"][0]["choices"][0]["id"]
        self.assert_code(t, "DUPLICATE_CHOICE")

    def test_missing_target(self):
        t = self.example(); t["scenes"][0]["cues"][0]["target"] = "nonexistent"
        self.assert_code(t, "TARGET_REFERENCE")

    def test_camera_needs_target_or_reset(self):
        t = self.example(); del t["scenes"][0]["cues"][0]["target"]
        self.assert_code(t, "SCHEMA_INVALID")

    def test_camera_cannot_target_and_reset(self):
        t = self.example(); t["scenes"][0]["cues"][0]["reset"] = True
        self.assert_code(t, "SCHEMA_INVALID")

    def test_camera_scale_range(self):
        t = self.example(); t["scenes"][0]["cues"][0]["minScale"] = 4
        self.assert_code(t, "SCALE_RANGE")

    def test_camera_overlap(self):
        t = self.example(); c = deepcopy(t["scenes"][0]["cues"][0]); c.update(id="competing-camera", at=100)
        t["scenes"][0]["cues"].append(c)
        self.assert_code(t, "TRACK_CONFLICT")

    def test_same_time_zero_duration_camera_conflicts(self):
        t = self.example(); c = deepcopy(t["scenes"][0]["cues"][0]); c.update(id="competing-camera", durationMs=0)
        t["scenes"][0]["cues"][0]["durationMs"] = 0
        t["scenes"][0]["cues"].append(c)
        self.assert_code(t, "TRACK_CONFLICT")

    def test_adjacent_camera_intervals_allowed(self):
        t = self.example(); c = deepcopy(t["scenes"][0]["cues"][0]); c.update(id="adjacent-camera", at=700)
        t["scenes"][0]["cues"].append(c)
        self.assertEqual(self.validator.tour(t), [])

    def test_cursor_overlap(self):
        t = self.example("narrated-settings.tour.json")
        c = deepcopy(next(c for c in t["scenes"][0]["cues"] if c["kind"] == "cursor")); c["id"] = "competing-cursor"
        t["scenes"][0]["cues"].append(c)
        self.assert_code(t, "TRACK_CONFLICT")

    def test_drag_requires_source(self):
        t = self.example("narrated-settings.tour.json")
        next(c for c in t["scenes"][0]["cues"] if c["kind"] == "cursor")["gesture"] = "drag"
        self.assert_code(t, "CURSOR_SOURCE")

    def test_point_cannot_have_source(self):
        t = self.example("narrated-settings.tour.json")
        next(c for c in t["scenes"][0]["cues"] if c["kind"] == "cursor")["fromTarget"] = "panel"
        self.assert_code(t, "CURSOR_SOURCE")

    def test_valid_visual_drag(self):
        t = self.example("narrated-settings.tour.json")
        next(c for c in t["scenes"][0]["cues"] if c["kind"] == "cursor").update(gesture="drag", fromTarget="panel")
        self.assertEqual(self.validator.tour(t), [])

    def test_cue_out_of_bounds(self):
        t = self.example(); t["scenes"][0]["cues"][0]["at"] = 3000
        self.assert_code(t, "CUE_RANGE")

    def test_missing_narration_anchor(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["cues"][1]["at"]["narrationCue"] = "nonexistent"
        self.assert_code(t, "NARRATION_REFERENCE")

    def test_negative_resolved_anchor(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["cues"][1]["at"]["offsetMs"] = -3000
        self.assert_code(t, "CUE_RANGE")

    def test_duplicate_narration_cue(self):
        t = self.example("narrated-settings.tour.json"); cues = t["scenes"][0]["narration"]["cues"]; cues[1]["id"] = cues[0]["id"]
        self.assert_code(t, "DUPLICATE_NARRATION_CUE")

    def test_narration_unsorted(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["narration"]["cues"].reverse()
        self.assert_code(t, "NARRATION_ORDER")

    def test_narration_empty_interval(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["narration"]["cues"][0]["endMs"] = 0
        self.assert_code(t, "NARRATION_RANGE")

    def test_narration_exceeds_scene(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["narration"]["cues"][-1]["endMs"] = 9000
        self.assert_code(t, "NARRATION_RANGE")

    def test_missing_audio_asset(self):
        t = self.example("narrated-settings.tour.json"); t["scenes"][0]["narration"]["audioAsset"] = "missing"
        self.assert_code(t, "AUDIO_REFERENCE")

    def test_wrong_audio_asset_type(self):
        t = self.example("narrated-settings.tour.json"); t["assets"] = {"voice": {"kind": "image", "uri": "./voice.png"}}; t["scenes"][0]["narration"]["audioAsset"] = "voice"
        self.assert_code(t, "AUDIO_REFERENCE")

    def test_unsafe_asset_uri(self):
        t = self.example(); t["assets"] = {"voice": {"kind": "audio", "uri": "javascript:alert(1)"}}
        self.assert_code(t, "ASSET_URI")

    def test_valid_asset_declaration_is_not_downloaded(self):
        t = self.example(); t["assets"] = {"voice": {"kind": "audio", "uri": "https://example.invalid/voice.mp3"}}
        self.assertEqual(self.validator.tour(t), [])

    def test_missing_action_capability(self):
        t = self.example("safe-fixture.tour.json"); t["capabilities"].remove("action:fixture.setPreview")
        self.assert_code(t, "CAPABILITY_UNDECLARED")

    def test_missing_condition_capability(self):
        t = self.example("guided-task.tour.json"); t["capabilities"] = []
        self.assert_code(t, "CAPABILITY_UNDECLARED")

    def test_action_args_are_json_not_arbitrary_code(self):
        t = self.example("safe-fixture.tour.json")
        action = next(c for c in t["scenes"][0]["cues"] if c["kind"] == "action")
        action["args"] = {"nested": {"value": [True, None, 3]}}
        self.assertEqual(self.validator.tour(t), [])
        action["args"] = "execute()"
        self.assert_code(t, "SCHEMA_INVALID")

    def test_gate_cannot_skip_unresolved_choice(self):
        t = self.example("branching.tour.json"); t["capabilities"].append("condition:ready")
        t["scenes"][0]["cues"].append({"id":"ambiguous-gate", "kind":"gate", "at":0, "conditionRef":"ready", "timeoutMs":500, "onTimeout":"skip-scene", "instruction":"Wait"})
        self.assert_code(t, "AMBIGUOUS_SKIP")

    def test_command_embedded_script_semantics(self):
        c = self.example("preview.command.json"); c["params"]["script"]["entryScene"] = "nonexistent"
        self.assertIn("ENTRY_REFERENCE", {d.code for d in self.validator.command(c)})

    def test_seek_requires_revision(self):
        c = self.example("seek.command.json"); del c["expectedRevision"]
        self.assertTrue(self.validator.command(c))

    def test_pause_and_stop_do_not_require_revision(self):
        for cmd in ("pause", "stop"):
            c = self.example("seek.command.json"); c.update(command=cmd, params={}); del c["expectedRevision"]
            with self.subTest(command=cmd):
                self.assertEqual(self.validator.command(c), [])

    def test_unknown_agent_command_fails_closed(self):
        c = self.example("seek.command.json"); c["command"] = "approveEverything"
        self.assertTrue(self.validator.command(c))

    def test_preview_cannot_request_real_execution(self):
        c = self.example("preview.command.json"); c["params"]["mode"] = "execute"
        self.assertTrue(self.validator.command(c))

    def test_agent_cannot_self_grant_permissions(self):
        c = self.example("seek.command.json"); c["permissions"] = ["*"]
        self.assertTrue(self.validator.command(c))

    def test_diagnostic_unknown_fields(self):
        c = self.example("blocked-seek.diagnostic.json"); c["rawDOM"] = "private text"
        self.assertTrue(self.validator.structure("diagnostic", c))

    def test_errors_redact_values(self):
        t = self.example(); t["title"] = {"private": "DO-NOT-LEAK-THIS"}
        diagnostics = self.validator.tour(t)
        self.assertTrue(diagnostics)
        self.assertNotIn("DO-NOT-LEAK-THIS", json.dumps([d.to_dict() for d in diagnostics]))

    def test_emitted_diagnostics_follow_schema(self):
        t = self.example(); t["entryScene"] = "missing"; t["scenes"][0]["cues"][0]["target"] = "missing"
        for diagnostic in self.validator.tour(t):
            self.assertEqual(self.validator.structure("diagnostic", diagnostic.to_dict()), [])

    def test_caption_sidecar_matches_canonical_cues(self):
        t = self.example("narrated-settings.tour.json")
        self.assertEqual(caption_sidecar(t), (ROOT / "examples/media/settings.en.vtt").read_text())

    def test_repository_consistency(self):
        result = check_repository()
        self.assertTrue(result["ok"], result["errors"])
        self.assertEqual(result["counts"]["requirements"], 112)
        self.assertEqual(result["counts"]["backlogItems"], 19)


class InputAndGraphTests(unittest.TestCase):
    def test_valid_json(self):
        self.assertEqual(parse_json('{"a": [1, true, null]}'), {"a": [1, True, None]})

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(InputError): parse_json('{"a": 1, "a": 2}')

    def test_malformed_json_rejected(self):
        with self.assertRaises(InputError): parse_json('{"a":')

    def test_nonfinite_json_rejected(self):
        for value in ("NaN", "Infinity", "-Infinity", "1e9999"):
            with self.subTest(value=value), self.assertRaises(InputError): parse_json(value)

    def test_reserved_keys_rejected_at_any_depth(self):
        for key in ("__proto__", "constructor", "prototype"):
            with self.subTest(key=key), self.assertRaises(InputError): parse_json(json.dumps({"nested": {key: "x"}}))

    def test_depth_limit(self):
        data = 1
        for _ in range(MAX_DEPTH + 1): data = [data]
        with self.assertRaises(InputError): check_limits(data)

    def test_size_limit(self):
        with self.assertRaises(InputError): parse_json('"' + 'x' * MAX_BYTES + '"')

    def test_invalid_utf8_text(self):
        with self.assertRaises(InputError): parse_json('"\ud800"')

    def test_json_pointer_escaping(self):
        self.assertEqual(pointer(["a/b", "~key", 2]), "/a~1b/~0key/2")

    def test_asset_allowed_forms(self):
        for uri in ("./voice.mp3", "./media/voice.en.mp3", "https://example.com/media.mp3"):
            with self.subTest(uri=uri): self.assertTrue(safe_asset_uri(uri))

    def test_asset_disallowed_forms(self):
        for uri in ("javascript:x", "data:audio/mp3,x", "file:///x", "http://example.com/x", "//example.com/x", "./../private", "./%2e%2e/private", "./media\\private", "https://user:secret@example.com/x", "./file?token=x", "./file#x", "./", "\nhttps://example.com/x"):
            with self.subTest(uri=uri): self.assertFalse(safe_asset_uri(uri))

    def test_long_acyclic_graph_iterative(self):
        graph = {str(i): [str(i+1)] for i in range(999)}; graph["999"] = []
        self.assertEqual(graph_diagnostics(graph, "0"), [])

    def test_shared_branch_join_allowed(self):
        self.assertEqual(graph_diagnostics({"start":["a", "b"], "a":["end"], "b":["end"], "end":[]}, "start"), [])

    def test_backlog_graph_cycle_rejected(self):
        self.assertIn("GRAPH_CYCLE", {d.code for d in graph_diagnostics({"a":["b"], "b":["a"]})})

    def test_broken_local_link_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "llms.txt").write_text(""); (root / "README.md").write_text("[broken](absent.md)")
            count, errors = local_link_errors(root)
            self.assertEqual(count, 1); self.assertEqual(len(errors), 1)

    def test_missing_fixture_asset_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tour = {"assets": {"voice": {"uri": "./missing.mp3"}}}
            self.assertEqual(local_asset_errors(tour, Path(tmp))[0].code, "ASSET_MISSING")

    def test_existing_fixture_asset_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "fixture.txt").write_text("synthetic fixture")
            tour = {"assets": {"fixture": {"uri": "./fixture.txt"}}}
            self.assertEqual(local_asset_errors(tour, root), [])

    def test_remote_asset_check_never_fetches(self):
        self.assertEqual(local_asset_errors({"assets": {"voice": {"uri": "https://example.invalid/x"}}}, ROOT), [])

    def test_external_links_and_code_are_not_local_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "llms.txt").write_text(""); (root / "README.md").write_text("[external](https://example.com)\n```md\n[example](missing.md)\n```\n")
            self.assertEqual(local_link_errors(root), (0, []))


if __name__ == "__main__":
    unittest.main()
