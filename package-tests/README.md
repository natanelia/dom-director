# Packed-consumer verification

From the repository root run `python3 tools/build_runtime.py`, `python3 tools/build_types.py`, then `python3 tools/check_packages.py` in an environment with npm registry access. This creates temporary tarballs and a clean temporary consumer. It never publishes packages or modifies a user's application.

The checker verifies archive allowlists, required schemas/declarations, byte identity with source, MIT license identity, explicit peer dependencies and the private release gate. It installs both tarballs with lifecycle scripts disabled, imports all entry points, rejects private deep imports, server-renders React, exercises a real protocol request, and typechecks TS/TSX authoring plus negative API cases with TypeScript 5.8.3. Test-only React/type dependencies are pinned in the checker. Runtime browser/React lifecycle matrices remain separate.

Canonical authoring types are generated from the repository schemas. The generator preserves discriminated cue/command unions and readonly data, but numeric bounds, regular expressions, duplicate keys, graph validity and security policy still require runtime validation. The facade declarations describe implemented APIs, not every proposed design feature. `compile` accepts unknown input and returns structured diagnostics; a TypeScript assertion is not validation or authorization.

The package prepack hook checks required build inputs and refuses an unapproved publication state. Both packages remain `private: true` at `0.1.0-rc.0`; no npm availability or production support certification is claimed.
