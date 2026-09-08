# AI Usage & Architectural Decision Record

This document records key architectural, algorithmic, and engineering decisions made during development, detailing AI suggestions, decisions accepted/rejected, and technical rationales.

---

## Decision 1: Strategy Pattern for Pluggable Evaluators

### What Was Suggested
The AI assistant initially proposed handling all evaluation logic in a single monolithic service class with conditional checks (`if (useAI) { ... } else { ... }`), or alternatively creating completely separate endpoints and pipelines for deterministic audits versus AI reviews.

### What Was Accepted / Rejected
- **Rejected**: Monolithic procedural evaluation method with branching flags.
- **Accepted**: A formalized **Strategy Pattern** with an explicit domain interface (`EvaluationStrategy`) implemented by:
  1. `DeterministicEvaluator`: Zero-dependency, regex-based structural audit.
  2. `AIRubricEvaluator`: LLM-backed semantic evaluation using Gemini JSON schema.
  3. `StubAIEvaluator`: Offline hermetic test strategy.
  Coordinated by an `EvaluationOrchestrator`.

### Why
- **Adherence to Open-Closed Principle**: Allows introducing new specialized evaluators (e.g. static TypeScript compiler evaluator, Mermaid class diagram parser, or AST validator) without modifying the orchestration lifecycle.
- **Testability & Hermetic Isolation**: Unit tests can inject mock or stub strategies without touching network or SDK code.
- **Dual-Engine Execution**: Enables running deterministic audits immediately while awaiting asynchronous AI evaluation, providing instant feedback and graceful degradation.

---

## Decision 2: Storage Persistence Strategy & DATABASE_URL Configuration

### What Was Suggested
The AI assistant suggested defaulting to local file-based SQLite (`file:./dev.db`) in `.env.example` as the primary configuration for ease of local prototyping.

### What Was Accepted / Rejected
- **Rejected**: Relying purely on local SQLite as the only supported storage mechanism in deployment.
- **Accepted**: 
  - Maintained a clean **Repository Pattern** interface abstraction (`AttemptRepository`, `SubmissionRepository`, `EvaluationRepository`, `ProblemRepository`) decoupling the domain from the underlying database driver.
  - Provided a production-ready Prisma schema configured for PostgreSQL (`postgresql://...`), with instructions for connecting hosted Postgres (e.g. Neon, Supabase, Cloud SQL) in `.env` to prevent data loss across ephemeral container restarts.
  - Implemented an in-memory/JSON filesystem storage fallback for the interactive local dev preview so that the applet operates with zero blocking configuration hurdles.

### Why
- **Ephemeral Sandbox Constraints**: Cloud Run and AI Studio container filesystems are ephemeral; storing relational data in local SQLite files without mounted persistent volumes results in data being wiped when containers restart.
- **Decoupled Architecture**: By writing all application and domain services against port interfaces, the storage tier can swap between hosted PostgreSQL and local preview storage without touching business logic or state machine code.

---

## Decision 3: Error Surfacing, Cascading Fallbacks & Exponential Backoff in GeminiClient

### What Was Suggested
Initially, when the Gemini API returned an error (such as a transient `503 Service Unavailable` or rate limit quota exhaustion), the client caught the error and silently returned a generic fallback object or string without exposing the underlying failure, resulting in silent failures and confusing downstream status.

### What Was Accepted / Rejected
- **Rejected**: Silently swallowing API errors or returning fake mock scores as if they were genuine Gemini evaluations.
- **Accepted**:
  - Implemented explicit error detection and proper error bubbling.
  - Added a **multi-model cascading fallback** in `GeminiClient` (`gemini-3.8-flash` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.1-flash-lite`).
  - Added exponential backoff retry for transient error codes (`503`, `429`, `UNAVAILABLE`, `RESOURCE_EXHAUSTED`).
  - Updated `EvaluationOrchestrator` to catch definitive failures, log the incident, and gracefully complete the submission with the verified deterministic evaluation preserved.
  - Added a dedicated `POST /api/submissions/:id/reevaluate` endpoint and a **"Retry AI Analysis"** button in the UI.

### Why
- **Observability**: Developers and learners need to know whether their score came from full semantic AI analysis or deterministic structural fallback.
- **System Resilience**: Temporary upstream demand surges should not crash the evaluation pipeline or leave submissions stuck in `EVALUATING` forever.
- **Learner Trust**: Transparently identifying "Deterministic Structural Audit" versus "Gemini 3.8 Flash Evaluated" maintains grading credibility.

---

## Decision 4: History-List Race Condition & Evaluation Source-of-Truth Synchronization

### What Was Suggested
When the Attempt History list showed stale `(DETERMINISTIC)` scores and timestamps that did not match the individual Evaluation Report view, it was suggested to simply update the frontend display to search for any AI evaluation in the array or hardcode a status check.

### What Was Accepted / Rejected
- **Rejected**: Quick frontend patch that masks the underlying discrepancy by picking array indices.
- **Accepted**:
  - Unified the source-of-truth across the entire application by modifying `backend/src/api/routes/history.routes.ts` to call `SubmissionService.getSubmissionStatus` for every completed submission.
  - Attached the identical, authoritative `feedback` object (including `combinedResults`, `aiAvailable`, and `overallSummary`) to each history item.
  - Implemented `resolveHistoryEvaluation` in `HistoryView.tsx` to mirror the exact resolution algorithm used in `FeedbackView.tsx`, including identical evaluator badges and `completedAt` timestamps.

### Why
- **Data Integrity**: An attempt must show the exact same score, evaluator badge, and completion timestamp on the summary dashboard as it does on the individual report page.
- **Elimination of UI Drift**: Centralizing the resolution logic on the backend eliminates discrepancies between the history table, side-by-side progression comparator, and evaluation report view.
