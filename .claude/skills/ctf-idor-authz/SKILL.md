---
name: ctf-idor-authz
description: Use after ctf-discovery for a focused deep dive into IDOR, authorization logic bugs, and authentication logic bugs. These vulnerabilities require tracing logic, not grep patterns, and hide deeper than the main sweep catches. Run as a separate pass.
---

# CTF Security Audit — Phase 2b: IDOR, Authorization & Authentication Deep Dive

Run this as a **separate focused pass** after `ctf-discovery`. These bugs require tracing logic — not just pattern-matching.

## Deep Dive Prompt

Copy and send this prompt:

---

Now run a focused review specifically for three categories. These require tracing logic, not just grep patterns.

---

**1. IDOR — Insecure Direct Object Reference**

- Find all endpoints accepting user/resource IDs as path variables
- For each: trace whether caller identity is verified against the resource
- Check: `@PathVariable UUID userId` — is there an ownership assertion?
- High-value targets:
  - password reset / change endpoints
  - notification read / update endpoints
  - user profile, preferences, settings endpoints
  - project / resource deletion endpoints
  - bulk state update endpoints

---

**2. Authorization Logic Bugs**

- Map the authorization architecture first:
  - Is it controller-level (`@PreAuthorize`, `@Secured`)?
  - Is it service-layer (AOP, custom annotations)?
  - Is it XML-configured (`spring-authorization*.xml`)?
  - Is it custom (`SecuredAnnotationMetadataExtractor`, `AccessDecisionManager`)?
- Only after mapping the architecture: identify methods with NO annotation
- Check for wrong permission validated (project access ≠ user ownership)
- Flag: `@NotSecured` present (intentional) vs no annotation (possible omission)

---

**3. Authentication Logic Bugs**

- Error message disclosure: raw exception messages rendered in login UI
- Header injection: user-controlled headers injected into HTML templates
- Rate limiting: auth endpoints with no lockout or throttle
- MFA flows: token timing issues, bypass paths, pre-auth state mutation
- Server-controlled URLs: server response body used as redirect or API target
- Pre-auth surfaces: anything that runs before session is established

---

For each finding: file + line reference, attack scenario (step by step), severity score (0-10), mitigation.

Add to the existing HTML report. Same format.

---

## Key Pattern: Authorization Architecture Mapping

**Always map auth architecture before claiming "no auth check exists."**

The authorization enforcement may live at a different layer than the controller:

| Layer | What to look for |
|---|---|
| Controller | `@PreAuthorize`, `@Secured`, `@RolesAllowed` |
| Service interface | `@Secured`, `@SecuredFeature`, `@NotSecured` |
| AOP / interceptor | `MethodSecurityInterceptor`, `BvalMethodValidationInterceptor` |
| XML config | `spring-authorization*.xml`, `global-method-security` |
| Custom annotation | `@MatchesCurrentUser`, `@SecuredEntity`, custom voters |

Do not confirm a missing-auth finding until all layers are checked.

Then use `ctf-verify-authz` to verify any specific authorization findings before accepting them.
