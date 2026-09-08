import { FC, useState } from 'react';
import { HistoryItem, Attempt, CriterionResult } from '../types';
import {
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  GitCompare,
  TrendingUp,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface HistoryViewProps {
  history: HistoryItem[];
  onSelectSubmission: (submissionId: string, problem: any) => void;
  onSelectAttempt: (attempt: Attempt, problem: any) => void;
  isLoading: boolean;
}

/**
 * Resolves the accurate evaluation details for a history item,
 * preferring the final Feedback object (which blends AI + deterministic)
 * to ensure 100% fidelity with the individual report view.
 */
function resolveHistoryEvaluation(item: HistoryItem): {
  score: string | null;
  isAi: boolean;
  evaluatorBadge: string;
  rubricResults: CriterionResult[];
  completedAt: string | null;
} {
  // 1. Prefer feedback object (which comes from SubmissionService.getSubmissionStatus)
  if (item.feedback) {
    const results = item.feedback.combinedResults || [];
    const avgScore = results.length > 0
      ? (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)
      : null;
    const isAi = Boolean(item.feedback.aiAvailable);
    return {
      score: avgScore,
      isAi,
      evaluatorBadge: isAi ? 'Gemini 3.8 Flash Evaluated' : 'Deterministic Structural Audit',
      rubricResults: results,
      completedAt: item.latestSubmission?.completedAt || item.feedback.generatedAt || null,
    };
  }

  // 2. Fallback: inspect evaluations array (preferring AI if present and not fallback)
  const aiEval = item.evaluations.find((e) => e.evaluatorType === 'AI' && !e.metadata?.fallback);
  const detEval = item.evaluations.find((e) => e.evaluatorType === 'DETERMINISTIC');
  const targetEval = aiEval || detEval || item.evaluations[0];

  if (!targetEval) {
    return {
      score: null,
      isAi: false,
      evaluatorBadge: 'In progress',
      rubricResults: [],
      completedAt: item.latestSubmission?.completedAt || null,
    };
  }

  const results = targetEval.rubricResults || [];
  const avgScore = results.length > 0
    ? (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)
    : null;
  const isAi = targetEval.evaluatorType === 'AI' && !targetEval.metadata?.fallback;

  return {
    score: avgScore,
    isAi,
    evaluatorBadge: isAi ? 'Gemini 3.8 Flash Evaluated' : 'Deterministic Structural Audit',
    rubricResults: results,
    completedAt: item.latestSubmission?.completedAt || targetEval.createdAt,
  };
}

export const HistoryView: FC<HistoryViewProps> = ({
  history,
  onSelectSubmission,
  onSelectAttempt,
  isLoading,
}) => {
  const [compareA, setCompareA] = useState<HistoryItem | null>(null);
  const [compareB, setCompareB] = useState<HistoryItem | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const completedItems = history.filter((h) => h.latestSubmission?.status === 'COMPLETED');

  const startComparison = (item: HistoryItem) => {
    setCompareA(item);
    // Find another attempt for the same problem if available
    const other = history.find(
      (h) => h.attempt.id !== item.attempt.id && h.attempt.problemId === item.attempt.problemId
    );
    if (other) {
      setCompareB(other);
    } else {
      setCompareB(null);
    }
    setIsComparing(true);
  };

  const evalA = compareA ? resolveHistoryEvaluation(compareA) : null;
  const evalB = compareB ? resolveHistoryEvaluation(compareB) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-stone-900">
            <History className="w-5 h-5 text-amber-600" />
            <h1 className="text-2xl font-semibold tracking-tight">Attempt History & Iteration Log</h1>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Track your architectural design progression, view immutable snapshots, and compare iterative revisions.
          </p>
        </div>

        {completedItems.length >= 2 && !isComparing && (
          <button
            onClick={() => startComparison(completedItems[0])}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-colors flex items-center space-x-2 cursor-pointer shadow-xs"
          >
            <GitCompare className="w-4 h-4 text-amber-400" />
            <span>Compare Two Attempts</span>
          </button>
        )}
      </div>

      {/* Comparison Modal / Section */}
      {isComparing && compareA && evalA && (
        <div className="bg-white rounded-2xl border-2 border-amber-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div className="flex items-center space-x-2">
              <GitCompare className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-stone-900">
                Side-by-Side Progression Comparison ({compareA.problem?.title})
              </h2>
            </div>
            <button
              onClick={() => setIsComparing(false)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Version A */}
            <div className="space-y-4 bg-stone-50 p-5 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Attempt A</span>
                <span className="text-xs font-mono text-stone-400">
                  {evalA.completedAt ? new Date(evalA.completedAt).toLocaleTimeString() : new Date(compareA.attempt.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-900">{compareA.problem?.title}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-stone-500">Score: <strong className="text-stone-900">{evalA.score || 'N/A'}/5.0</strong></span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      evalA.isAi
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {evalA.evaluatorBadge}
                  </span>
                </div>
              </div>

              {/* Rubric scores */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <div className="text-xs font-semibold text-stone-700">Criterion Scores:</div>
                {evalA.rubricResults.map((r) => (
                  <div key={r.criterionKey} className="flex items-center justify-between text-xs py-1 border-b border-stone-200/50">
                    <span className="text-stone-600 truncate">{r.criterionKey.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">{r.score}/5</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Version B */}
            <div className="space-y-4 bg-stone-50 p-5 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Attempt B (Comparison Target)</span>
                {compareB && evalB && (
                  <span className="text-xs font-mono text-stone-400">
                    {evalB.completedAt ? new Date(evalB.completedAt).toLocaleTimeString() : new Date(compareB.attempt.createdAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {compareB && evalB ? (
                <>
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{compareB.problem?.title}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-stone-500">Score: <strong className="text-stone-900">{evalB.score || 'N/A'}/5.0</strong></span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          evalB.isAi
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {evalB.evaluatorBadge}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-stone-200">
                    <div className="text-xs font-semibold text-stone-700">Criterion Scores:</div>
                    {evalB.rubricResults.map((r) => {
                      const aScore = evalA.rubricResults.find((ar) => ar.criterionKey === r.criterionKey)?.score || 0;
                      const delta = r.score - aScore;
                      return (
                        <div key={r.criterionKey} className="flex items-center justify-between text-xs py-1 border-b border-stone-200/50">
                          <span className="text-stone-600 truncate">{r.criterionKey.replace(/_/g, ' ')}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">{r.score}/5</span>
                            {delta > 0 ? (
                              <span className="text-emerald-700 font-bold">+{delta}</span>
                            ) : delta < 0 ? (
                              <span className="text-rose-700 font-bold">{delta}</span>
                            ) : (
                              <span className="text-stone-400">=</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-xs text-stone-500">
                  Select another attempt below to compare side-by-side.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
          <Clock className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="text-base font-semibold text-stone-900">No Attempts Recorded Yet</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Choose a problem from the catalog to build your first object-oriented design and receive architectural rubric feedback.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Problem</th>
                <th className="px-6 py-3.5">Evaluation Completed</th>
                <th className="px-6 py-3.5">Attempt Status</th>
                <th className="px-6 py-3.5">Evaluation Score</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {history.map((item) => {
                const sub = item.latestSubmission;
                const evalData = resolveHistoryEvaluation(item);

                return (
                  <tr key={item.attempt.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-stone-900">{item.problem?.title || item.attempt.problemId}</div>
                      <div className="text-stone-400 font-mono text-[11px]">ID: {item.attempt.id.slice(0, 12)}</div>
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      {evalData.completedAt ? (
                        <div>
                          <div className="font-medium text-stone-900">
                            {new Date(evalData.completedAt).toLocaleDateString()}{' '}
                            {new Date(evalData.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[11px] text-stone-400">
                            Started: {new Date(item.attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-stone-700">
                            {new Date(item.attempt.createdAt).toLocaleDateString()}{' '}
                            {new Date(item.attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[11px] text-stone-400">Drafted</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          sub?.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sub?.status === 'EVALUATING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        {sub?.status || item.attempt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {evalData.score ? (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-stone-900 text-sm">{evalData.score}</span>
                            <span className="text-stone-400">/ 5.0</span>
                          </div>
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${
                              evalData.isAi
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {evalData.evaluatorBadge}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">In progress</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {sub && sub.status === 'COMPLETED' ? (
                        <button
                          onClick={() => onSelectSubmission(sub.id, item.problem)}
                          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <span>View Report</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectAttempt(item.attempt, item.problem)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <span>Resume Draft</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {sub?.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setCompareB(item);
                            setIsComparing(true);
                          }}
                          className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 rounded-lg border border-stone-200 font-medium transition-colors cursor-pointer"
                        >
                          Compare
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
