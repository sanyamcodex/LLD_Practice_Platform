import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ProblemList } from './components/ProblemList';
import { Workspace } from './components/Workspace';
import { FeedbackView } from './components/FeedbackView';
import { HistoryView } from './components/HistoryView';
import { ArchitectureModal } from './components/ArchitectureModal';
import { Problem, Attempt, Submission, Feedback, HistoryItem, AttemptContent } from './types';
import { api } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState<'problems' | 'workspace' | 'feedback' | 'history'>('problems');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [isLoadingProblems, setIsLoadingProblems] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial problems catalog
  useEffect(() => {
    async function loadProblems() {
      try {
        setIsLoadingProblems(true);
        const data = await api.getProblems();
        setProblems(data);
      } catch (err) {
        console.error('Failed to load problems:', err);
      } finally {
        setIsLoadingProblems(false);
      }
    }
    loadProblems();
    loadHistoryData();
  }, []);

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  const loadHistoryData = async () => {
    try {
      setIsLoadingHistory(true);
      const data = await api.getHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Start an attempt for a problem
  const handleSelectProblem = async (problem: Problem) => {
    try {
      setSelectedProblem(problem);
      const attempt = await api.startAttempt(problem.id);
      setCurrentAttempt(attempt);
      setCurrentSubmission(null);
      setCurrentFeedback(null);
      setCurrentView('workspace');
      loadHistoryData();
    } catch (err) {
      console.error('Failed to start attempt:', err);
      alert('Could not start attempt. Please check system status.');
    }
  };

  // Auto-save draft content
  const handleSaveDraft = async (content: AttemptContent) => {
    if (!currentAttempt) return;
    try {
      const updated = await api.saveDraft(currentAttempt.id, content);
      setCurrentAttempt(updated);
    } catch (err) {
      console.error('Failed to auto-save draft:', err);
    }
  };

  // Submit attempt and begin polling for evaluation completion
  const handleSubmitAttempt = async () => {
    if (!currentAttempt) return;

    try {
      setIsSubmitting(true);
      const submission = await api.submitAttempt(currentAttempt.id);
      setCurrentSubmission(submission);
      setCurrentView('feedback');

      // Begin status polling
      pollSubmissionStatus(submission.id);
    } catch (err: any) {
      console.error('Submission failed:', err);
      alert(err.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll submission status until COMPLETED or FAILED
  const pollSubmissionStatus = (submissionId: string) => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
    }

    const poll = async () => {
      try {
        const res = await api.getSubmissionStatus(submissionId);
        setCurrentSubmission(res.submission);

        if (res.submission.status === 'COMPLETED' || res.submission.status === 'FAILED') {
          setCurrentFeedback(res.feedback);
          loadHistoryData();
          return;
        }

        // Continue polling every 1000ms while evaluating
        pollingTimerRef.current = setTimeout(poll, 1000);
      } catch (err) {
        console.error('Error polling submission status:', err);
        pollingTimerRef.current = setTimeout(poll, 1500);
      }
    };

    pollingTimerRef.current = setTimeout(poll, 600);
  };

  // Re-attempt based on previous submission content
  const handleReAttempt = async (previousContent: AttemptContent) => {
    if (!selectedProblem) return;
    try {
      const newAttempt = await api.startAttempt(selectedProblem.id);
      const withPrevious = await api.saveDraft(newAttempt.id, previousContent);
      setCurrentAttempt(withPrevious);
      setCurrentSubmission(null);
      setCurrentFeedback(null);
      setCurrentView('workspace');
      loadHistoryData();
    } catch (err) {
      console.error('Failed to create re-attempt:', err);
    }
  };

  // Inspect existing submission from history
  const handleSelectSubmission = async (submissionId: string, problem: Problem) => {
    try {
      setSelectedProblem(problem);
      const res = await api.getSubmissionStatus(submissionId);
      setCurrentSubmission(res.submission);
      setCurrentFeedback(res.feedback);
      setCurrentView('feedback');
    } catch (err) {
      console.error('Failed to load submission report:', err);
    }
  };

  // Re-evaluate an existing submission (e.g. if AI was busy or unavailable)
  const handleReevaluate = async () => {
    if (!currentSubmission) return;
    try {
      await api.reevaluateSubmission(currentSubmission.id);
      setCurrentSubmission({
        ...currentSubmission,
        status: 'SUBMITTED',
      });
      setCurrentFeedback(null);
      pollSubmissionStatus(currentSubmission.id);
    } catch (err: any) {
      console.error('Failed to trigger re-evaluation:', err);
      alert(err.message || 'Could not re-trigger evaluation.');
    }
  };

  // Resume an in-progress attempt
  const handleSelectAttempt = (attempt: Attempt, problem: Problem) => {
    setSelectedProblem(problem);
    setCurrentAttempt(attempt);
    setCurrentSubmission(null);
    setCurrentFeedback(null);
    setCurrentView('workspace');
  };

  return (
    <div className="min-h-screen bg-stone-50/60 text-stone-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <Header
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'history') loadHistoryData();
          setCurrentView(view);
        }}
        hasActiveAttempt={Boolean(currentAttempt)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
      />

      <main className="flex-1 pb-16">
        {currentView === 'problems' && (
          <ProblemList
            problems={problems}
            onSelectProblem={handleSelectProblem}
            isLoading={isLoadingProblems}
          />
        )}

        {currentView === 'workspace' && selectedProblem && currentAttempt && (
          <Workspace
            problem={selectedProblem}
            attempt={currentAttempt}
            onSaveDraft={handleSaveDraft}
            onSubmitAttempt={handleSubmitAttempt}
            isSubmitting={isSubmitting}
          />
        )}

        {currentView === 'feedback' && selectedProblem && currentSubmission && (
          <FeedbackView
            problem={selectedProblem}
            submission={currentSubmission}
            feedback={currentFeedback}
            onReAttempt={handleReAttempt}
            onBackToCatalog={() => setCurrentView('problems')}
            onViewHistory={() => {
              loadHistoryData();
              setCurrentView('history');
            }}
            onReevaluate={handleReevaluate}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            history={history}
            onSelectSubmission={handleSelectSubmission}
            onSelectAttempt={handleSelectAttempt}
            isLoading={isLoadingHistory}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>LLD Practice Platform &bull; Domain-Driven Design Architecture</span>
          <button
            onClick={() => setIsArchitectureOpen(true)}
            className="text-amber-700 hover:underline cursor-pointer"
          >
            View Formal DDD Specifications & State Transitions
          </button>
        </div>
      </footer>

      {/* Architecture Spec Modal */}
      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />
    </div>
  );
}
