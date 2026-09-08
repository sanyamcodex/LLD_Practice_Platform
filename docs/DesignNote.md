# Low-Level Design Architecture & Evaluation Engine: Design Note

This document details the architectural decisions, domain model, evaluation strategy, change tests, and trade-offs of the Low-Level Design (LLD) Practice & Evaluation Platform.

---

## 1. MVP Summary

The Low-Level Design Practice Platform is an interactive environment for software engineers to practice object-oriented design and receive concrete, evidence-backed evaluation. Rather than accepting arbitrary freeform text with vague feedback, the platform guides the engineer through a 4-section structured artifact:
1. **Assumptions & Scope**: Clarifying constraints, concurrency models, capacity limits, and boundaries.
2. **Core Classes, Interfaces & Responsibilities**: Establishing classes adhering to the Single Responsibility Principle (SRP).
3. **Relationships & Interaction Contracts**: Defining component associations (`has-a`, composition, interfaces) rather than deep inheritance trees.
4. **Extensibility & Future Requirements**: Stress-testing the architecture against explicit future requirements before submission.

---

## 2. End-to-End User Flow

```
+------------------+       +-------------------+       +---------------------+
|   Problem Bank   | ----> |  Design Workspace | ----> | Submission & Hashing|
| (Select Problem) |       | (4-Section Editor)|       | (Deduplication Check)
+------------------+       +-------------------+       +---------------------+
                                                                  |
                                                                  v
+------------------+       +-------------------+       +---------------------+
| Attempt History  | <---- | Individual Report | <---- | Async Orchestrator  |
| (Side-by-Side)   |       | (Scores & Evidence|       | (Deterministic + AI)|
+------------------+       +-------------------+       +---------------------+
```

1. **Problem Discovery**: Learner selects a problem (e.g. Vending Machine, Multi-Floor Parking Lot) from the catalog, inspecting functional requirements, constraints, and future requirement teasers.
2. **Drafting & Persistence**: Learner formulates the design across the 4 sections. The workspace auto-tracks section completion and validates candidate classes.
3. **Submission & Hash Generation**:
   - The platform generates a deterministic SHA-256 hash of the content snapshot (`assumptions`, `classes`, `relationships`, `extensibility`).
   - If an existing non-failed submission with the exact same hash exists for this attempt, it is immediately returned (idempotency/deduplication).
4. **Asynchronous Evaluation Pipeline**:
   - The submission enters the `EVALUATING` state.
   - The UI displays an active polling status screen.
   - The worker queue invokes `EvaluationOrchestrator`.
5. **Evaluation Execution**:
   - Step 1: `DeterministicEvaluator` performs instant structural syntax and keyword audits.
   - Step 2: `AIRubricEvaluator` requests multi-model Gemini analysis with structured JSON schema.
   - Step 3: Evaluations are committed to the repository, and the state transitions to `COMPLETED`.
6. **Detailed Architectural Report**:
   - The learner reviews scores (0–5) across all 7 criteria, accompanied by direct quotes from their submission, architectural concerns, and concrete suggestions.
7. **Attempt History & Progression**:
   - Learner views past attempts and can launch a side-by-side comparison modal to see rubric score deltas and how their architecture evolved.

---

## 3. Domain Model & Class Diagram (Text-Based ASCII)

The system is architected following pure Domain-Driven Design (DDD) principles. The core domain layer has zero dependencies on web frameworks (Express), database drivers (Prisma), or LLM SDKs (Google GenAI).

