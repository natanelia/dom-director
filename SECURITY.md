# Security policy

The runtime is not implemented and there are no supported released runtime versions. Treat scripts, agent output, imported text, and media metadata as untrusted.

Do not place credentials, private data, production access tokens, or sensitive reproduction artifacts in public issues. Use a private channel agreed with the repository maintainer for sensitive reports. GitHub private vulnerability reporting must be enabled by the maintainer before it can be relied on; this scaffold does not claim it is enabled.

See [security and privacy design](docs/12-security-and-privacy.md) for the proposed trust model. Static validation does not authorize actions or establish that a host fixture is isolated. Do not run scripts against sensitive applications merely because they pass the schema.
