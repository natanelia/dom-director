# Contributing

Begin with the [design index](docs/README.md) and [agent working agreement](AGENTS.md). This repository is currently a proposal with executable design checks; it has no runtime package to install.

Use a dedicated branch and connect changes to requirement/backlog IDs. For a design-only change, update examples and validation whenever the contract changes. For implementation, start with a bounded vertical slice and include actual evidence for the browser behavior it claims. A proposed API in a Markdown code block is not an implementation.

Run the Python design checks and unit tests documented in the README. Node/npm scripts are optional convenience aliases; Python and the pinned development validator are still required. Do not add runtime dependencies to the design-tool package or remove `private: true` to publish accidentally.

A pull request should explain the user problem, the scope, the alternatives, the risks, the tests run, and any unverified assumptions. Changes to camera ownership, timing, effects, permissions, script compatibility, or accessibility require an ADR update or a new superseding ADR.

Use synthetic data in examples and test artifacts. Do not include proprietary application code, customer data, account information, private maps, credentials, or unlicensed media. Optional analytics and network features require explicit design review and an off-by-default policy.

## Definition of done for a future runtime feature

Implementation plus documentation, relevant requirement status/evidence, positive and negative tests, cancellation/cleanup behavior, accessibility and security impact, and measured browser evidence where applicable. If only design tooling passes, report only design tooling as verified.
