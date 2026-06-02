---
name: code-quality-audit
description: Main orchestrator skill that runs comprehensive code quality audit covering linting, formatting, type safety, error handling, security practices, refactoring opportunities, testing quality, design patterns, and documentation. Use for complete codebase review.
---

# Code Quality Audit (Main Orchestrator)

Comprehensive code quality audit that orchestrates all code review sub-skills.

## Usage

Run this skill when the user requests:
- "Review the code quality"
- "Perform a code audit"
- "Check code standards"
- "Run all code quality checks"
- "Comprehensive code review"

## Audit Process

This skill runs all code review sub-skills in sequence:

### Phase 1: Style & Standards
1. **linting-formatting** - Check code style and formatting
2. **type-safety** - Review TypeScript type safety

### Phase 2: Code Quality
3. **error-handling** - Review error handling patterns
4. **security-practices** - Security vulnerability scan
5. **refactoring-opportunities** - Identify code smells

### Phase 3: Architecture & Testing
6. **design-patterns** - Review pattern usage
7. **testing-quality** - Test coverage and quality
8. **code-documentation** - Documentation coverage

## Execution Steps

### Step 1: Run Automated Checks

```bash
# Full quality pipeline
npm run all

# This runs:
# 1. npm run format (auto-fix formatting)
# 2. npm run lint (check linting)
# 3. npm run build (TypeScript compilation)
# 4. npm run package (build distribution)
# 5. npm test (run unit tests)
```

### Step 2: Run Individual Skills

Execute each sub-skill and collect results:

```markdown
1. Running linting-formatting skill...
   ✅ Formatting: PASS (or ❌ FAIL)
   ⚠️  Issues found: [Count]

2. Running type-safety skill...
   ✅ Type safety: PASS (or ❌ FAIL)
   ⚠️  Issues found: [Count]

3. Running error-handling skill...
   ⚠️  Issues found: [Count]

4. Running security-practices skill...
   🔒 Critical issues: [Count]
   ⚠️  High priority: [Count]

5. Running refactoring-opportunities skill...
   ⚠️  Code smells: [Count]

6. Running design-patterns skill...
   ⚠️  Pattern violations: [Count]

7. Running testing-quality skill...
   ✅ Coverage: [X]%
   ⚠️  Missing tests: [Count]

8. Running code-documentation skill...
   ✅ Documentation: [X]%
   ⚠️  Missing docs: [Count]
```

### Step 3: Generate Comprehensive Report

Aggregate all results into a unified report (see format below).

## Comprehensive Report Format

