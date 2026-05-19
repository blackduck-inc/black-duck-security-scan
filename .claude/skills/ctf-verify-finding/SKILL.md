---
name: ctf-verify-finding
description: Use before accepting any Critical or High CTF security finding. Challenges the finding against the full build and deploy context — Docker secrets, Helm overrides, environment injection, dev-only files. Produces a verdict: Confirmed, Scoped, Downgraded, or Withdrawn.
---

# CTF Security Audit — Phase 3: Verify a Finding

**Run this for every Critical or High finding before accepting it.**

This is the step that distinguishes a credible audit from an automated scan. The question is always: does the build or deploy system already handle this?

## Verification Prompt

Replace `[FINDING ID]` and `[SEVERITY]` with the actual values, then send:

---

Before I accept [FINDING ID] as confirmed at [SEVERITY], challenge it against the full build and deploy context.

Check:

**1. Is this value used directly at runtime, or is it overridden by:**
- A Docker entrypoint script reading from `/run/secrets/`?
- A Helm / Kubernetes configmap or `values.yaml` template?
- An environment variable injection at container startup?
- A Spring `@Value` or `@ConfigurationProperties` pulling from config server?

**2. Is the file containing this value included in the production artifact?**
- Is it in `src/dev/` (excluded from production builds)?
- Does the Dockerfile `COPY` only specific directories?
- Is it a devDependency that never reaches the production bundle?
- Is it only consumed by the local dev server, not the production image?

**3. Is the security control at a different layer?**
- For auth: is there mTLS client-auth enforcing the control instead of JWT?
- For CSP: is nginx setting the header even if Spring Security disables it?
- For config: is the value a template placeholder overridden at deploy time?

Show me the specific files that answer each question.

Then give me your revised verdict:
- **Confirmed** — finding holds, severity unchanged
- **Scoped** — finding holds but narrower than stated (explain scope)
- **Downgraded** — finding holds but lower severity (explain why)
- **Withdrawn** — control confirmed, finding does not hold (explain evidence)

Show original vs revised score side by side with rationale.

---

## Verification Checklist

Use this for every finding before finalising severity:

| # | What to check | Confirmed if... | Downgraded/Withdrawn if... |
|---|---|---|---|
| 1 | Config value: overridden at runtime? | Value in production artifact AND no Docker secret / Helm override | Entrypoint reads from `/run/secrets/` first, OR Helm configmap provides override |
| 2 | Dependency: in the production bundle? | In `dependencies{}` AND imported in production source | In `devDependencies{}` AND not in production Dockerfile COPY |
| 3 | Authorization: control at a different layer? | No `@Secured` on service interface AND no custom AOP interceptor | `@Secured` on interface enforced by custom AOP |
| 4 | IDOR: caller identity verified? | No ownership check in controller OR service layer | `@MatchesCurrentUser` enforced via `@Validated` + `BvalMethodValidationInterceptor` |
| 5 | Open redirect: URL user-controllable? | Redirect URL from user input, query param, or attacker-writable storage | URL always from `window.location.href` (same-origin) |
| 6 | Config: file in production artifact? | File in `src/main/` or similar, included in Docker image or build | File in `src/dev/` — excluded from production build |
| 7 | XSS: attacker input reachable at sink? | User-controlled value flows to `innerHTML` / template without encoding | Value always same-origin or server-generated |
| 8 | Auth endpoint: rate limit or lockout? | No lockout bean, no rate-limiting interceptor | nginx upstream rate limiting confirmed, OR Spring Security lockout present |

---

## Common False Positives

Patterns that look like vulnerabilities in a surface scan but frequently resolve after verification:

| Surface finding | What to check | Likely outcome |
|---|---|---|
| Hardcoded password (`changeit`, `admin`) | Read Docker entrypoint: does it call `$(cat /run/secrets/X \|\| echo "default")`? | **Downgraded**: Docker secrets override confirmed. Residual: silent fallback if secret not provisioned. |
| Encryption disabled by default | Check Helm `values.yaml` for `{{- if .Values.enableX }}` override | **Downgraded**: Helm opt-in confirmed. Residual: default should be opt-out. |
| No `@PreAuthorize` on controller | Search for `spring-authorization*.xml` and custom `SecurityMetadataSource` | **Withdrawn**: custom AOP enforces `@Secured` on service interfaces |
| Anonymous access to internal API | Check `server.ssl.client-auth` — is mTLS enforced? | **Downgraded**: mTLS is auth mechanism. Risk depends on `client-auth=need` vs `want` |
| Malicious package version | Is it in `devDependencies` or `dependencies`? Imported in production? | **Downgraded**: devDependency only, never bundled into production image |
| Open redirect post-login | Where is redirect value written? Is it always `window.location.href`? | **Downgraded to Medium**: value same-origin at write time. Latent if XSS achieved first. |
| Missing ownership check on endpoint | Check service interface for `@MatchesCurrentUser` or `@Secured` | **Downgraded**: `@MatchesCurrentUser` enforced via `BvalMethodValidationInterceptor` |

---

## The Rule

> A finding is only **Confirmed** if the vulnerability exists in the actual deployed artifact or runtime.
> If a Docker entrypoint overrides the value, if a Helm configmap gates the feature, if an AOP interceptor enforces the permission — the finding is **Downgraded** or **Withdrawn**.
>
> Always read the full deployment chain before assigning Critical.
