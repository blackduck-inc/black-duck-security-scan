---
name: code-explainer-design-patterns
description: Identifies, explains, and documents design patterns used in the codebase. Analyzes Factory, Builder, Strategy, Template Method, and other patterns. Use when users ask "what patterns are used" or "explain the design patterns".
---

# Design Patterns Explainer

Identifies and explains design patterns in the Black Duck Security Scan codebase, including where they're implemented, why they're used, and how to work with them.

## Usage

Run this skill when the user asks:
- "What design patterns are used in this codebase?"
- "Explain the factory pattern implementation"
- "How does the builder pattern work here?"
- "Show me examples of design patterns"
- "Where is the strategy pattern used?"

## Analysis Steps

### Step 1 — Pattern Identification

Search the codebase for common design patterns:

1. **Creational Patterns**
   - Factory Pattern (Factory Method, Abstract Factory)
   - Builder Pattern
   - Singleton Pattern

2. **Structural Patterns**
   - Adapter Pattern
   - Facade Pattern
   - Decorator Pattern

3. **Behavioral Patterns**
   - Strategy Pattern
   - Template Method Pattern
   - Observer Pattern
   - Command Pattern

### Step 2 — Pattern Analysis

For EACH pattern found, document:

#### Pattern Name: Factory Pattern

**Location**: `src/blackduck-security-action/factory/github-client-service-factory.ts`

**Lines**: 11-67

**Purpose**:
Runtime selection between GitHub Cloud and GitHub Enterprise Server implementations based on server URL.

**Problem Solved**:
- Need different SARIF upload strategies for Cloud vs Enterprise
- Must detect GitHub version at runtime
- Should abstract creation logic from consumers

**Implementation Details**:

```typescript
// Factory object (not class) with static method
export const GitHubClientServiceFactory = {
  async getGitHubClientServiceInstance(): Promise<IGithubClientService> {
    // Detection logic
    if (isGitHubCloudUrl) {
      return new GithubClientServiceCloud()
    } else {
      const version = await detectEnterpriseVersion()
      return new GithubClientServiceV1()
    }
  }
}
```

**Key Characteristics**:
- Static factory method
- Returns interface type (IGithubClientService)
- Encapsulates complex creation logic
- Handles version detection internally

**Usage Example**:

```typescript
// main.ts:92-113
const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
await gitHubClientService.uploadSarifReport(sarifPath)
```

**Benefits**:
- Callers don't need to know which implementation to use
- Centralized version detection logic
- Easy to add new GitHub versions without changing callers
- Testable through interface mocking

**Trade-offs**:
- ✅ Abstraction: Clean separation of concerns
- ✅ Extensibility: Easy to add new implementations
- ⚠️ Indirection: One extra layer between caller and implementation

---

[Continue this format for each pattern]

### Step 3 — Pattern Relationships

Show how patterns interact:

```
Factory Pattern (creates) → Strategy Pattern (uses)
                          → Template Method (inherits from)
```

**Example Flow**:
1. `GitHubClientServiceFactory` creates appropriate service instance
2. Service implements `IGithubClientService` (Strategy Pattern)
3. Service extends `GithubClientServiceBase` (Template Method Pattern)
4. Base class provides retry logic template

### Step 4 — Pattern Opportunities

Identify places where patterns COULD be applied but aren't:

1. **Missing Builder Pattern**
   - **Location**: tools-parameter.ts methods (lines 36-667)
   - **Current**: Large methods with nested conditionals building commands
   - **Opportunity**: Fluent builder for Bridge CLI commands
   - **Benefit**: Better readability, testability, and composition

2. **Missing Strategy Pattern**
   - **Location**: Validation logic (validators.ts)
   - **Current**: Product-specific validation functions
   - **Opportunity**: Validation strategy interface with product implementations
   - **Benefit**: Reduce duplication, easier to add new products

3. **Missing Command Pattern**
   - **Location**: Bridge CLI execution
   - **Current**: Direct command building and execution
   - **Opportunity**: Command objects for each Bridge operation
   - **Benefit**: Better logging, undo capability, command queueing

### Step 5 — Anti-Patterns

Identify and explain anti-patterns or pattern misuse:

1. **God Object**
   - **Location**: `tools-parameter.ts` (994 lines)
   - **Issue**: Single class handles all product command building
   - **Impact**: Hard to test, maintain, extend
   - **Recommendation**: Extract product-specific builders

2. **Large Class**
   - **Location**: `utility.ts` (353 lines, 35+ functions)
   - **Issue**: Lacks cohesion, mixed responsibilities
   - **Impact**: Unclear purpose, difficult to navigate
   - **Recommendation**: Split into focused utility modules

## Output Format

Provide analysis as structured markdown:

```markdown
# Design Patterns Analysis: Black Duck Security Scan

## Patterns Implemented

### 1. Factory Pattern
**Location**: `file.ts:lines`
**Purpose**: [Why this pattern]
**Implementation**: [How it works]
**Example**: [Usage with file:line reference]
**Benefits**: [What it provides]

### 2. Builder Pattern
[Same structure]

[Continue for all patterns found]

## Pattern Relationships

[Diagram or description of how patterns interact]

## Pattern Opportunities

### Opportunity 1: [Pattern Name] for [Use Case]
**Current Code**: `file.ts:lines`
**Problem**: [What's wrong]
**Proposed Pattern**: [Pattern to apply]
**Benefits**: [Improvements]
**Example Refactoring**: [Code snippet]

## Anti-Patterns Detected

### 1. [Anti-Pattern Name]
**Location**: `file.ts:lines`
**Issue**: [Description]
**Impact**: [Consequences]
**Recommendation**: [How to fix]

## Best Practices Summary

- [Key takeaways from pattern analysis]
- [Recommendations for future development]
```

## Pattern Catalog for This Codebase

Based on analysis, document these patterns:

### 1. Factory Pattern
- **File**: `factory/github-client-service-factory.ts`
- **Type**: Static Factory Method
- **Creates**: IGithubClientService implementations

### 2. Builder Pattern (Implicit)
- **File**: `tools-parameter.ts`
- **Type**: Command Builder (not fluent)
- **Builds**: Bridge CLI commands with JSON input files

### 3. Strategy Pattern
- **File**: `service/impl/` directory
- **Type**: Interface-based Strategy
- **Strategies**: Cloud vs Enterprise SARIF upload

### 4. Template Method Pattern
- **File**: `service/impl/github-client-service-base.ts`
- **Type**: Abstract base class with template methods
- **Templates**: Retry logic, artifact upload

### 5. Adapter Pattern (Partial)
- **File**: `artifacts.ts`
- **Type**: Wrapper for v1/v2 artifact APIs
- **Adapts**: @actions/artifact v1 and v2 APIs

## Analysis Checklist

When explaining patterns, ensure you:

- ✅ Identify the pattern name correctly
- ✅ Show exact file:line locations
- ✅ Explain WHY the pattern is used
- ✅ Provide concrete code examples
- ✅ Discuss benefits AND trade-offs
- ✅ Show usage examples from the codebase
- ✅ Identify relationships between patterns
- ✅ Suggest improvements where patterns are missing or misapplied

## Example Queries Answered

**Q: "How does the factory pattern work in this codebase?"**
A: Explain GitHubClientServiceFactory with runtime service selection

**Q: "What's the builder pattern used for?"**
A: Explain BridgeToolsParameter command building for Bridge CLI

**Q: "Are there any anti-patterns I should know about?"**
A: Identify God Object in tools-parameter.ts and Large Class in utility.ts

**Q: "How can I extend this codebase following existing patterns?"**
A: Show how to add new GitHub Enterprise version using factory pattern