```
                      +-----------------------------+
                      |         <<Entity>>          |
                      |           Problem           |
                      +-----------------------------+
                      | id: string                  |
                      | title: string               |
                      | difficulty: Difficulty      |
                      | description: string         |
                      | futureRequirements: string[]|
                      +-----------------------------+
                                     ^ 1
                                     |
                                     | has many
                                     | *
                      +-----------------------------+
                      |         <<Entity>>          |
                      |           Attempt           |
                      +-----------------------------+
                      | id: string                  |
                      | learnerId: string           |
                      | problemId: string           |
                      | content: AttemptContent     |
                      | createdAt: string           |
                      | updatedAt: string           |
                      +-----------------------------+
                                     ^ 1
                                     |
                                     | has many
                                     | *
                      +-----------------------------+
                      |         <<Entity>>          |
                      |         Submission          |
                      +-----------------------------+
                      | id: string                  |
                      | attemptId: string           |
                      | status: SubmissionStatus    |
                      | contentHash: string         |
                      | contentSnapshot: Content    |
                      | createdAt: string           |
                      | completedAt?: string        |
                      +-----------------------------+
                                     | 1
                                     |
                                     | evaluated by
                                     | *
                      +-----------------------------+
                      |         <<Entity>>          |
                      |         Evaluation          |
                      +-----------------------------+
                      | id: string                  |
                      | submissionId: string        |
                      | evaluatorType: EvaluatorType|  <-- DETERMINISTIC | AI
                      | rubricResults: RubricResult[]
                      | overallSummary: string      |
                      | createdAt: string           |
                      | metadata?: Record<string,any|
                      +-----------------------------+


              ================ STRATEGY PATTERN ================

                      +-----------------------------+
                      |        <<Interface>>        |
                      |     EvaluationStrategy      |
                      +-----------------------------+
                      | evaluate(submission,problem)|
                      +-----------------------------+
                                     ^
                                     |
            +------------------------+------------------------+
            |                                                 |
+--------------------------+                      +--------------------------+
|  DeterministicEvaluator  |                      |    AIRubricEvaluator     |
+--------------------------+                      +--------------------------+
| evaluate(...)            |                      | - llmClient: LLMClient   |
| - regex parsing          |                      | - timeoutMs: number      |
| - class extraction       |                      +--------------------------+
| - structural audit       |                      | evaluate(...)            |
+--------------------------+                      +--------------------------+


              ============= FINITE STATE MACHINE =============

                      +-----------------------------+
                      |   SubmissionStateMachine    |
                      +-----------------------------+
                      | validateTransition(from, to)|
                      | canTransition(from, to)     |
                      +-----------------------------+
                         
        [SUBMITTED] --------> [EVALUATING] --------> [COMPLETED]
                                    |
                                    +--------------> [FAILED]


              ============ ORCHESTRATION & PORTS ============

+--------------------------------------------------------------------------+
|                          EvaluationOrchestrator                          |
+--------------------------------------------------------------------------+
| - deterministicEvaluator: EvaluationStrategy                             |
| - aiEvaluator?: EvaluationStrategy                                       |
| - evaluationRepo: EvaluationRepository (Port)                            |
| - submissionRepo: SubmissionRepository (Port)                            |
+--------------------------------------------------------------------------+
| + evaluateSubmission(submissionId, problem, content): Promise<Feedback>  |
+--------------------------------------------------------------------------+
```

---

## 4. Evaluation Strategy: Dual-Engine Architecture

### Deterministic-First (Guaranteed Baseline)
- Runs locally in milliseconds with zero network dependencies.
- Inspects sections for mandatory completeness (Assumptions, Classes, Relationships, Extensibility).
- Parses candidate PascalCase classes and interface declarations.
- Checks relationship syntax (`has-a`, `composition`, `implements`, `extends`).
- Detects standard Gang-of-Four (GoF) design pattern terminology (`State`, `Strategy`, `Observer`, `Factory`, `Decorator`, `Facade`).
- Establishes a concrete floor score and baseline feedback.

### AI Best-Effort (Semantic Grounding & Rubric Scoring)
- Dispatched asynchronously to Gemini using a strict JSON schema contract.
- Scores all 7 standardized criteria:
  1. `requirement_understanding`: Validates realistic assumptions and boundary handling.
  2. `class_responsibilities`: Assesses single responsibility and domain boundary adherence.
  3. `coupling_cohesion`: Checks if components communicate via abstractions rather than concrete coupling.
  4. `encapsulation_interfaces`: Inspects visibility, state encapsulation, and interface contracts.
  5. `abstraction_pattern_use`: Assesses appropriate application of design patterns.
  6. `extensibility`: Evaluates design against the problem's stated future requirements.
  7. `explanation_quality`: Evaluates trade-off articulation and rationale clarity.
