# Requirements delta: CIA2 ownership

> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md)
> **Parent**: [Index](00-index.md)

Implements the cooperative CIA2/NMINV portion of R5.11–R5.13 and R5.15–R5.18,
R5.20, R5.47–R5.48 and R5.53. It does not close those whole-RD rows.

The observable ownership and shutdown delta is exactly
[AR-P2](00-ambiguity-register.md#ar-p2--approved-observable-contract).
The only old-oracle exception is
[AR-P3](00-ambiguity-register.md#ar-p3--approved-exact-exception).
The compiler-owned direct design is
[AR-P4](00-ambiguity-register.md#ar-p4--direct-release-and-minimum-sufficient-design).

Frozen Chapter 06 interrupt/callback/storage semantics, Chapter 15's cooperative
generated-NMI exception and Appendix C64 §9.2 remain authoritative. No new
language feature, diagnostic identity, public platform binding or profile is
introduced. Existing CIA counter, latch, control and ICR signatures remain.

The qualified machine-entry condition is not a runtime probe or a promise about
an arbitrary pre-entry RS-232 session. Externally authored raw memory operations
remain the existing explicit boundary, with existing safety uncertainty; they
cannot silently supply a high-level ownership certificate.

Security: existing project/source/tool validation and immutable-generation
publication remain; no host command, format, network, dependency, authentication
or secret boundary changes. Ownership/provenance and failed-publication cases
are the applicable input-safety cases. Web/authentication checks are N/A.
