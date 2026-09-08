import { FC } from 'react';
import { Layers, History, Code2, BookOpen, Compass } from 'lucide-react';

interface HeaderProps {
  currentView: 'problems' | 'workspace' | 'feedback' | 'history';
  onNavigate: (view: 'problems' | 'workspace' | 'feedback' | 'history') => void;
  hasActiveAttempt: boolean;
  onOpenArchitecture: () => void;
}

export const Header: FC<HeaderProps> = ({
  currentView,
  onNavigate,
  hasActiveAttempt,
  onOpenArchitecture,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('problems')}>
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-stone-900 text-base tracking-tight">LLD Architect</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Evaluation Engine
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">Domain-Driven Low-Level Design Practice</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            id="nav-problems-btn"
            onClick={() => onNavigate('problems')}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'problems'
                ? 'bg-stone-100 text-stone-900 font-semibold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-stone-500" />
            <span>Problem Catalog</span>
          </button>

          <button
            id="nav-workspace-btn"
            onClick={() => onNavigate('workspace')}
            disabled={!hasActiveAttempt}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'workspace' || currentView === 'feedback'
                ? 'bg-stone-100 text-stone-900 font-semibold'
                : hasActiveAttempt
                ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                : 'text-stone-300 cursor-not-allowed'
            }`}
          >
            <Code2 className="w-4 h-4 text-stone-500" />
            <span>Design Studio</span>
            {hasActiveAttempt && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            id="nav-history-btn"
            onClick={() => onNavigate('history')}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'history'
                ? 'bg-stone-100 text-stone-900 font-semibold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <History className="w-4 h-4 text-stone-500" />
            <span>Attempt History</span>
          </button>

          <div className="h-5 w-px bg-stone-200 mx-1 hidden sm:block" />

          <button
            id="nav-architecture-btn"
            onClick={onOpenArchitecture}
            className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-amber-800 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/70 transition-colors flex items-center space-x-1.5"
          >
            <Compass className="w-4 h-4 text-amber-700" />
            <span className="hidden md:inline">Architecture & DDD Spec</span>
            <span className="md:hidden">Specs</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
