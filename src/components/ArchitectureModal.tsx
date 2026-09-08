import { FC } from 'react';
import { X, Layers, Cpu, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-stone-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold">LLD Architecture & Domain-Driven Design (DDD) Specification</h2>
              <p className="text-xs text-stone-400">Formal system architecture, state transitions, and evaluation engine design</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-stone-800 text-xs sm:text-sm leading-relaxed">
          {/* Section 1: DDD Pure Domain Model */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-stone-900 font-semibold text-sm">
              <Cpu className="w-4 h-4 text-amber-600" />
              <span>1. Pure Domain Model (DDD Principle)</span>
            </div>
            <p className="text-stone-600 text-xs">
              The domain layer in <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-900">backend/src/domain/</code> is strictly isolated from infrastructure and web frameworks. It contains pure TypeScript entities, value objects, domain state machines, and repository port interfaces. Zero imports of Express, Prisma, or LLM SDKs in domain files.
            </p>
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 font-mono text-[11px] text-stone-800">
              Attempt (Mutable Workspace Draft) &rarr; [POST /submit] &rarr; Submission (Immutable Frozen Snapshot) &rarr; Evaluation (Evaluator Verdict)
            </div>
          </div>

          {/* Section 2: Finite State Machine */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-stone-900 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>2. State Pattern for Submission Lifecycle</span>
            </div>
            <p className="text-stone-600 text-xs">
              Implemented using the formal GoF State Pattern in <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-900">SubmissionStateMachine.ts</code>. Enforces valid state transitions and explicitly throws <code className="text-rose-700">InvalidStateTransitionError</code> on illegal attempts:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-stone-100 p-3 rounded-xl border border-stone-200">
                <span className="font-semibold text-stone-900">SUBMITTED</span>
                <p className="text-[10px] text-stone-500 mt-1">Snapshot captured, enqueued for worker</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <span className="font-semibold text-amber-900">EVALUATING</span>
                <p className="text-[10px] text-amber-700 mt-1">Active analysis via Deterministic + AI</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="font-semibold text-emerald-900">COMPLETED / FAILED</span>
                <p className="text-[10px] text-emerald-700 mt-1">Terminal states; evaluations persisted</p>
              </div>
            </div>
          </div>

          {/* Section 3: Pluggable Strategy Pattern for Evaluators */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-stone-900 font-semibold text-sm">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>3. Strategy Pattern for Pluggable Evaluators (FR19)</span>
            </div>
            <p className="text-stone-600 text-xs">
              Evaluators implement the common <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-900">EvaluationStrategy</code> interface. Adding a static AST parser, peer-review engine, or alternate LLM requires zero changes to the orchestrator:
            </p>
            <ul className="list-disc list-inside text-xs text-stone-600 space-y-1 pl-1">
              <li><strong className="text-stone-900">DeterministicEvaluator</strong>: Fast, structural rule-based evaluation (class extraction, relationship keywords, completeness).</li>
              <li><strong className="text-stone-900">AIRubricEvaluator</strong>: Calls Google Gemini 3.8 Flash with structured JSON schema adhering to the 7-criterion rubric.</li>
              <li><strong className="text-stone-900">StubAIEvaluator</strong>: Offline mock strategy enabling hermetic testing and zero-setup local development.</li>
            </ul>
          </div>

          {/* Section 4: Graceful Degradation & Resilience (FR14) */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-stone-900 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>4. Graceful Degradation & Non-Blocking Queue (NFR2, FR14)</span>
            </div>
            <p className="text-stone-600 text-xs">
              If the AI service experiences a timeout, rate limit, or network spike, the <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-900">EvaluationOrchestrator</code> catches the error gracefully, resolves the submission with deterministic results, sets <code className="text-amber-800">aiAvailable: false</code>, and marks the submission as <code className="text-emerald-800 font-semibold">COMPLETED</code>. Submissions are NEVER left stuck in EVALUATING!
            </p>
          </div>

          {/* Section 5: Idempotency (FR10) */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-900 text-xs">5. Submission Idempotency (FR10)</div>
            <p className="text-stone-600 text-xs">
              Every submission computes a SHA-256 hash across all 4 content sections. If a learner clicks submit repeatedly on an unchanged attempt, the backend identifies the matching non-failed submission and returns it immediately without duplicating evaluation load.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
