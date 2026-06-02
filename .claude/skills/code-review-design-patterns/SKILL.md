---
name: design-patterns
description: Reviews design pattern usage and identifies pattern violations, missing patterns, and opportunities to apply Factory, Builder, Strategy, Template Method, and other patterns. Ensures architectural consistency.
---

# Design Patterns Review

Reviews design pattern implementation and identifies opportunities to apply patterns.

## Existing Patterns Review

### 1. Factory Pattern

**Location**: `factory/github-client-service-factory.ts`

**Review**:
- ✅ Properly encapsulates creation logic
- ✅ Returns interface type
- ✅ Handles version detection
- ⚠️  Could add caching for repeated calls

### 2. Builder Pattern (Implicit)

**Location**: `tools-parameter.ts`

**Review**:
- ⚠️  Not a true builder (not fluent)
- ⚠️  Methods too large (200-320 lines)
- ❌ Could benefit from refactoring to proper builder

**Recommended Refactoring**:
```typescript
// Current: Large methods
getFormattedCommandForPolaris(): string[]

// Better: Fluent builder
new PolarisCommandBuilder()
  .withServer(url, token)
  .withProject(name)
  .withAssessment(types)
  .build()
```

### 3. Strategy Pattern

**Location**: `service/impl/`

**Review**:
- ✅ Clean interface-based strategy
- ✅ Proper abstraction (IGithubClientService)
- ✅ Multiple implementations (Cloud, Enterprise)
- ⚠️  Could add more strategies (e.g., dry-run mode)

### 4. Template Method Pattern

**Location**: `service/impl/github-client-service-base.ts`

**Review**:
- ✅ Provides common retry logic
- ✅ Subclasses override specific methods
- ⚠️  Limited use of template method
- 💡 Could expand for more common operations

## Pattern Violations

### 1. God Object Anti-Pattern

**Violation**: `tools-parameter.ts` (994 lines)

**Issue**:
- Single class handles all products
- Mixed responsibilities
- Violates Single Responsibility Principle

**Fix**: Apply Factory + Builder patterns
```typescript
class CommandBuilderFactory {
  static create(product: string): ProductCommandBuilder {
    switch(product) {
      case 'polaris': return new PolarisCommandBuilder()
      case 'coverity': return new CoverityCommandBuilder()
      // ...
    }
  }
}
```

### 2. Missing Adapter Pattern

**Opportunity**: `artifacts.ts`

**Current**: Direct usage of v1 and v2 artifact APIs

**Better**: Adapter pattern
```typescript
interface ArtifactAdapter {
  upload(path: string): Promise<void>
}

class ArtifactV1Adapter implements ArtifactAdapter {
  // Adapt v1 API
}

class ArtifactV2Adapter implements ArtifactAdapter {
  // Adapt v2 API
}
```

### 3. Missing Command Pattern

**Opportunity**: Bridge CLI execution

**Current**: Direct execution with string building

**Better**: Command objects
```typescript
interface BridgeCommand {
  execute(): Promise<number>
}

class PolarisScanCommand implements BridgeCommand {
  async execute(): Promise<number> {
    // Execute Polaris scan
  }
}
```

## Pattern Opportunities

### 1. Singleton Pattern

**Use Case**: Configuration manager

**Example**:
```typescript
class ConfigurationManager {
  private static instance: ConfigurationManager
  private constructor() {}

  static getInstance(): ConfigurationManager {
    if (!this.instance) {
      this.instance = new ConfigurationManager()
    }
    return this.instance
  }
}
```

**Should Apply**:
- ⚠️  Use sparingly (testability concerns)
- ✅ Good for: Loggers, config managers
- ❌ Bad for: Most business logic

### 2. Observer Pattern

**Use Case**: Build status notifications

**Example**:
```typescript
interface BuildObserver {
  onBuildStart(): void
  onBuildComplete(status: string): void
  onBuildError(error: Error): void
}

class BuildNotifier {
  private observers: BuildObserver[] = []

  subscribe(observer: BuildObserver): void {
    this.observers.push(observer)
  }

  notifyComplete(status: string): void {
    this.observers.forEach(o => o.onBuildComplete(status))
  }
}
```

### 3. Chain of Responsibility

**Use Case**: Validation chain

