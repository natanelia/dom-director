#!/usr/bin/env python3
"""Offline checks for the DOM Director design artifacts, not a browser runtime.

Only repository-owned schemas are registered. No remote schema or asset is fetched.
Expected invalid data produces bounded, value-redacted diagnostics.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
from dataclasses import asdict, dataclass
from itertools import islice
import json
import math
from pathlib import Path, PurePosixPath
import re
import sys
from typing import Any
from urllib.parse import unquote, urlsplit

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0-draft.1"
MAX_BYTES = 1024 * 1024
MAX_DEPTH = 40
MAX_CUES = 10_000
RESERVED_KEYS = {"__proto__", "constructor", "prototype"}


@dataclass(frozen=True)
class Diagnostic:
    code: str
    path: str
    message: str
    phase: str = "compile"
    severity: str = "error"
    recoveries: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["recoveries"] = list(self.recoveries)
        return result


class InputError(ValueError):
    """Invalid JSON or an input resource limit; message never includes raw values."""


def pointer(parts: Any) -> str:
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def check_limits(value: Any) -> None:
    stack = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if depth > MAX_DEPTH:
            raise InputError("Maximum JSON nesting depth exceeded.")
        if isinstance(item, dict):
            if any(k in RESERVED_KEYS for k in item):
                raise InputError("A reserved object key is not allowed.")
            stack.extend((v, depth + 1) for v in item.values())
        elif isinstance(item, list):
            stack.extend((v, depth + 1) for v in item)
        elif isinstance(item, float) and not math.isfinite(item):
            raise InputError("Non-finite JSON numbers are not allowed.")


def parse_json(text: str) -> Any:
    try:
        if len(text.encode("utf-8")) > MAX_BYTES:
            raise InputError("Maximum JSON document size exceeded.")
    except UnicodeEncodeError as exc:
        raise InputError("Input is not valid UTF-8 text.") from exc

    def object_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise InputError("Duplicate JSON object key.")
            result[key] = value
        return result

    def reject_constant(_: str) -> None:
        raise InputError("Non-finite JSON numbers are not allowed.")

    try:
        result = json.loads(text, object_pairs_hook=object_pairs, parse_constant=reject_constant)
    except (json.JSONDecodeError, RecursionError) as exc:
        raise InputError("Malformed JSON or excessive nesting.") from exc
    check_limits(result)
    return result


def read_json(path: Path) -> Any:
    if path.stat().st_size > MAX_BYTES:
        raise InputError("Maximum JSON document size exceeded.")
    return parse_json(path.read_text(encoding="utf-8"))


def safe_asset_uri(uri: str) -> bool:
    if any(ord(c) < 32 for c in uri) or "\\" in uri:
        return False
    try:
        parsed = urlsplit(uri)
    except ValueError:
        return False
    if parsed.scheme:
        return (parsed.scheme == "https" and bool(parsed.hostname)
                and parsed.username is None and parsed.password is None)
    if not uri.startswith("./") or parsed.netloc or parsed.query or parsed.fragment:
        return False
    # Reject percent encoding in local archive paths to avoid ambiguous decoding.
    if "%" in uri:
        return False
    return ".." not in PurePosixPath(uri).parts and len(PurePosixPath(uri).parts) > 0


def local_asset_errors(tour: dict[str, Any], directory: Path) -> list[Diagnostic]:
    """Repository fixture check only; never fetch remote resources."""
    errors = []
    for aid, asset in tour.get("assets", {}).items():
        uri = asset["uri"]
        if uri.startswith("./") and safe_asset_uri(uri):
            path = (directory / uri).resolve()
            if not path.is_relative_to(directory.resolve()) or not path.is_file():
                errors.append(Diagnostic("ASSET_MISSING", pointer(["assets", aid, "uri"]),
                                         "Local asset is missing or outside the example package."))
    return errors


def graph_diagnostics(graph: dict[str, list[str]], entry: str | None = None) -> list[Diagnostic]:
    errors: list[Diagnostic] = []
    for key, destinations in graph.items():
        for target in destinations:
            if target not in graph:
                errors.append(Diagnostic("SCENE_REFERENCE", "", "A graph destination is not defined."))
    if errors:
        return errors
    indegree = {key: 0 for key in graph}
    for destinations in graph.values():
        for target in destinations:
            indegree[target] += 1
    queue = deque(k for k, count in indegree.items() if count == 0)
    count = 0
    while queue:
        key = queue.popleft()
        count += 1
        for target in graph[key]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    if count != len(graph):
        errors.append(Diagnostic("GRAPH_CYCLE", "", "The graph contains a cycle."))
    if entry is not None:
        if entry not in graph:
            errors.append(Diagnostic("ENTRY_REFERENCE", "/entryScene", "Entry scene is not defined."))
        else:
            seen: set[str] = set()
            pending = [entry]
            while pending:
                key = pending.pop()
                if key not in seen:
                    seen.add(key)
                    pending.extend(graph[key])
            if seen != set(graph):
                errors.append(Diagnostic("UNREACHABLE_SCENE", "/scenes", "Some scenes are unreachable from entry."))
    return errors


class DesignValidator:
    def __init__(self, root: Path = ROOT) -> None:
        self.root = root
        self.schemas: dict[str, dict[str, Any]] = {}
        registry = Registry()
        for name in ("tour", "agent-command", "diagnostic"):
            schema = read_json(root / "schemas" / f"{name}.schema.json")
            Draft202012Validator.check_schema(schema)
            self.schemas[name] = schema
            registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
        self.validators = {
            name: Draft202012Validator(schema, registry=registry)
            for name, schema in self.schemas.items()
        }

    def structure(self, name: str, value: Any) -> list[Diagnostic]:
        try:
            check_limits(value)
        except InputError as exc:
            return [Diagnostic("INPUT_LIMIT", "", str(exc), phase="parse")]
        # Bounded and value-redacted: do not print an entire bad instance/secret.
        return [Diagnostic("SCHEMA_INVALID", pointer(e.absolute_path),
                           f"Schema constraint '{e.validator}' failed.")
                for e in islice(self.validators[name].iter_errors(value), 100)]

    def tour(self, value: Any) -> list[Diagnostic]:
        errors = self.structure("tour", value)
        if errors:
            return errors
        scenes = value["scenes"]
        targets = value["targets"]
        assets = value.get("assets", {})
        capabilities = set(value["capabilities"])
        if sum(len(s["cues"]) for s in scenes) > MAX_CUES:
            return [Diagnostic("CUE_LIMIT", "/scenes", "Aggregate cue limit exceeded.")]
        for aid, asset in assets.items():
            if not safe_asset_uri(asset["uri"]):
                errors.append(Diagnostic("ASSET_URI", f"/assets/{aid}/uri", "Asset URI is outside the draft policy."))
        scene_ids = [s["id"] for s in scenes]
        if len(set(scene_ids)) != len(scene_ids):
            errors.append(Diagnostic("DUPLICATE_SCENE", "/scenes", "Scene IDs must be unique."))
        cue_ids: set[str] = set()
        graph: dict[str, list[str]] = {}
        for si, scene in enumerate(scenes):
            base = f"/scenes/{si}"
            destinations = ([scene["next"]] if "next" in scene else
                            [c["next"] for c in scene.get("choices", [])])
            graph[scene["id"]] = destinations
            choices = [c["id"] for c in scene.get("choices", [])]
            if len(choices) != len(set(choices)):
                errors.append(Diagnostic("DUPLICATE_CHOICE", base + "/choices", "Choice IDs must be unique within a scene."))
            narration = scene.get("narration", {})
            narration_cues: dict[str, Any] = {}
            previous_start = -1
            for ni, cue in enumerate(narration.get("cues", [])):
                path = f"{base}/narration/cues/{ni}"
                if cue["id"] in narration_cues:
                    errors.append(Diagnostic("DUPLICATE_NARRATION_CUE", path, "Narration cue IDs must be unique within a scene."))
                narration_cues[cue["id"]] = cue
                if not (cue["startMs"] < cue["endMs"] <= scene["durationMs"]):
                    errors.append(Diagnostic("NARRATION_RANGE", path, "Narration interval must be positive and inside the scene."))
                if cue["startMs"] < previous_start:
                    errors.append(Diagnostic("NARRATION_ORDER", path, "Narration starts must be sorted."))
                previous_start = cue["startMs"]
            if "audioAsset" in narration:
                asset = assets.get(narration["audioAsset"])
                if asset is None or asset["kind"] != "audio":
                    errors.append(Diagnostic("AUDIO_REFERENCE", base + "/narration/audioAsset", "Narration needs a declared audio asset."))
            intervals: dict[str, list[tuple[int, int, str]]] = {"camera": [], "cursor": []}
            for ci, cue in enumerate(scene["cues"]):
                path = f"{base}/cues/{ci}"
                if cue["id"] in cue_ids:
                    errors.append(Diagnostic("DUPLICATE_CUE", path, "Cue IDs must be globally unique."))
                cue_ids.add(cue["id"])
                for key in ("target", "fromTarget"):
                    if key in cue and cue[key] not in targets:
                        errors.append(Diagnostic("TARGET_REFERENCE", path + "/" + key, "Target alias is not declared."))
                if cue["kind"] == "cursor":
                    if (cue["gesture"] == "drag") != ("fromTarget" in cue):
                        errors.append(Diagnostic("CURSOR_SOURCE", path, "Only drag gestures require a fromTarget."))
                at = cue["at"]
                if isinstance(at, dict):
                    anchor = narration_cues.get(at["narrationCue"])
                    if anchor is None:
                        errors.append(Diagnostic("NARRATION_REFERENCE", path + "/at", "Narration timing anchor is not defined."))
                        continue
                    start = anchor["startMs" if at["edge"] == "start" else "endMs"] + at.get("offsetMs", 0)
                else:
                    start = at
                end = start + cue.get("durationMs", 0)
                if start < 0 or end > scene["durationMs"]:
                    errors.append(Diagnostic("CUE_RANGE", path, "Resolved cue interval is outside the scene."))
                if cue["kind"] in intervals:
                    intervals[cue["kind"]].append((start, end, path))
                if cue["kind"] == "camera":
                    lo = cue.get("minScale", 0.5)
                    hi = cue.get("maxScale", value.get("defaults", {}).get("maxScale", 3))
                    if lo > hi:
                        errors.append(Diagnostic("SCALE_RANGE", path, "Minimum camera scale exceeds maximum scale."))
                for kind, field in (("action", "actionRef"), ("gate", "conditionRef")):
                    if cue["kind"] == kind:
                        prefix = "action" if kind == "action" else "condition"
                        if f"{prefix}:{cue[field]}" not in capabilities:
                            errors.append(Diagnostic("CAPABILITY_UNDECLARED", path, "A requested operation is not declared in capabilities."))
                if cue["kind"] == "gate" and cue.get("onTimeout") == "skip-scene" and "choices" in scene:
                    errors.append(Diagnostic("AMBIGUOUS_SKIP", path, "A timeout cannot choose an unresolved branch."))
            for kind, items in intervals.items():
                ordered = sorted(items)
                for previous, current in zip(ordered, ordered[1:]):
                    if current[0] < previous[1] or current[0] == previous[0]:
                        errors.append(Diagnostic("TRACK_CONFLICT", current[2], f"Two {kind} cues compete for the same track."))
        errors.extend(graph_diagnostics(graph, value["entryScene"]))
        return errors

    def command(self, value: Any) -> list[Diagnostic]:
        errors = self.structure("agent-command", value)
        if not errors and "script" in value["params"]:
            errors.extend(self.tour(value["params"]["script"]))
        return errors


def caption_sidecar(tour: dict[str, Any]) -> str:
    def stamp(ms: int) -> str:
        seconds, fraction = divmod(ms, 1000)
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        return f"{hours:02}:{minutes:02}:{seconds:02}.{fraction:03}"
    text = "WEBVTT\n\n"
    for cue in tour["scenes"][0]["narration"]["cues"]:
        text += f"{cue['id']}\n{stamp(cue['startMs'])} --> {stamp(cue['endMs'])}\n{cue['text']}\n\n"
    return text


def local_link_errors(root: Path) -> tuple[int, list[str]]:
    count = 0
    errors = []
    files = list(root.rglob("*.md")) + [root / "llms.txt"]
    pattern = re.compile(r"\[[^\]\n]+\]\(([^)\n]+)\)")
    for file in files:
        if ".git" in file.parts or ".venv" in file.parts:
            continue
        # Fenced code is illustrative, not Markdown navigation.
        text = re.sub(r"```.*?```", "", file.read_text(), flags=re.S)
        for match in pattern.finditer(text):
            link = match.group(1).strip().split(' "', 1)[0]
            if link.startswith(("http:", "https:", "mailto:", "#")):
                continue
            path_part = unquote(link.split("#", 1)[0])
            target = (file.parent / path_part).resolve()
            count += 1
            if not target.is_relative_to(root.resolve()) or not target.exists():
                errors.append(f"{file.relative_to(root)}: broken/out-of-root local link: {path_part}")
    return count, errors


def traceability_errors(root: Path) -> tuple[dict[str, int], list[str]]:
    requirements = read_json(root / "docs/requirements.json")["requirements"]
    backlog = read_json(root / "docs/backlog.json")["items"]
    errors = []
    reqs = {r["id"]: r for r in requirements}
    items = {b["id"]: b for b in backlog}
    if len(reqs) != len(requirements):
        errors.append("Duplicate requirement IDs.")
    if len(items) != len(backlog):
        errors.append("Duplicate backlog IDs.")
    coverage = Counter(rid for b in backlog for rid in b["requirementIds"])
    for rid, req in reqs.items():
        if coverage[rid] != 1:
            errors.append(f"{rid}: expected exactly one primary backlog mapping.")
        if req["backlogId"] not in items or rid not in items[req["backlogId"]]["requirementIds"]:
            errors.append(f"{rid}: inconsistent backlog mapping.")
        if not (root / req["designDoc"]).is_file():
            errors.append(f"{rid}: missing design document.")
        if not req["acceptance"] or not req["plannedTests"]:
            errors.append(f"{rid}: missing acceptance or planned test ID.")
        if req["status"] in ("implemented", "verified") and not req["evidence"]:
            errors.append(f"{rid}: implementation/verification claim lacks evidence.")
    for rid in coverage:
        if rid not in reqs:
            errors.append("Backlog references unknown requirement.")
    graph = {bid: b["dependsOn"] for bid, b in items.items()}
    errors.extend("Backlog: " + e.message for e in graph_diagnostics(graph))
    doc = (root / "docs/03-requirements.md").read_text()
    for rid in reqs:
        if f"| {rid} |" not in doc:
            errors.append(f"{rid}: missing human-readable requirement row.")
    return {"requirements": len(requirements), "backlogItems": len(backlog)}, errors


def check_repository(root: Path = ROOT) -> dict[str, Any]:
    validator = DesignValidator(root)
    errors: list[dict[str, Any]] = []
    counts = {"schemas": 3, "tours": 0, "commands": 0, "diagnostics": 0}
    for path in sorted((root / "examples").glob("*.json")):
        value = read_json(path)
        if path.name.endswith(".tour.json"):
            result = validator.tour(value)
            if not result:
                result.extend(local_asset_errors(value, path.parent))
            counts["tours"] += 1
        elif path.name.endswith(".command.json"):
            result = validator.command(value)
            counts["commands"] += 1
        elif path.name.endswith(".diagnostic.json"):
            result = validator.structure("diagnostic", value)
            counts["diagnostics"] += 1
        else:
            raise InputError("Unknown example JSON artifact type.")
        errors.extend({"file": str(path.relative_to(root)), **d.to_dict()} for d in result)
    narrated = read_json(root / "examples/narrated-settings.tour.json")
    if caption_sidecar(narrated) != (root / "examples/media/settings.en.vtt").read_text():
        errors.append({"file": "examples/media/settings.en.vtt", "code": "CAPTION_DRIFT", "message": "Sidecar differs from canonical cues."})
    link_count, links = local_link_errors(root)
    counts["localLinks"] = link_count
    errors.extend({"code": "BROKEN_LINK", "message": e} for e in links)
    trace_counts, trace_errors = traceability_errors(root)
    counts.update(trace_counts)
    errors.extend({"code": "TRACEABILITY", "message": e} for e in trace_errors)
    package = read_json(root / "package.json")
    if package.get("private") is not True:
        errors.append({"code": "PUBLISH_GUARD", "message": "Design scaffold must remain private to npm."})
    # All reported diagnostics must conform to the diagnostic schema.
    for diag in errors:
        if "phase" in diag:
            payload = {k: v for k, v in diag.items() if k != "file"}
            if validator.structure("diagnostic", payload):
                raise RuntimeError("The validator emitted a malformed diagnostic.")
    return {"ok": not errors, "scope": "design artifacts only; no runtime/browser verification", "counts": counts, "errors": errors}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit machine-readable check results.")
    args = parser.parse_args()
    try:
        result = check_repository()
    except (InputError, OSError, KeyError, ValueError) as exc:
        print(f"Design validation could not complete: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("PASS" if result["ok"] else "FAIL", "— design artifacts only")
        for key, value in result["counts"].items():
            print(f"  {key}: {value}")
        for error in result["errors"]:
            print("  ERROR:", json.dumps(error, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
