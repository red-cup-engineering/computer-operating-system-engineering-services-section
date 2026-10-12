# @red-cup-engineering/computer

This active package is the operating-system layer used by Aletheon: durable append and
plain-text POSIX reads, plus the pure EAVT fold/section projection over
`@lenticule-science/metrologic`.

The generic JSON carrier is deliberately upstream. `@red-cup-engineering/json-codec-service`
owns JSON bytes; this package consumes those bytes for strict `{e,a,v,t}` row
identity and persistence. It does not own a second canonicalizer. EAVT remains a carrier and
identity/fold substrate here—not an operation-log format and not the strict SEAVT witness law.
SEAVT's SRN/RMN admission, semantic identity, custody, derived trace, and reading-specific
charge belong to the witness-journal services.

Its implementation is recovered from the last `computer/` source tree before archival
(`a87bdf45e79601b7db5af1cf8e7bd95a7d561bff`). The public surface is deliberately the coherent
subset exercised by active consumers; historical experimental tiles remain in Git history rather
than becoming undeclared or unshipped exports.

All cross-package imports resolve through exact registry versions. There are no workspace or local
filesystem dependency semantics.
