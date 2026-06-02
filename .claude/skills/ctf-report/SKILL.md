---
name: ctf-report
description: Use after all CTF security findings have been verified. Produces the final revised report showing original assessment vs reinspection for every finding, with verdict labels (Confirmed, Scoped, Downgraded, Withdrawn), colour-coded borders, revised score comparison, and header stats. Output is interactive HTML with expand/collapse per finding.
---

# CTF Security Audit — Phase 4: Final Report

Run this after all Critical and High findings have been verified with `ctf-verify-finding` and `ctf-verify-authz`.

## Final Report Prompt

Copy and send this prompt:

---

Revise the report to show original assessment vs reinspection for every finding.

**Format for each finding:**
- Left column: Original assessment (score, severity, summary)
- Right column: After reinspection (revised score, revised severity, key evidence)

**Verdict label** (shown prominently on each finding):
- `CONFIRMED` — original severity upheld, evidence reviewed
- `SCOPED` — finding valid, but narrower scope than originally stated
- `DOWNGRADED` — finding valid, lower severity after build/deploy context review
- `WITHDRAWN` — security control confirmed, finding does not hold

**Header stats:** show revised Critical / High / Medium / Low / Withdrawn counts.

**Left border colour per verdict:**
- Red = Confirmed
- Yellow = Scoped / Downgraded
- Green = Withdrawn
- Blue = Unchanged

**Rationale box** below each finding explaining the reinspection decision.

For **withdrawn** findings: explain exactly what control was found and why it was not visible in the initial analysis.

For **confirmed** findings: state what additional evidence was checked that confirmed the finding holds.

Produce as **interactive HTML** (expand/collapse per finding).

---

## Report Quality Checklist

Before finalising the report, verify:

- [ ] Every Critical finding has a verification verdict (not just an initial severity)
- [ ] Every High finding has a verification verdict
- [ ] Withdrawn findings explain the specific control found (not just "control confirmed")
- [ ] Downgraded findings explain why severity changed (scope, layer, or deployment context)
- [ ] Header stats reflect the revised counts, not the original sweep counts
- [ ] Rationale boxes reference specific files, configs, or code that drove the verdict
- [ ] HTML report is interactive (expand/collapse works per finding)

---

## Verdict Definitions

| Verdict | Meaning | Score change |
|---|---|---|
| **CONFIRMED** | Finding holds as originally stated. Evidence reviewed and deployment chain checked — no override found. | None |
| **SCOPED** | Finding holds but applies to a narrower surface than originally stated. E.g. only affects dev environment, or only one of three endpoints. | None to slight reduction |
| **DOWNGRADED** | Finding holds but a partial control exists that reduces exploitability or impact. E.g. Docker secrets override exists but silent fallback remains. | Reduction |
| **WITHDRAWN** | A complete control was found that fully addresses the risk in production. Finding does not hold. | Removed from count |

---

## The Audit Sequence (Summary)

```
ctf-recon          → Prepare zip, confirm scope and file inventory
ctf-discovery      → Main SAST/SCA/Config/Auth sweep, top 10 findings
ctf-idor-authz     → Deep dive: IDOR, authorization logic, auth logic bugs
ctf-verify-finding → Challenge every Critical/High against build/deploy chain
ctf-verify-authz   → Map auth architecture before confirming missing-auth findings
ctf-report         → Final revised report: original vs reinspection, all verdicts
```

> **Do not skip verification.**
> That is the only step that separates this from an automated scan.
