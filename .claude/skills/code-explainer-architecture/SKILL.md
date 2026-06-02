---
name: code-explainer-architecture
description: Analyzes and explains the architecture, module organization, and component relationships of the Black Duck Security Scan codebase. Use when users ask "how does this work", "explain the architecture", or need to understand system structure.
---

# Architecture Explainer

Provides comprehensive architectural analysis of the Black Duck Security Scan GitHub Action codebase.

## Usage

Run this skill when the user asks questions like:
- "Explain how this codebase is organized"
- "What is the architecture of this project?"
- "How do the components interact?"
- "Show me the module structure"
- "How does the data flow through the system?"

## Analysis Steps

### Step 1 — High-Level Architecture Overview

Provide a clear overview of:

1. **Project Type & Purpose**
   - What kind of application is this (GitHub Action, CLI, library, etc.)?
   - What is its primary responsibility?
   - What are the key features?

2. **Entry Points**
   - Main entry point (e.g., src/main.ts)
   - How does execution flow begin?
   - What are the initialization steps?

3. **Core Components**
   - Identify 5-10 major modules/components
   - Explain each component's responsibility
   - Show relationships between components

4. **External Dependencies**
   - Key third-party libraries and their purposes
   - GitHub Actions SDK usage
   - External services/APIs

### Step 2 — Module Organization

Analyze directory structure:

```
src/
├── main.ts                              # Entry point
├── application-constants.ts             # Centralized constants
└── blackduck-security-action/
    ├── inputs.ts                        # Input layer
    ├── validators.ts                    # Validation layer
    ├── bridge-cli.ts                    # CLI orchestration
    ├── tools-parameter.ts               # Command building
    ├── factory/                         # Factory pattern
    ├── service/                         # Service layer
    └── input-data/                      # Data models
```

For each module, explain:
- **Purpose**: What does this module do?
- **Responsibilities**: What are its specific tasks?
- **Dependencies**: What does it depend on?
- **Consumers**: Who uses this module?

### Step 3 — Design Patterns Used

Identify and explain design patterns:

1. **Factory Pattern**
   - Location: `factory/github-client-service-factory.ts`
   - Purpose: Runtime selection between GitHub Cloud vs Enterprise
   - Example usage with file:line references

2. **Builder Pattern**
   - Location: `tools-parameter.ts`
   - Purpose: Constructs complex CLI commands
   - Example usage with file:line references

3. **Strategy Pattern**
   - Location: Service implementations (Cloud vs Enterprise)
   - Purpose: Different SARIF upload strategies
   - Example usage with file:line references

4. **Template Method Pattern**
   - Location: Service base classes
   - Purpose: Common retry logic with customizable implementations
   - Example usage with file:line references

### Step 4 — Data Flow Analysis

Trace how data flows through the system:

1. **Input Collection**
   - How are inputs gathered? (action.yml → inputs.ts)
   - How are environment variables read?
   - How are defaults handled?

2. **Validation**
   - Where does validation occur?
   - What validation strategies are used?
   - How are errors accumulated and reported?

3. **Transformation**
   - How are inputs transformed into CLI commands?
   - How are JSON input files generated?
   - Where does configuration mapping happen?

4. **Execution**
   - How is Bridge CLI downloaded and executed?
   - How are commands constructed?
   - How is output captured?

5. **Output Processing**
   - How are SARIF reports generated?
   - How are artifacts uploaded?
   - How are results reported back to GitHub?

### Step 5 — Key Architectural Decisions

Explain important architectural choices:

1. **Product Abstraction**
   - Why are Polaris, Coverity, Black Duck, SRM handled separately?
   - How is multi-product scanning supported?
   - What are the trade-offs?

2. **Version Compatibility**
   - How does the code handle different Bridge CLI versions?
   - Why is version detection important?
   - Where are version-specific behaviors?

3. **Platform Support**
   - How are different OS platforms handled (Windows, macOS, Linux)?
   - Where is platform-specific logic?
   - How is ARM support implemented?

4. **Error Handling Strategy**
   - Why are exit codes mapped to messages?
   - How are retryable vs non-retryable errors distinguished?
   - What is the error propagation pattern?

5. **Network & Air-Gap Mode**
   - How does air-gap mode work?
   - What are the download vs local install paths?
   - How are proxies and SSL certificates handled?

## Output Format

Provide the analysis as a structured markdown document:

```markdown
# Architecture Analysis: Black Duck Security Scan

## Executive Summary
[2-3 sentence overview of the architecture]

## High-Level Architecture
[Diagram or description of major components and their relationships]

## Component Breakdown

### [Component Name]
- **Location**: `src/path/to/file.ts`
- **Purpose**: [What it does]
- **Key Methods**:
  - `methodName()` (line X): [Description]
- **Dependencies**: [What it uses]
- **Used By**: [Who uses it]

[Repeat for each major component]

## Design Patterns

### [Pattern Name]
- **Where**: `file.ts:line`
- **Why**: [Justification]
- **Example**: [Code snippet or reference]

## Data Flow

1. Input Collection → Validation → Transformation → Execution → Output
2. [Detailed flow with file:line references]

## Key Architectural Decisions

### [Decision Name]
- **Decision**: [What was chosen]
- **Rationale**: [Why]
- **Trade-offs**: [Pros/cons]
- **Implementation**: [Where in code]

## Extension Points

[How to extend the architecture for new features]
```

## Best Practices

- **Use file:line references**: Always include `file.ts:line` for code references
- **Show relationships**: Explain how components interact, not just what they do
- **Identify patterns**: Call out design patterns explicitly
- **Explain trade-offs**: Discuss why architectural choices were made
- **Keep it visual**: Use diagrams or structured formats where helpful
- **Focus on flow**: Show how data/control flows through the system

## Example Questions Answered

- "How does the action download and execute Bridge CLI?"
  → Trace from main.ts → bridge-cli.ts → download-utility.ts → tool-cache-local.ts

- "How are multiple security products supported?"
  → Explain tools-parameter.ts command building for each product

- "How does GitHub integration work?"
  → Explain factory pattern for Cloud vs Enterprise, SARIF upload flow

- "Where is input validation performed?"
  → Show validators.ts → bridge-cli.ts validation chain