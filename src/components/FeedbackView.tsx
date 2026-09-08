import { FC } from 'react';
import { Submission, Feedback, Problem, CriterionResult } from '../types';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Quote,
  RotateCcw,
  ArrowLeft,
  Clock,
  Layers,
  Scale,
} from 'lucide-react';

interface FeedbackViewProps {
  problem: Problem;
  submission: Submission;
  feedback: Feedback | null;
  onReAttempt: (previousContent: any) => void;
  onBackToCatalog: () => void;
  onViewHistory: () => void;
  onReevaluate?: () => void;
}

const CRITERION_METADATA: Record<string, { label: string; desc: string }> = {
  requirement_understanding: {
    label: '1. Requirement Understanding & Scoping',
    desc: 'Functional boundaries, explicit assumptions, scale, and operational constraints.',
  },
  class_responsibilities: {
    label: '2. Class Responsibilities & Single Responsibility (SRP)',
    desc: 'Decomposition into focused entities, absence of monolithic God classes.',
  },
  coupling_cohesion: {
    label: '3. Coupling & Cohesion',
    desc: 'Appropriate relationship semantics (composition over inheritance), low inter-module coupling.',
  },
  encapsulation_interfaces: {
    label: '4. Encapsulation & Interface Design',
    desc: 'Programming to interfaces, hiding internal state, clear public contracts.',
  },
  abstraction_pattern_use: {
    label: '5. Abstraction & Design Pattern Selection',
    desc: 'Judicious application of standard patterns (Strategy, State, Factory, Observer) solving real variation.',
  },
  extensibility: {
    label: '6. Extensibility & Future Requirements (Open-Closed)',
    desc: 'Response to unannounced future requirements without modifying core system entities.',
  },
  explanation_quality: {
    label: '7. Architectural Rationale & Trade-off Articulation',
    desc: 'Depth of reasoning, justification of compromises (memory vs latency, simplicity vs flexibility).',
  },
};

