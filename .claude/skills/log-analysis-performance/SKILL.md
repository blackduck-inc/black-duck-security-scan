---
name: performance-log-analyzer
description: Analyzes performance metrics from GitHub Actions runs including execution time, resource usage, bottlenecks, and optimization opportunities. Identifies slow operations and suggests performance improvements.
---

# Performance Log Analyzer

Analyzes performance metrics and identifies optimization opportunities.

## Usage

Run this skill when the user wants to:
- Analyze workflow execution time
- Identify performance bottlenecks
- Optimize slow operations
- Compare performance across runs
- Investigate timeout issues

## Performance Metrics to Analyze

### 1. Execution Time Breakdown

**From GitHub Actions logs, extract timing for**:

```
Setup job               [X]s
Checkout code          [X]s
Setup Node.js          [X]s
Install dependencies   [X]s
Download Bridge CLI    [X]s
Execute Bridge CLI     [X]s
Upload SARIF           [X]s
Upload diagnostics     [X]s
Total execution        [X]s
```

### 2. Bridge CLI Performance

**Polaris Scan**:
```
[INFO] Starting Polaris scan...
[INFO] Analysis phase: 45s
[INFO] Upload phase: 30s
[INFO] Total scan time: 75s
```

**Black Duck Scan**:
```
[INFO] Starting Black Duck SCA scan...
[INFO] Signature scan: 120s
[INFO] Dependency analysis: 60s
[INFO] Upload results: 15s
[INFO] Total scan time: 195s
```

### 3. Network Operations

**Download Performance**:
```
Downloading Bridge CLI (85 MB)...
Download started: 10:15:30
Download completed: 10:16:45
Duration: 75s
Speed: ~1.13 MB/s
```

**Upload Performance**:
```
Uploading SARIF report (2.5 MB)...
Upload started: 10:20:00
Upload completed: 10:20:15
Duration: 15s
Speed: ~171 KB/s
```

### 4. Resource Usage

**Memory Usage** (if available):
```
Peak memory: 2.1 GB
Average memory: 1.5 GB
```

**Disk I/O**:
```
Files read: 1,245
Files written: 28
Temp directory size: 350 MB
```

## Performance Analysis

### Step 1: Identify Bottlenecks

**Categorize operations by duration**:

#### Critical (>5 minutes)
- Bridge CLI execution: 8m 30s
- Dependency installation: 6m 15s

#### High (2-5 minutes)
- Black Duck signature scan: 3m 45s
- Download Bridge CLI: 2m 10s

#### Medium (30s - 2 minutes)
- Polaris analysis: 1m 15s
- SARIF upload: 45s

#### Low (<30 seconds)
- Checkout: 15s
- Setup Node: 20s

### Step 2: Calculate Percentages

```markdown
## Time Distribution

Total execution: 15m 30s

| Operation | Time | Percentage |
|-----------|------|------------|
| Bridge CLI execution | 8m 30s | 55% |
| npm install | 6m 15s | 40% |
| Download Bridge CLI | 2m 10s | 14% |
| SARIF upload | 45s | 5% |
| Other | 1m 50s | 12% |
```

### Step 3: Compare Against Baseline

**Historical Performance**:

| Date | Total Time | Bridge CLI | npm install | Change |
|------|------------|------------|-------------|--------|
| 2024-01-01 | 12m 30s | 7m 00s | 4m 30s | Baseline |
| 2024-01-08 | 13m 45s | 7m 30s | 5m 15s | +10% |
| 2024-01-15 | 15m 30s | 8m 30s | 6m 15s | +24% ⚠️ |

**Trend**: Gradual performance degradation

### Step 4: Identify Root Causes

**Why is performance degrading?**

1. **Dependency count increased**
   - package.json dependencies: 15 → 22
   - npm install time: 4m 30s → 6m 15s
   - Fix: Review and remove unnecessary dependencies

2. **Codebase size grew**
   - Files analyzed: 45 → 67
   - Bridge CLI time: 7m → 8m 30s
   - Expected: More code = more scan time

3. **Network speed decreased**
   - Bridge CLI download: 1.5 MB/s → 0.65 MB/s
   - Fix: Use caching or local Bridge CLI

## Performance Optimization Opportunities

### 1. Caching Strategies

#### Cache Node Modules

**Current**:
```yaml
- name: Install dependencies
  run: npm install  # 6m 15s every run
```

**Optimized**:
```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

- name: Install dependencies
  run: npm install  # ~30s on cache hit
```

**Savings**: 5m 45s on cache hits

#### Cache Bridge CLI

**Current**:
```yaml
# Downloads Bridge CLI every run (2m 10s)
```

**Optimized**:
```yaml
- name: Cache Bridge CLI
  uses: actions/cache@v3
  with:
    path: ~/.bridge-cli
    key: bridge-cli-${{ env.BRIDGE_VERSION }}
```

**Savings**: 2m 10s on cache hits

