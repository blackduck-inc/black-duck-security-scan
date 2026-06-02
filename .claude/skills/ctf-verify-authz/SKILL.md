---
name: ctf-verify-authz
description: Use when verifying any authorization-related CTF finding before accepting it. Maps the full authorization architecture first — Spring Security annotations, XML configs, custom AOP interceptors, custom annotations — before confirming a missing-auth finding. Prevents false positives from multi-layer auth systems.
---

# CTF Security Audit — Phase 3b: Authorization-Specific Verification

Use this for any finding where the claim is "no security annotation / no auth check exists."

**Always map the full authorization architecture before confirming.**

## Authorization Verification Prompt

Copy and send this prompt for any auth-related finding:

---

For any finding where I claim "no security annotation / no auth check exists", first verify the complete authorization architecture before confirming.

Search and read:

**1. Global security configuration**
- `@EnableGlobalMethodSecurity`, `@EnableMethodSecurity`, `@EnableWebSecurity`
- Note: `securedEnabled=true` is required for `@Secured` to fire
- Note: `prePostEnabled=true` is required for `@PreAuthorize`

**2. XML security configs**
- Files: `spring-authorization*.xml`, `spring-security*.xml`
- Look for: `global-method-security`, `access-decision-manager-ref`, `metadata-source-ref`, custom `SecurityMetadataSource` beans

**3. Custom security annotations**
- `@SecuredFeature`, `@NotSecured`, `@SecuredImplementation`, `@SecuredEntity`
- Find their processors: `*AnnotationMetadataExtractor`, `*Voter` classes

**4. AOP advisors and interceptors**
- `MethodSecurityInterceptor`, `BvalMethodValidationInterceptor`
- Find: `@Validated` on service implementation classes
- Find: custom constraint validators (`@MatchesCurrentUser`, etc.)

**5. For the specific method in question**
- Check the **SERVICE INTERFACE**, not just the controller or impl
- Is the method annotated? What annotation? What permission?
- If no annotation: is `@NotSecured` present (intentional) or absent (omission)?

---

Only confirm a missing authorization finding if:
- The method has NO `@Secured`, `@PreAuthorize`, `@NotSecured`, `@SecuredFeature`
- AND the AOP system would not intercept it (no custom interceptor covers it)
- AND the absence is an omission vs a design decision

Show evidence for each point above before giving your verdict.

---

## Authorization Architecture Reference

When mapping auth layers, check in this order:

| Layer | Annotation / Config | What it does |
|---|---|---|
| Web layer | `@EnableWebSecurity`, `HttpSecurity` | URL-level access rules |
| Controller | `@PreAuthorize("hasRole(...)")`, `@Secured` | Method-level at controller |
| Service interface | `@Secured`, `@SecuredFeature`, `@NotSecured` | Method-level at service boundary |
| Service impl | `@Validated` | Activates constraint validators |
| Custom validator | `@MatchesCurrentUser`, custom `ConstraintValidator` | Per-field ownership check |
| AOP interceptor | `MethodSecurityInterceptor`, `BvalMethodValidationInterceptor` | Enforces annotations globally |
| XML config | `global-method-security`, `access-decision-manager-ref` | Legacy Spring Security XML |
| Custom | `SecuredAnnotationMetadataExtractor`, `AccessDecisionVoter` | Fully custom decision logic |

---

## Key Insight

> The most common false positive in authorization analysis is a **multi-layer system** where:
> - The **controller** has no annotation (by design — not the enforcement layer)
> - The **service interface** has `@Secured` or a custom annotation
> - The **AOP system** enforces that annotation globally via `MethodSecurityInterceptor`
>
> A surface scan sees: "controller method, no annotation → possible missing auth"
> Reality: auth is enforced one layer deeper, by design
>
> Always check the service interface. Never confirm from the controller alone.