export const FeedbackView: FC<FeedbackViewProps> = ({
  problem,
  submission,
  feedback,
  onReAttempt,
  onBackToCatalog,
  onViewHistory,
  onReevaluate,
}) => {
  // If still evaluating, display animated evaluation status
  if (submission.status === 'SUBMITTED' || submission.status === 'EVALUATING') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm animate-pulse">
          <Layers className="w-8 h-8 animate-bounce" />
        </div>
        <div className="space-y-2">
          <span className="text-xs uppercase font-bold tracking-widest text-amber-600 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
            Status: {submission.status}
          </span>
          <h2 className="text-2xl font-semibold text-stone-900 tracking-tight">
            Architectural Evaluation in Progress
          </h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            Your design artifact is being analyzed through our structural deterministic audit and 7-criterion rubric engine.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs text-stone-600 space-y-2">
          <div className="flex items-center space-x-2 text-stone-800 font-medium">
            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
            <span>Active Worker Pipeline:</span>
          </div>
          <div className="text-left space-y-1 text-stone-500">
            <div>&bull; Step 1: Structural completeness & class extraction (Deterministic)</div>
            <div>&bull; Step 2: Semantic grounding & extensibility analysis</div>
            <div>&bull; Step 3: Synthesis against 7 fixed architectural dimensions</div>
          </div>
        </div>
      </div>
    );
  }

  const results = feedback?.combinedResults || [];
  const averageScore = results.length > 0
    ? (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)
    : '0.0';

  const isAi = feedback?.aiAvailable;

  const getScoreBadge = (score: number) => {
    if (score >= 4) {
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        label: `${score}/5 - Solid / Strong`,
      };
    }
    if (score >= 2) {
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        label: `${score}/5 - Moderate / Refinement Needed`,
      };
    }
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      label: `${score}/5 - High Vulnerability / Incomplete`,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={onBackToCatalog}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Problem Catalog</span>
          </button>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
              Evaluation & Architectural Rubric Report
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                isAi
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              {isAi ? 'Gemini 3.8 Flash Evaluated' : 'Deterministic Structural Audit'}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Problem: <span className="font-medium text-stone-700">{problem.title}</span> &bull; Completed:{' '}
            {submission.completedAt ? new Date(submission.completedAt).toLocaleTimeString() : 'Just now'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="view-history-btn"
            onClick={onViewHistory}
            className="text-xs font-medium px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
          >
            Compare History
          </button>

          <button
            id="reattempt-btn"
            onClick={() => onReAttempt(submission.contentSnapshot)}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Revise & Re-Attempt</span>
          </button>
        </div>
      </div>

      {/* Evaluation Mode / Graceful Notice */}
      {!isAi && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Deterministic Structural Engine Output Preserved</p>
              <p className="text-amber-800 leading-relaxed">
                Your submission completed successfully through our verified structural evaluator (FR14). Class extraction, relationship semantics, completeness, and extensibility coverage were audited.
              </p>
            </div>
          </div>
          {onReevaluate && (
            <button
              onClick={onReevaluate}
              className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-medium transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Retry AI Analysis</span>
            </button>
          )}
        </div>
      )}

      {/* Executive Summary Card & Score Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Synthesis (8 cols) */}
        <div className="lg:col-span-8 bg-stone-900 text-stone-100 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>Architectural Synthesis</span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-stone-200">
              {feedback?.overallSummary || 'Evaluation complete across all rubric dimensions.'}
            </p>
          </div>

          <div className="pt-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <span>Evaluated against 7 fixed architectural dimensions</span>
            <span className="font-mono text-amber-400">Immutable Snapshot ID: {submission.id.slice(0, 12)}</span>
          </div>
        </div>

        {/* Score Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between text-center">
          <div className="space-y-1">
            <div className="text-xs uppercase font-bold tracking-wider text-stone-500">Overall Rubric Score</div>
            <div className="text-5xl font-bold text-stone-900 tracking-tight">{averageScore}</div>
            <div className="text-xs text-stone-500">out of 5.0 maximum</div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-2 text-left">
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
              <div className="text-[10px] uppercase font-semibold text-stone-500">Strongest</div>
              <div className="text-xs font-semibold text-emerald-700 truncate mt-0.5">
                {results.reduce((max, r) => (r.score > max.score ? r : max), results[0] || { score: 0, criterionKey: 'none' }).criterionKey.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
              <div className="text-[10px] uppercase font-semibold text-stone-500">Focus Area</div>
              <div className="text-xs font-semibold text-amber-700 truncate mt-0.5">
                {results.reduce((min, r) => (r.score < min.score ? r : min), results[0] || { score: 5, criterionKey: 'none' }).criterionKey.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7 Deep-Dive Rubric Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900 tracking-tight">
            Detailed Dimension-by-Dimension Breakdown
          </h2>
          <span className="text-xs text-stone-500">Grounded in direct submission evidence</span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {results.map((result: CriterionResult, idx: number) => {
            const meta = CRITERION_METADATA[result.criterionKey] || {
              label: result.criterionKey.replace(/_/g, ' ').toUpperCase(),
              desc: 'Architectural evaluation criteria.',
            };
            const scoreBadge = getScoreBadge(result.score);

            return (
              <div
                key={result.criterionKey || idx}
                id={`criterion-card-${result.criterionKey}`}
                className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4 hover:border-stone-300 transition-colors"
              >
                {/* Header: Label, Description & Score */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-stone-100 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-semibold text-stone-900">{meta.label}</h3>
                    <p className="text-xs text-stone-500">{meta.desc}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border self-start ${scoreBadge.bg} ${scoreBadge.text} ${scoreBadge.border}`}
                  >
                    {scoreBadge.label}
                  </span>
                </div>

                {/* Evidence Quote Block */}
                {result.evidence && (
                  <div className="bg-stone-50/80 rounded-xl p-3.5 border border-stone-200/80 space-y-1">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-stone-700">
                      <Quote className="w-3.5 h-3.5 text-stone-400" />
                      <span>Submission Evidence / Citation:</span>
                    </div>
                    <p className="text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed">
                      {result.evidence}
                    </p>
                  </div>
                )}

                {/* Concerns & Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Concern */}
                  <div className="bg-rose-50/60 rounded-xl p-3.5 border border-rose-200/70 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Architectural Concern / Vulnerability:</span>
                    </div>
                    <p className="text-xs text-rose-900/90 leading-relaxed">
                      {result.concern || 'No significant structural vulnerabilities identified in this dimension.'}
                    </p>
                  </div>

                  {/* Suggestion */}
                  <div className="bg-indigo-50/60 rounded-xl p-3.5 border border-indigo-200/70 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-900">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Concrete Actionable Recommendation:</span>
                    </div>
                    <p className="text-xs text-indigo-900/90 leading-relaxed">
                      {result.suggestion || 'Continue practicing decoupled interface contracts.'}
                    </p>
                  </div>
                </div>

                {/* Confidence */}
                <div className="text-[11px] text-stone-400 flex items-center justify-end space-x-1 pt-1">
                  <span>Evaluator confidence:</span>
                  <span className="font-semibold text-stone-600">
                    {Math.round((result.confidence || 0.85) * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