### 2. Parallel Execution

**Current (Sequential)**:
```
Download Bridge CLI (2m 10s)
  ↓
npm install (6m 15s)
  ↓
Execute Bridge CLI (8m 30s)

Total: 16m 55s
```

**Optimized (Parallel)**:
```
Download Bridge CLI (2m 10s) ┐
                              ├→ Both run in parallel
npm install (6m 15s)         ┘
  ↓
Execute Bridge CLI (8m 30s)

Total: 14m 45s (saved 2m 10s)
```

### 3. Incremental Analysis

**For Polaris/Coverity**:
- Enable incremental analysis
- Only analyze changed files
- Significant savings for large codebases

**Configuration**:
```yaml
polaris_prComment_enabled: true  # Enables incremental for PRs
```

### 4. Optimize Scans

#### Skip Unnecessary Scans

**Current**:
```yaml
# Runs all scans on every commit
polaris_assessment_types: 'SAST,SCA'
```

**Optimized**:
```yaml
# SAST only for PRs, full scan for main
polaris_assessment_types: ${{ github.event_name == 'pull_request' && 'SAST' || 'SAST,SCA' }}
```

#### Selective Scanning

```yaml
# Only scan if code changed (not just docs)
- name: Check for code changes
  id: changes
  run: |
    if git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -E '\.(ts|js|tsx|jsx)$'; then
      echo "code_changed=true" >> $GITHUB_OUTPUT
    fi

- name: Run security scan
  if: steps.changes.outputs.code_changed == 'true'
  # ... scan steps
```

### 5. Resource Optimization

#### Use Faster Runners

**Current**: Standard GitHub-hosted runner
**Alternative**: Self-hosted runner with more resources
**Impact**: 20-30% faster execution

#### Optimize Docker Images

If using containers:
- Use multi-stage builds
- Minimize image size
- Cache layers effectively

## Performance Report Format

```markdown
# Performance Analysis Report

**Date**: [Date]
**Workflow Run**: [Link]
**Total Execution Time**: [X]m [Y]s

---

## Executive Summary

**Performance Status**: ✅ GOOD / ⚠️ SLOW / ❌ CRITICAL

**Key Metrics**:
- Total time: [X]m [Y]s (Target: <10m)
- Bridge CLI: [X]m [Y]s (55% of total)
- Dependencies: [X]m [Y]s (40% of total)

**vs Previous Run**: +15% slower ⚠️
**vs Baseline**: +24% slower ⚠️

**Primary Bottleneck**: npm install (6m 15s)

---

## Time Breakdown

| Operation | Duration | % of Total | Status |
|-----------|----------|------------|--------|
| Bridge CLI execution | 8m 30s | 55% | ⚠️ Slow |
| npm install | 6m 15s | 40% | ⚠️ Slow |
| Download Bridge CLI | 2m 10s | 14% | ⚠️ Can optimize |
| SARIF upload | 45s | 5% | ✅ Good |
| Checkout & Setup | 35s | 4% | ✅ Good |
| **Total** | **15m 30s** | **100%** | ⚠️ **Slow** |

---

## Performance Trends

| Date | Total | Change | Bridge CLI | npm install |
|------|-------|--------|------------|-------------|
| 2024-01-01 | 12m 30s | Baseline | 7m 00s | 4m 30s |
| 2024-01-08 | 13m 45s | +10% | 7m 30s | 5m 15s |
| 2024-01-15 | 15m 30s | +24% ⚠️ | 8m 30s | 6m 15s |

**Trend**: ⬆️ Degrading performance (24% slower)

---

## Bottleneck Analysis

### 1. npm install (6m 15s - 40% of total)

**Root Cause**:
- Dependency count increased: 15 → 22 packages
- No caching enabled
- Full install every run

**Impact**: HIGH
**Optimization Potential**: 90% time reduction with caching

**Recommended Fix**:
```yaml
- uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

**Expected Result**: 6m 15s → ~30s (5m 45s saved)

---

### 2. Bridge CLI Execution (8m 30s - 55% of total)

**Breakdown**:
- Polaris SAST: 3m 30s
- Polaris SCA: 2m 15s
- Black Duck SCA: 2m 45s

**Root Cause**:
- Codebase size increased: 45 → 67 files
- Full scan every time (no incremental)

**Impact**: MEDIUM
**Optimization Potential**: 40-50% for PR scans

**Recommended Fix**:
```yaml
# Enable incremental for PRs
polaris_prComment_enabled: true

# Or skip SCA on PRs, full scan on main
polaris_assessment_types: ${{ github.event_name == 'pull_request' && 'SAST' || 'SAST,SCA' }}
```

**Expected Result**: 8m 30s → 4-5m for PRs

---

### 3. Bridge CLI Download (2m 10s - 14% of total)

**Root Cause**:
- Downloads 85 MB every run
- Network speed: ~0.65 MB/s (slower than usual)

