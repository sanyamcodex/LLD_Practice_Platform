# Low-Level Design (LLD) Practice & Architectural Evaluation Platform

A full-stack, domain-driven educational application designed to help software engineers master Object-Oriented Low-Level Design (LLD). Engineers practice modeling complex systems, formalizing assumptions, defining class hierarchies and design patterns, and stress-testing their designs against unannounced future requirements. Every submission is evaluated against a standardized 7-criterion rubric using a dual-engine architecture combining structural deterministic audits with evidence-grounded AI semantic analysis.

---

## Key Features

- **Curated LLD Problem Bank**: Realistic system design challenges (Multi-Floor Parking Lot, State-Machine Vending Machine, Elevator Dispatcher, etc.) with explicit constraints, concurrency requirements, and future requirement hooks.
- **Structured 4-Section Design Workspace**: Enforces clear architectural decomposition across:
  1. Assumptions, Concurrency & Scope
  2. Core Classes, Interfaces & Responsibilities (SRP)
  3. Relationships & Interaction Contracts (Composition over Inheritance)
  4. Extensibility & Future Requirements Strategy (Open-Closed Principle)
- **Dual-Engine Evaluation Orchestrator (FR14)**:
  - **Deterministic Structural Audit**: Instantly parses candidate classes, verifies relationship semantics (`has-a`, `implements`, composition), detects design pattern keywords, and ensures section completeness with guaranteed execution.
  - **Evidence-Grounded AI Semantic Evaluator**: Powered by Gemini (`@google/genai`) using structured JSON schema output to score 7 distinct architectural criteria (0–5), citing direct quotations from the learner's design, highlighting specific architectural concerns, and offering actionable suggestions.
  - **Graceful Degradation & Resilience**: Automatic exponential backoff retries and multi-model fallback (`gemini-3.8-flash` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.1-flash-lite`). If AI services encounter transient outages, deterministic feedback is preserved and the user can re-trigger AI evaluation with one click.
- **Unified Attempt History & Side-by-Side Comparison**:
  - Review immutable submission snapshots and final scores.
  - Compare two attempts side-by-side with criterion-by-criterion delta visualizers to track architectural iteration over time.
- **Strict Domain-Driven Design (DDD)**:
  - Formal domain entities (`Problem`, `Attempt`, `Submission`, `Evaluation`, `Feedback`).
  - Finite state machine (`SubmissionStateMachine`) enforcing valid lifecycle transitions (`DRAFT` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SUBMITTED` $\rightarrow$ `EVALUATING` $\rightarrow$ `COMPLETED` / `FAILED`).
  - Strict repository port interfaces isolating business logic from external frameworks, databases, and LLM SDKs.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Backend**: Node.js (v20+), Express, TypeScript, `tsx`
- **Domain & Architecture**: Domain-Driven Design (DDD), Strategy Pattern, Finite State Machine, Repository Pattern
- **Evaluation**: Gemini 2.5/3.x SDK (`@google/genai`), Regex-based Structural Evaluator
- **Testing**: Vitest, Supertest (19 comprehensive unit & integration tests)
- **Data Layer**: Abstracted Repository Pattern with persistent storage adapter

---

## Prerequisites

- **Node.js**: Version 18.x or 20.x or higher
- **npm**: Version 9.x or higher
- **Gemini API Key**: A valid Google Gemini API key (obtainable from [Google AI Studio](https://aistudio.google.com/))

---

## Setup & Running Locally

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd lld-practice-platform
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your configuration:
```env
DATABASE_URL=
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
```
> **Note**: `.env` is ignored by Git in `.gitignore`. Never commit API keys to version control.

### 3. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`, automatically seeding the curated problem bank on first launch. Open `http://localhost:3000` in your browser.

### 4. Run Automated Test Suite
Run the test suite containing domain state machine tests, deterministic evaluation tests, orchestrator fallback tests, and end-to-end API lifecycle integration tests:
```bash
npm test
```

### 5. Production Build
```bash
npm run build
npm start
```

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── api/                     # Express route controllers & middleware
│   │   │   ├── middleware/          # AppError & centralized error handling
│   │   │   └── routes/              # problems, attempts, submissions, history
│   │   ├── application/             # Application Services & Orchestrators
│   │   │   ├── AttemptService.ts
│   │   │   ├── EvaluationQueue.ts   # In-process asynchronous evaluation pipeline
│   │   │   ├── ProblemService.ts
│   │   │   └── SubmissionService.ts # Hash deduplication, lifecycle, status resolution
│   │   ├── config/                  # Environment configuration
│   │   ├── domain/                  # Pure Domain Core (Zero external dependencies)
│   │   │   ├── entities/            # Problem, Attempt, Submission, Evaluation, Feedback
│   │   │   ├── evaluation/          # Strategy Pattern: Deterministic, AI, Stub evaluators
│   │   │   │   ├── DeterministicEvaluator.ts
│   │   │   │   ├── AIRubricEvaluator.ts
│   │   │   │   ├── EvaluationOrchestrator.ts
│   │   │   │   ├── SubmissionStateMachine.ts
│   │   │   │   └── rubric.ts        # 7-criterion standardized LLD rubric
│   │   │   └── ports/               # Repository interfaces (Inversion of Control)
│   │   └── infrastructure/          # Infrastructure Adapters & External Clients
│   │       ├── llm/GeminiClient.ts  # Multi-model fallback, retry backoff, JSON schema
│   │       ├── repositories/        # Storage repository implementations
│   │       └── seed/seedProblems.ts # Curated problem bank seeder
├── docs/
│   ├── DesignNote.md                # Domain model, class diagrams, change test answers
│   └── ResearchNote.md              # Research template and problem context
├── src/                             # React 18 Frontend
│   ├── components/                  # ProblemList, Workspace, FeedbackView, HistoryView
│   ├── services/api.ts              # Frontend API client
│   ├── types.ts                     # Shared TypeScript types
│   ├── App.tsx                      # Root application layout and navigation
│   └── main.tsx                     # Entry point
├── tests/                           # Vitest Unit & Integration test suites
├── server.ts                        # Application bootstrap, Express setup, Vite middleware
├── AI_USAGE.md                      # Log of architectural decisions & agent interactions
└── metadata.json                    # Application metadata
```

---

## Known Limitations & Production Next Steps

1. **Evaluation Queue Scale**: The current implementation utilizes an in-process asynchronous evaluation queue suited for single-server and prototype deployments. In high-volume multi-node production clusters, replace `EvaluationQueue` with Redis BullMQ or Google Cloud Tasks.
2. **Multi-User Authentication**: The current prototype identifies learners via a flexible `learnerId` parameter (`learner_default`). In production, integrate Firebase Auth or Google Identity Services session tokens into `createBackendApp`.
3. **LLM Demand Spikes**: Upstream Gemini API availability is subject to quota spikes. The application includes automatic model cascading and exponential backoff, backed by verified structural evaluation so learners never lose progress.