**Example**:
```typescript
abstract class Validator {
  protected next?: Validator

  setNext(validator: Validator): Validator {
    this.next = validator
    return validator
  }

  validate(data: unknown): string[] {
    const errors = this.doValidate(data)
    if (this.next) {
      errors.push(...this.next.validate(data))
    }
    return errors
  }

  protected abstract doValidate(data: unknown): string[]
}

class RequiredFieldsValidator extends Validator {
  protected doValidate(data: unknown): string[] {
    // Check required fields
  }
}
```

### 4. Decorator Pattern

**Use Case**: Logging, retry, caching

**Example**:
```typescript
interface Operation {
  execute(): Promise<void>
}

class LoggingDecorator implements Operation {
  constructor(private operation: Operation) {}

  async execute(): Promise<void> {
    info('Starting operation')
    await this.operation.execute()
    info('Operation complete')
  }
}

class RetryDecorator implements Operation {
  constructor(private operation: Operation) {}

  async execute(): Promise<void> {
    // Retry logic
    await this.operation.execute()
  }
}
```

## SOLID Principles Review

### Single Responsibility

❌ **Violated**: `tools-parameter.ts`, `utility.ts`
✅ **Followed**: Input data models, validators (mostly)

### Open/Closed

✅ **Followed**: GitHub service factory (open for extension)
⚠️  **Could Improve**: Command builders (closed for modification)

### Liskov Substitution

✅ **Followed**: Service implementations properly substitute base

### Interface Segregation

✅ **Followed**: Small focused interfaces (IGithubClientService)
⚠️  **Could Improve**: Some interfaces could be split

### Dependency Inversion

⚠️  **Partial**: Some direct instantiation, some factory usage
💡 **Could Improve**: More dependency injection

## Review Report

```markdown
# Design Patterns Review Report

## Patterns in Use

### ✅ Well Implemented

1. **Factory Pattern** (github-client-service-factory.ts)
   - Clean abstraction
   - Runtime selection
   - Extensible

2. **Strategy Pattern** (service implementations)
   - Multiple implementations
   - Interface-based
   - Proper abstraction

### ⚠️  Needs Improvement

1. **Builder Pattern** (tools-parameter.ts)
   - Not fluent
   - Methods too large
   - Should refactor

### ❌ Missing Patterns

1. **Adapter Pattern** for artifact APIs
2. **Command Pattern** for Bridge operations
3. **Chain of Responsibility** for validation

## Pattern Violations

### Critical

1. **God Object**: tools-parameter.ts
   - Violates SRP
   - Should apply Factory + Builder

### High Priority

2. **Utility Class**: utility.ts
   - Mixed concerns
   - Should split into focused modules

## SOLID Violations

- **SRP**: tools-parameter.ts, utility.ts
- **OCP**: Command building not extensible
- **DIP**: Some tight coupling

## Recommendations

1. **Immediate**:
   - Refactor tools-parameter.ts to use product builders
   - Split utility.ts by concern

2. **Short-term**:
   - Add Adapter for artifact APIs
   - Consider Command pattern for Bridge ops
   - Apply Chain of Responsibility for validation

3. **Long-term**:
   - More dependency injection
   - Consider Observer for notifications
   - Evaluate Decorator for cross-cutting concerns
```

## Best Practices

### When to Use Patterns

✅ **DO use patterns when**:
- You have multiple similar implementations
- Logic needs to be extended without modification
- Complex object creation
- Need to vary algorithm at runtime

❌ **DON'T use patterns when**:
- Simple straightforward code works
- Only one implementation exists
- Pattern adds unnecessary complexity
- Team unfamiliar with pattern

### Pattern Selection Guide

**Creational**:
- Factory: Multiple object types based on input
- Builder: Complex object with many parameters
- Singleton: Truly single instance needed

**Structural**:
- Adapter: Incompatible interfaces
- Decorator: Add behavior dynamically
- Facade: Simplify complex subsystem

**Behavioral**:
- Strategy: Vary algorithm
- Template Method: Common structure, vary steps
- Observer: Event notifications
- Chain of Responsibility: Multiple handlers

## Fix Priority

1. **Critical**: Refactor God objects
2. **High**: Apply missing Adapter pattern
3. **Medium**: Improve Builder implementation
4. **Low**: Consider Observer for events
