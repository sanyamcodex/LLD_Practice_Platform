import { FC } from 'react';
import { Problem, Difficulty } from '../types';
import { ArrowRight, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ProblemListProps {
  problems: Problem[];
  onSelectProblem: (problem: Problem) => void;
  isLoading: boolean;
}

const difficultyColors: Record<Difficulty, { bg: string; text: string; border: string }> = {
  EASY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  HARD: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const ProblemList: FC<ProblemListProps> = ({ problems, onSelectProblem, isLoading }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Header Banner */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-800">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rigorous Evaluation Framework</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Master Low-Level Design with Concrete Architectural Feedback
          </h1>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Practice decomposing complex systems into decoupled object-oriented models. Every submission is evaluated against 7 fixed criteria—including Single Responsibility, Interface Segregation, and an explicit Extensibility stress-test against unannounced future requirements.
          </p>
        </div>

        {/* 7 Criteria Badges Grid */}
        <div className="mt-6 pt-6 border-t border-stone-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {[
            { label: 'Requirements', key: 'Scope & Assumptions' },
            { label: 'Classes & SRP', key: 'Single Responsibility' },
            { label: 'Coupling', key: 'Low Coupling & Cohesion' },
            { label: 'Encapsulation', key: 'Interfaces & Contracts' },
            { label: 'Patterns', key: 'Structural & Behavioral' },
            { label: 'Extensibility', key: 'Open-Closed Test' },
            { label: 'Rationale', key: 'Trade-off Articulation' },
          ].map((item, idx) => (
            <div key={idx} className="bg-stone-800/80 rounded-lg p-2.5 border border-stone-700/60">
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">
                Criterion {idx + 1}
              </div>
              <div className="text-xs font-medium text-stone-200 mt-0.5 truncate">{item.label}</div>
              <div className="text-[10px] text-stone-400 truncate">{item.key}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight">Curated LLD Problem Bank</h2>
          <p className="text-sm text-stone-500">
            Select a classic design problem to begin a structured design session.
          </p>
        </div>
        <span className="text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1 rounded-full w-fit">
          5 Industry Benchmark Problems
        </span>
      </div>

      {/* Problems Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-stone-100 rounded-2xl animate-pulse border border-stone-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => {
            const diffStyle = difficultyColors[problem.difficulty] || difficultyColors.MEDIUM;

            return (
              <div
                key={problem.id}
                id={`problem-card-${problem.id}`}
                className="group bg-white rounded-2xl border border-stone-200 hover:border-stone-400 transition-all duration-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Card Header: Difficulty & Title */}
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                    >
                      {problem.difficulty}
                    </span>
                    <span className="text-xs text-stone-400 font-mono">ID: {problem.id.replace('prob-', '')}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-stone-900 group-hover:text-amber-700 transition-colors">
                      {problem.title}
                    </h3>
                    <p className="text-xs text-stone-600 line-clamp-3 mt-2 leading-relaxed">
                      {problem.description.replace(/### Functional Requirements:|### Constraints:|### Concurrency & Non-Functional Requirements:/g, '').trim()}
                    </p>
                  </div>

                  {/* Future Requirement Extensibility Preview */}
                  <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-stone-700 text-xs font-medium">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Extensibility Dimension Preview:</span>
                    </div>
                    <p className="text-[11px] text-stone-600 italic line-clamp-2 leading-snug">
                      "{problem.futureRequirements[0]}"
                    </p>
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs text-stone-500 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>7 Rubric Criteria</span>
                  </span>
                  <button
                    id={`start-attempt-btn-${problem.id}`}
                    onClick={() => onSelectProblem(problem)}
                    className="inline-flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <span>Start Design Attempt</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
