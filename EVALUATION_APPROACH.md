# LLD Practice Platform — Evaluation Approach & Rubric Philosophy

## 1. Why 7 Fixed Criteria?
Standard engineering evaluations often produce vague feedback like "looks good" or "could be better organized." To provide rigorous, reproducible, and educational assessments, the platform adopts 7 fixed architectural dimensions derived from senior software engineering benchmarks:

1. **Requirement Understanding & Scope**: Measures how well the engineer defines boundaries and assumptions (scale, concurrency, statefulness) before coding.
2. **Class Responsibilities & SRP**: Validates whether classes have single, clear reasons to change, preventing the classic "God Object" anti-pattern.
3. **Coupling & Cohesion**: Checks whether modules are loosely coupled through interfaces and whether classes exhibit high internal cohesion.
4. **Encapsulation & Interfaces**: Tests whether internal representations are hidden behind well-defined abstractions.
5. **Abstraction & Design Pattern Selection**: Assesses whether design patterns (Strategy, Factory, State, Observer) are applied judiciously rather than superficially.
6. **Extensibility & Future Requirements**: Directly tests the Open-Closed Principle (OCP) against unannounced future additions.
7. **Architectural Rationale & Trade-off Articulation**: Evaluates the engineer's ability to explain *why* a particular decision was made and what compromises were accepted.

---

## 2. Hybrid Dual-Engine Strategy
The platform combines two distinct evaluation strategies under a unified interface:

### A. Deterministic Evaluator (Structural Layer)
- **Execution**: Fast, zero-dependency, local.
- **Verification**:
  - Validates that all 4 mandatory sections exist.
  - Extracts candidate classes and interfaces using regex PascalCase pattern matching.
  - Detects relationship keywords (`composition`, `aggregation`, `implements`, `1:N`).
  - Checks whether the stated future requirements were acknowledged in the extensibility section.
- **Role**: Guarantees a baseline structural audit even in offline environments or during AI service interruptions.

### B. AI Rubric Evaluator (Semantic Layer via Gemini 3.8 Flash)
- **Execution**: Asynchronous server-side call using official `@google/genai` SDK.
- **Structured Schema**: Uses `responseMimeType: "application/json"` with an explicit JSON schema enforcing typed fields: `score`, `evidence`, `concern`, `suggestion`, `confidence`.
- **Evidence-Based Grounding**: The system prompt strictly requires that every criterion score cite a direct quote or concrete citation from the candidate's submission. If an element is absent, the evaluator explicitly reports that absence as the justification.

---

## 3. Resilience & Graceful Degradation (FR14)
- Network spikes, rate limits, or API outages must never compromise user experience.
- The `EvaluationOrchestrator` implements a strict fallback:
  - If the AI evaluator times out or throws an error, the orchestrator preserves the deterministic structural evaluation, flags `aiAvailable: false`, records a clear explanatory fallback message, and transitions the submission to `COMPLETED`.
  - Submissions **never** remain stuck in an `EVALUATING` state.