**Impact**: MEDIUM
**Optimization Potential**: 100% with caching or air-gap mode

**Recommended Fixes**:

**Option 1: Cache Bridge CLI**
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.bridge-cli
    key: bridge-cli-${{ env.BRIDGE_VERSION }}
```

**Option 2: Air-gap mode** (pre-installed Bridge CLI)
```yaml
with:
  bridgecli_install_directory: '/path/to/preinstalled/bridge'
  network_airgap: true
```

**Expected Result**: 2m 10s → 0s (2m 10s saved)

---

## Optimization Recommendations

### Quick Wins (High Impact, Low Effort)

1. **Enable Node Modules Caching**
   - Impact: Save 5m 45s per run (cache hits)
   - Effort: 5 minutes to implement
   - Priority: HIGH

2. **Enable Bridge CLI Caching**
   - Impact: Save 2m 10s per run (cache hits)
   - Effort: 10 minutes to implement
   - Priority: HIGH

3. **Selective Scanning for PRs**
   - Impact: Save 4-5m on PR scans
   - Effort: 15 minutes to implement
   - Priority: MEDIUM

**Total Potential Savings**: 10-12 minutes per run (~65% reduction)

### Medium-term Optimizations

4. **Review and Remove Unused Dependencies**
   - Impact: Faster npm install even on cache miss
   - Effort: 1-2 hours audit
   - Priority: MEDIUM

5. **Enable Incremental Analysis**
   - Impact: Faster scans for unchanged code
   - Effort: Configuration change
   - Priority: MEDIUM

6. **Parallel Dependency Installation and Bridge Download**
   - Impact: Save 2m 10s
   - Effort: Workflow refactoring (30 min)
   - Priority: LOW

### Long-term Optimizations

7. **Self-hosted Runners**
   - Impact: 20-30% overall speedup
   - Effort: Infrastructure setup
   - Priority: LOW (for very large teams)

8. **Monorepo Optimization**
   - Impact: Scan only changed packages
   - Effort: Significant workflow changes
   - Priority: LOW (if applicable)

---

## Performance Targets

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total time | 15m 30s | <10m | 5m 30s |
| Bridge CLI | 8m 30s | 5m | 3m 30s |
| npm install | 6m 15s | <1m | 5m 15s |
| Downloads | 2m 10s | 0s | 2m 10s |

---

## Action Plan

### Phase 1: Immediate (This Week)

- [ ] Implement node_modules caching
- [ ] Implement Bridge CLI caching
- [ ] Test cache hit/miss scenarios
- [ ] Measure improvement

**Expected Result**: 10-12m total time (35% improvement)

### Phase 2: Short-term (This Month)

- [ ] Enable incremental scans for PRs
- [ ] Review and remove unused dependencies
- [ ] Optimize scan configurations

**Expected Result**: 7-8m total time (50% improvement)

### Phase 3: Long-term (This Quarter)

- [ ] Evaluate self-hosted runners
- [ ] Implement selective scanning by file changes
- [ ] Set up performance monitoring

**Expected Result**: <6m total time (60%+ improvement)

---

## Monitoring

**Set up alerts for**:
- Total time >20 minutes (critical)
- Total time >15 minutes (warning)
- 20% slower than baseline

**Track metrics**:
- Average execution time (weekly)
- Cache hit rate
- Bottleneck trends

---

**Analysis Duration**: [Time]
**Next Review**: [Date]
```

## Performance Monitoring Tools

```bash
# GitHub Actions timing
gh run view [run-id] --log | grep -E "took|duration|time"

# Extract timing data
grep -oP "completed in \K[0-9]+s" workflow.log

# Compare runs
gh run list --workflow="CI" --limit=10 --json conclusion,timing
```

## Best Practices

### DO:
- ✅ Cache dependencies and tools
- ✅ Use incremental analysis
- ✅ Parallelize independent operations
- ✅ Monitor performance trends
- ✅ Set performance budgets

### DON'T:
- ❌ Run full scans for every PR
- ❌ Download tools every run
- ❌ Install all dependencies without caching
- ❌ Ignore performance degradation
- ❌ Over-optimize without measuring

## Common Performance Issues

### Issue 1: No Caching
**Symptom**: Long npm install every run
**Fix**: Implement dependency caching

### Issue 2: Sequential Operations
**Symptom**: Operations that could run in parallel run sequentially
**Fix**: Restructure workflow for parallelism

### Issue 3: Full Scans Every Time
**Symptom**: Same scan time for small code changes
**Fix**: Enable incremental analysis

### Issue 4: Slow Network
**Symptom**: Download operations taking too long
**Fix**: Use caching or air-gap mode

## Fix Priority

1. **Critical**: Total time >20 minutes
2. **High**: Operations >5 minutes without caching
3. **Medium**: 15-20% performance degradation
4. **Low**: Minor optimizations (<1 minute savings)