```markdown
# Code Quality Audit Report

**Date**: [Date]
**Codebase**: Black Duck Security Scan
**Commit**: [Git SHA]

---

## Executive Summary

### Overall Score: [X]/100

| Category | Score | Status |
|----------|-------|--------|
| Linting & Formatting | [X]/100 | ✅/⚠️/❌ |
| Type Safety | [X]/100 | ✅/⚠️/❌ |
| Error Handling | [X]/100 | ✅/⚠️/❌ |
| Security Practices | [X]/100 | ✅/⚠️/❌ |
| Refactoring Needs | [X]/100 | ✅/⚠️/❌ |
| Design Patterns | [X]/100 | ✅/⚠️/❌ |
| Testing Quality | [X]/100 | ✅/⚠️/❌ |
| Documentation | [X]/100 | ✅/⚠️/❌ |

### Key Findings

**Critical Issues**: [Count]
**High Priority**: [Count]
**Medium Priority**: [Count]
**Low Priority**: [Count]

---

## Detailed Findings

### 1. Linting & Formatting

**Status**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

**Summary**:
- Formatting issues: [Count]
- Linting errors: [Count]
- Linting warnings: [Count]

**Top Issues**:
1. [Issue description] - [File:Line]
2. [Issue description] - [File:Line]

**Fix Command**: `npm run format && npm run lint-fix`

[Full report from linting-formatting skill]

---

### 2. Type Safety

**Status**: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

**Summary**:
- Implicit any: [Count]
- Missing return types: [Count]
- Null safety issues: [Count]
- Type safety score: [X]%

**Top Issues**:
1. [Issue description] - [File:Line]
2. [Issue description] - [File:Line]

[Full report from type-safety skill]

---

### 3. Error Handling

**Status**: ✅ GOOD / ⚠️ NEEDS IMPROVEMENT

**Summary**:
- Try-catch blocks reviewed: [Count]
- Issues found: [Count]
- Critical issues: [Count]

**Top Issues**:
1. [Issue description] - [File:Line]
2. [Issue description] - [File:Line]

[Full report from error-handling skill]

---

### 4. Security Practices

**Status**: 🔒 SECURE / ⚠️ VULNERABILITIES FOUND / ❌ CRITICAL

**Summary**:
- Critical vulnerabilities: [Count]
- High priority issues: [Count]
- Medium priority issues: [Count]

**Top Issues**:
1. [Issue description] - [File:Line] - [Risk level]
2. [Issue description] - [File:Line] - [Risk level]

**Security Scan**:
```
npm audit
[Results]
```

[Full report from security-practices skill]

---

### 5. Refactoring Opportunities

**Status**: ✅ CLEAN / ⚠️ NEEDS REFACTORING

**Summary**:
- Large functions (>50 lines): [Count]
- Deep nesting (>3 levels): [Count]
- Code duplication: [X]%
- God objects: [Count]

**Top Priorities**:
1. [Refactoring need] - [File] - Impact: [High/Med/Low]
2. [Refactoring need] - [File] - Impact: [High/Med/Low]

[Full report from refactoring-opportunities skill]

---

### 6. Design Patterns

**Status**: ✅ GOOD / ⚠️ VIOLATIONS FOUND

**Summary**:
- Patterns in use: [Count]
- Pattern violations: [Count]
- Missing patterns: [Count]
- SOLID violations: [Count]

**Top Issues**:
1. [Pattern issue] - [File:Line]
2. [Pattern issue] - [File:Line]

[Full report from design-patterns skill]

---

### 7. Testing Quality

**Status**: ✅ EXCELLENT / ⚠️ NEEDS IMPROVEMENT

**Summary**:
- Overall coverage: [X]%
- Statements: [X]%
- Branches: [X]%
- Functions: [X]%
- Lines: [X]%

**Coverage by Module**:
| Module | Coverage | Target | Status |
|--------|----------|--------|--------|
| validators.ts | [X]% | 100% | ✅/❌ |
| utility.ts | [X]% | 90% | ✅/❌ |
| bridge-cli.ts | [X]% | 80% | ✅/❌ |

**Missing Tests**: [Count]

[Full report from testing-quality skill]

---

### 8. Documentation

**Status**: ✅ WELL DOCUMENTED / ⚠️ GAPS FOUND

**Summary**:
- Documentation coverage: [X]%
- Public APIs documented: [X]/[Total]
- Missing JSDoc: [Count]
- Outdated comments: [Count]

**Top Gaps**:
1. [Missing doc] - [File:Line]
2. [Missing doc] - [File:Line]

[Full report from code-documentation skill]

---

## Action Items

### Critical (Fix Immediately)

1. **[Category]**: [Issue description]
   - File: [File:Line]
   - Fix: [How to fix]
   - Priority: Critical

2. **[Category]**: [Issue description]
   - File: [File:Line]
   - Fix: [How to fix]
   - Priority: Critical

### High Priority (Fix This Sprint)

1. **[Category]**: [Issue description]
   - File: [File:Line]
   - Fix: [How to fix]
   - Effort: [Low/Med/High]

2. **[Category]**: [Issue description]
   - File: [File:Line]
   - Fix: [How to fix]
   - Effort: [Low/Med/High]

### Medium Priority (Fix Soon)

[List medium priority issues]

### Low Priority (Nice to Have)

[List low priority issues]

---

## Recommendations

### Immediate Actions (This Week)

1. Run `npm run format && npm run lint-fix` to auto-fix style issues
2. Fix critical security vulnerabilities
3. Add missing error handling for async operations
4. Document public APIs without JSDoc

### Short-term Actions (This Month)

1. Increase test coverage to 80%+ across all modules
2. Refactor large functions (>100 lines)
3. Extract repeated code into utilities
4. Add missing input validation

### Long-term Actions (This Quarter)

1. Refactor tools-parameter.ts into product-specific builders
2. Implement missing design patterns (Adapter, Command)
3. Achieve 90%+ test coverage
4. Set up automated code quality gates in CI/CD

---

## Trends

[If running audit multiple times, show trends]

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Overall Score | [X] | [Y] | +/-[Z] |
| Test Coverage | [X]% | [Y]% | +/-[Z]% |
| Security Issues | [X] | [Y] | +/-[Z] |
| Documentation | [X]% | [Y]% | +/-[Z]% |

---

## Scoring Methodology

Each category is scored 0-100 based on:

- **Linting & Formatting**: Pass/fail + issue count
- **Type Safety**: % of functions with explicit types
- **Error Handling**: Coverage of error paths
- **Security**: Inverse of vulnerability count
- **Refactoring**: Inverse of code smell count
- **Design Patterns**: Proper usage + SOLID compliance
- **Testing**: Test coverage percentage
- **Documentation**: Documentation coverage percentage

**Overall Score**: Weighted average of all categories

---

## Next Steps

1. Review this report with the team
2. Prioritize action items
3. Create GitHub issues for high-priority items
4. Schedule refactoring work
5. Run audit again after fixes

---

## Appendix: Commands Used

```bash
npm run all                    # Full quality pipeline
npm test -- --coverage         # Test coverage
npm audit                      # Security vulnerabilities
tsc --noEmit                   # Type check
npm run format-check           # Formatting check
npm run lint                   # Linting check
```

## Appendix: Tools

- **TypeScript Compiler**: v5.0.4
- **ESLint**: v9.39.4
- **Prettier**: v3.3.3
- **Jest**: v30.3.0

---

**Generated by**: Code Quality Audit Skill
**Audit Duration**: [Time]
```