- Every criterion score requires:
  - `score` (0–5 integer)
  - `evidence` (mandatory exact quotation from the candidate's artifact)
  - `concern` (specific architectural risk or flaw)
  - `suggestion` (concrete, actionable refactoring path)

### Resilience & Fallback Protocol (FR14)
If Gemini encounters transient outages (e.g. 503 high demand or quota limits):
1. **Multi-Model Fallback**: Automatically tries `gemini-3.8-flash` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.1-flash-lite`.
2. **Exponential Backoff**: Brief retry before cascading models.
3. **Graceful Degradation**: If all candidate models fail or timeout, the orchestrator logs the fallback, preserves the deterministic structural evaluation, and safely transitions the submission to `COMPLETED`.
4. **Self-Healing UI**: The report page labels the state as a Deterministic Structural Audit and provides a one-click **"Retry AI Analysis"** button to re-trigger semantic evaluation once services recover.

---

## 5. Change Test Solutions

A core requirement of robust Low-Level Design is the Open-Closed Principle: modules should be open for extension, but closed for modification. Here is how the reference architectures absorb major requirement changes.

### Change Test A: Payment Methods Extension (NFC, QR Code, External Gateways & Timeouts)

**Scenario**: A Vending Machine or Parking Lot system originally supporting Cash and Credit Card must now support UPI/QR code and Contactless NFC, along with handling external payment gateway timeouts.

**Architectural Solution**:
1. **Interface Contract**:
   ```typescript
   interface PaymentMethod {
     initiatePayment(amount: Money, context: PaymentContext): Promise<PaymentResult>;
     cancelPayment(transactionId: string): Promise<void>;
   }
   ```
2. **Decoupled Implementations**:
   - `CashPaymentMethod`: Handles physical bill/coin validation and escrow.
   - `CardPaymentMethod`: Communicates with EMV chip reader.
   - `NFCPaymentMethod`: Listens on near-field RF scanner.
   - `QRPaymentMethod`: Dynamically requests a payment intent URI from a gateway, generates a QR code string for the display screen, and polls/subscribes to webhook confirmation.
3. **Gateway Timeout Handling via Decorator/Resilience Layer**:
   - Wrap payment calls in a `ResilientPaymentGateway` implementing the Circuit Breaker and Timeout patterns.
   - If an external call times out beyond the SLA (e.g., 10s), the gateway triggers an automated cancellation token, transitions the vending machine state back to `SelectionState` (or prompts for cash), and returns items safely from escrow.
4. **Open-Closed Compliance**: The core `VendingMachine` context and `PaymentState` require **zero modifications**. New payment mechanisms simply implement `PaymentMethod` and are registered with the `PaymentStrategyFactory`.

---

### Change Test B: Combo & Basket Extension (Bundles & Dynamic Discounts)

**Scenario**: A Vending Machine or Retail System must support product bundles (e.g. "Soda + Chips = $0.50 discount") or promotional percentage discounts without altering core inventory tracking.

**Architectural Solution**:
1. **Composite Pattern for Purchasables**:
   ```typescript
   interface IPurchasable {
     getId(): string;
     getName(): string;
     getBasePrice(): Money;
     getSlots(): SlotId[];
   }

   class SingleItem implements IPurchasable { ... }

   class ComboBundle implements IPurchasable {
     private items: IPurchasable[];
     private bundleDiscount: DiscountStrategy;
     ...
   }
   ```
2. **Strategy Pattern for Pricing & Discounts**:
   ```typescript
   interface DiscountStrategy {
     applyDiscount(items: IPurchasable[], originalTotal: Money): Money;
   }

   class BundleFixedDiscountStrategy implements DiscountStrategy { ... }
   class TimeBasedHappyHourStrategy implements DiscountStrategy { ... }
   ```
3. **Inventory Decoupling**:
   - Dispensing remains physical: when `ComboBundle.dispense()` is invoked, it delegates to the individual slot actuators for each contained item.
   - Inventory tracking operates at the physical slot level; pricing rules operate at the `PricingEngine` calculation level.
4. **Open-Closed Compliance**: Introducing complex multi-item promotions or dynamic flash sales requires no changes to `Inventory` or `Dispenser` classes.

---

## 6. Trade-Offs Made Under the 2-Day Constraint

1. **Storage Adapter (In-Memory / File vs. Managed Cloud Postgres)**:
   - *Choice*: Implemented a clean Repository Pattern with pluggable adapters. For the AI Studio interactive preview container, local JSON/file persistence was standardized, with Prisma schema available for external PostgreSQL connection strings.
   - *Trade-Off*: Zero configuration required for instant evaluator review, while providing full database migration parity for enterprise deployments.
2. **In-Process Worker Queue vs. Distributed Broker (Redis/RabbitMQ)**:
   - *Choice*: Used an in-process asynchronous task queue (`EvaluationQueue`) with non-blocking event loops.
   - *Trade-Off*: Avoided external service dependencies and network setup overhead during the prototype phase; suitable for single-node instances, cleanly swappable via queue interfaces for multi-node deployments.
3. **Standardized Rubric vs. Freeform LLM Feedback**:
   - *Choice*: Enforced 7 rigid criteria with required evidence quotation and strict JSON schema parsing.
   - *Trade-Off*: Reduced prompt variance and eliminated LLM hallucinations; ensured every submission is graded objectively and predictably.
