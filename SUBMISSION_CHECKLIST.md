# LLD Practice Platform — Verification & Requirements Checklist

| Requirement ID | Description | Source File / Implementation | Automated Test / Verification |
|---|---|---|---|
| **FR1** | Seed at least 5 classic LLD problems with rich requirements and future-requirement prompts | `backend/src/infrastructure/seed/seedProblems.ts` | `tests/api/submissions.test.ts` (`GET /api/problems`) |
| **FR2** | Problem list view with difficulty tags, summary, and action to start an attempt | `src/components/ProblemList.tsx` | UI verification / `ProblemList` render |
| **FR3** | Attempt creation initializes draft state | `backend/src/application/AttemptService.ts` | `tests/api/submissions.test.ts` (`POST /api/attempts`) |
| **FR4** | Structured input for Assumptions & Scope | `src/components/Workspace.tsx` (`assumptions` tab) | UI verification / `AttemptContent` schema |
| **FR5** | Structured input for Classes, Interfaces & Responsibilities | `src/components/Workspace.tsx` (`classesAndResponsibilities` tab) | UI verification / `DeterministicEvaluator.test.ts` |
| **FR6** | Structured input for Relationships & Interactions | `src/components/Workspace.tsx` (`relationships` tab) | UI verification / `DeterministicEvaluator.test.ts` |
| **FR7** | Structured input for Extensibility & Future Requirements | `src/components/Workspace.tsx` (`extensibilityAnswer` tab) | UI verification / `DeterministicEvaluator.test.ts` |
| **FR8** | Auto-save draft capability with debounce | `src/components/Workspace.tsx` (`handleFieldChange` & `PATCH /api/attempts/:id`) | `tests/api/submissions.test.ts` (`PATCH /api/attempts/:id`) |
| **FR9** | Attempt submission freezes immutable Submission snapshot | `backend/src/application/SubmissionService.ts` (`submitAttempt`) | `tests/api/submissions.test.ts` (`POST /api/attempts/:id/submit`) |
| **FR10** | Idempotency: double-submit unchanged attempt returns existing submission | `backend/src/application/SubmissionService.ts` (`computeContentHash`, `findExistingNonFailed`) | `tests/api/submissions.test.ts` (Idempotency test) |
| **FR11** | Submission state machine tracks SUBMITTED &rarr; EVALUATING &rarr; COMPLETED/FAILED | `backend/src/domain/state/SubmissionStateMachine.ts` | `tests/domain/SubmissionStateMachine.test.ts` (9 tests) |
| **FR12** | Evaluation orchestrator runs Deterministic and AI strategies | `backend/src/domain/evaluation/EvaluationOrchestrator.ts` | `tests/domain/EvaluationOrchestrator.test.ts` |
| **FR13** | Deterministic evaluator checks structural completeness without network calls | `backend/src/domain/evaluation/DeterministicEvaluator.ts` | `tests/domain/DeterministicEvaluator.test.ts` (2 tests) |
| **FR14** | Graceful degradation: AI failure resolves to COMPLETED with deterministic feedback | `backend/src/domain/evaluation/EvaluationOrchestrator.ts` | `tests/domain/EvaluationOrchestrator.test.ts` (Graceful fallback test) |
| **FR15** | 7 fixed rubric criteria | `backend/src/domain/evaluation/rubric.ts` (`STANDARD_LLD_RUBRIC`) | `tests/domain/DeterministicEvaluator.test.ts`, `tests/api/submissions.test.ts` |
| **FR16** | Every criterion result contains score, evidence quote, concern, suggestion | `backend/src/domain/entities/Criterion.ts` (`CriterionResult`) | `tests/domain/DeterministicEvaluator.test.ts`, `tests/domain/EvaluationOrchestrator.test.ts` |
| **FR17** | AI evaluation grounds scores in quoted submission text | `backend/src/infrastructure/llm/GeminiClient.ts` | Gemini system instruction & schema definition |
| **FR18** | Evaluation report view displays summary, score meters, evidence quotes, concerns, suggestions | `src/components/FeedbackView.tsx` | UI verification / `FeedbackView` |
| **FR19** | Pluggable evaluator strategy pattern | `backend/src/domain/evaluation/EvaluationStrategy.ts` | Unit tests verify interchangeable strategies |
| **FR20** | Attempt history list showing all submissions, statuses, and scores | `src/components/HistoryView.tsx`, `backend/src/api/routes/history.routes.ts` | `src/components/HistoryView.tsx` |
| **FR21** | Side-by-side progression comparison across iterative attempts | `src/components/HistoryView.tsx` (`startComparison`) | `src/components/HistoryView.tsx` |
| **NFR1** | Domain model purity: no framework imports in domain layer | `backend/src/domain/` (zero express, prisma, or LLM SDK imports) | Validated via `tsc --noEmit` & file audits |
| **NFR2** | Non-blocking async evaluation queue | `backend/src/application/EvaluationQueue.ts` | `tests/api/submissions.test.ts` |
| **NFR3** | Evaluation errors do not crash main process | `backend/src/api/middleware/errorHandler.ts`, `EvaluationQueue.ts` | `tests/domain/EvaluationOrchestrator.test.ts` |
| **NFR4** | Clean, responsive, accessible UI | `src/App.tsx`, `src/components/*` | Tailwind CSS responsive utilities (`sm:`, `md:`, `lg:`) |