## Quick Run Mode

For a faster, summary-only audit:

```markdown
# Quick Code Quality Check

✅ **Linting**: PASS
⚠️  **Type Safety**: 3 issues found
⚠️  **Error Handling**: 2 issues found
🔒 **Security**: 1 high priority issue
⚠️  **Refactoring**: 5 opportunities identified
✅ **Design Patterns**: GOOD
⚠️  **Testing**: 75% coverage (target: 80%)
⚠️  **Documentation**: 85% coverage

**Overall Score**: 78/100

**Top Priority**: Fix security vulnerability in src/file.ts:123
**Run full audit**: Use code-quality-audit skill
```

## Integration with CI/CD

Suggested quality gates:

```yaml
# .github/workflows/quality.yml
- name: Code Quality Audit
  run: |
    npm run all
    npm test -- --coverage --coverageThreshold='{"global": {"statements": 80}}'
    npm audit --audit-level=moderate
```

## Usage Tips

1. **Run regularly**: Weekly or before major releases
2. **Track trends**: Compare scores over time
3. **Prioritize**: Focus on critical and high priority first
4. **Automate**: Integrate into CI/CD pipeline
5. **Team review**: Discuss findings in team meetings

## Customization

Adjust scoring weights based on your priorities:

```typescript
const weights = {
  linting: 0.10,
  typeSafety: 0.15,
  errorHandling: 0.15,
  security: 0.20,     // Higher weight for security
  refactoring: 0.10,
  patterns: 0.10,
  testing: 0.15,
  documentation: 0.05  // Lower weight for docs
}
```
