# LLD Practice Platform — System Architecture & Design Document

## 1. System Overview
The **LLD Practice Platform** is a professional-grade learning and assessment system for Low-Level Design (object-oriented design). It enables software engineers to practice designing complex object-oriented systems (such as multi-floor parking lots, intelligent elevator banks, and expense sharing networks) and receive actionable, evidence-grounded feedback across a fixed 7-criterion architectural rubric.

---

## 2. Domain-Driven Design (DDD) & Domain Purity
The domain layer (`backend/src/domain/`) is strictly isolated from infrastructure, databases, HTTP frameworks, and LLM SDKs:
- **Zero Framework Leakage**: No imports of Express, Prisma, or `@google/genai` inside domain entities, state machines, or evaluation interfaces.
- **Hexagonal Architecture (Ports & Adapters)**:
  - **Ports**: `ProblemRepository`, `AttemptRepository`, `SubmissionRepository`, `EvaluationRepository`, `LLMClient`, and `EvaluationStrategy`.
  - **Adapters**: `PrismaProblemRepository`, `PrismaAttemptRepository`, `PrismaSubmissionRepository`, `PrismaEvaluationRepository`, and `GeminiClient`.

### Separation of Attempt vs. Submission (Snapshot Immutability)
- **`Attempt` (Mutable Workspace Draft)**: Represents the ongoing design session where the user writes and edits assumptions, classes, relationships, and extensibility answers. Updated continuously via auto-save (`PATCH /api/attempts/:id`).
- **`Submission` (Immutable Frozen Snapshot)**: Created when the user clicks "Submit". Freezes an exact copy (`contentSnapshot`) of the design artifact at that timestamp. This guarantees that background evaluations are performed against a reproducible, non-mutating version, and supports comparing historical submissions side-by-side.

---

## 3. Finite State Machine (State Pattern)
The submission lifecycle is governed by the GoF State Pattern in `SubmissionStateMachine.ts`:

```
                 [submitAttempt]
                       │
                       ▼
                 ┌───────────┐
                 │ SUBMITTED │
                 └─────┬─────┘
                       │ [Orchestrator picks up]
                       ▼
                 ┌───────────┐
                 │EVALUATING │
                 └─────┬─────┘
           ┌───────────┴───────────┐
[Success / Graceful]          [Fatal Queue Failure]
           │                               │
           ▼                               ▼
     ┌───────────┐                   ┌───────────┐
     │ COMPLETED │                   │  FAILED   │
     └───────────┘                   └───────────┘
```

- **Valid Transitions**:
  - `SUBMITTED` &rarr; `EVALUATING`
  - `EVALUATING` &rarr; `COMPLETED`
  - `EVALUATING` &rarr; `FAILED`
- **Illegal Transitions**: Attempting invalid state jumps (e.g. `SUBMITTED` &rarr; `COMPLETED`, `COMPLETED` &rarr; `EVALUATING`) throws a custom `InvalidStateTransitionError`.

---

## 4. Evaluator Architecture (Strategy Pattern — FR19)
The platform uses the **Strategy Pattern** for evaluation:
- All evaluators implement `EvaluationStrategy`:
  - `DeterministicEvaluator`: Analyzes structural completeness, PascalCase class extraction, relationship semantics, and extensibility coverage without external dependencies.
  - `AIRubricEvaluator`: Calls Google Gemini 3.8 Flash with structured JSON schema adhering to the 7 fixed criteria, enforcing that every score is backed by quoted evidence.
  - `StubAIEvaluator`: Local, offline evaluator for testing and hermetic development.

### Evaluation Sequence & Non-Blocking Worker
1. Client issues `POST /api/attempts/:id/submit`.
2. `SubmissionService` performs an **Idempotency Check (FR10)**: computes a SHA-256 hash of the content snapshot. If a non-failed submission with the same hash exists for this attempt, it returns the existing submission without duplicating evaluation.
3. If new, creates a `Submission` with status `SUBMITTED`, saves it, and enqueues into `EvaluationQueue`.
4. The HTTP response returns immediately with `200 OK` (NFR2).
5. The in-process `EvaluationQueue` worker picks up the job:
   - Sets status to `EVALUATING`.
   - Runs `DeterministicEvaluator` (always).
   - Runs `AIRubricEvaluator` (best effort).
   - If AI evaluation times out or encounters network limits, the orchestrator catches the error, sets `aiAvailable: false`, preserves deterministic findings, and transitions the submission to `COMPLETED` (**FR14: Graceful Degradation — Submissions never get stuck!**).

---

## 5. The 7 Fixed Rubric Criteria
1. **Requirement Understanding & Scope**: Functional boundaries, operational constraints, explicit assumptions.
2. **Class Responsibilities & SRP**: Single Responsibility Principle, absence of monolithic God classes.
3. **Coupling & Cohesion**: Composition over inheritance, high cohesion, clean inter-module boundaries.
4. **Encapsulation & Interfaces**: Programming to interfaces, contract-driven architecture.
5. **Abstraction & Design Pattern Selection**: Standard GoF patterns (Strategy, State, Observer, Factory) solving genuine requirements.
6. **Extensibility & Future Requirements**: Open-Closed Principle test against stated future requirement additions.
7. **Architectural Rationale & Trade-off Articulation**: Clarity of trade-offs (latency vs memory, simplicity vs flexibility).

---

## 6. Test Coverage
- `tests/domain/SubmissionStateMachine.test.ts`: 9 unit tests verifying all legal and illegal state transitions.
- `tests/domain/DeterministicEvaluator.test.ts`: 2 unit tests verifying structural audits for both empty and rich designs.
- `tests/domain/EvaluationOrchestrator.test.ts`: 2 unit tests verifying the critical FR14 graceful degradation fallback and full happy-path.
- `tests/api/submissions.test.ts`: 5 integration tests verifying healthcheck, problem seeding, end-to-end attempt-to-evaluation flow, FR10 idempotency deduplication, and 404 AppError handling.
