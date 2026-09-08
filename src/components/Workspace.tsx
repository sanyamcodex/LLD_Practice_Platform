import { FC, useState, useEffect, useRef } from 'react';
import { Problem, Attempt, AttemptContent } from '../types';
import {
  Send,
  Save,
  FileText,
  Boxes,
  Network,
  Zap,
  Check,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface WorkspaceProps {
  problem: Problem;
  attempt: Attempt;
  onSaveDraft: (content: AttemptContent) => Promise<void>;
  onSubmitAttempt: () => Promise<void>;
  isSubmitting: boolean;
}

type TabKey = 'assumptions' | 'classes' | 'relationships' | 'extensibility';

export const Workspace: FC<WorkspaceProps> = ({
  problem,
  attempt,
  onSaveDraft,
  onSubmitAttempt,
  isSubmitting,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('assumptions');
  const [content, setContent] = useState<AttemptContent>(attempt.content);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if attempt changes
  useEffect(() => {
    setContent(attempt.content);
  }, [attempt.id]);

  // Debounced auto-save (800ms)
  const handleFieldChange = (field: keyof AttemptContent, value: string) => {
    const updated = { ...content, [field]: value };
    setContent(updated);
    setSaveStatus('saving');
    setValidationError(null);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSaveDraft(updated);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('idle');
      }
    }, 800);
  };

  const handleSubmit = async () => {
    // Validate that sections aren't empty
    if (!content.classesAndResponsibilities.trim()) {
      setValidationError('Please define your core classes and responsibilities before submitting.');
      setActiveTab('classes');
      return;
    }
    if (!content.relationships.trim()) {
      setValidationError('Please specify how your classes interact and relate before submitting.');
      setActiveTab('relationships');
      return;
    }
    if (!content.extensibilityAnswer.trim()) {
      setValidationError('Please answer the extensibility question regarding the stated future requirements.');
      setActiveTab('extensibility');
      return;
    }

    await onSubmitAttempt();
  };

  const loadStarterTemplate = () => {
    if (
      content.classesAndResponsibilities &&
      !window.confirm('Replace current inputs with a structured architectural starter template?')
    ) {
      return;
    }

    const starter: AttemptContent = {
      assumptions: `1. System operates in a single region with multi-threaded concurrent access.
2. Read operations outnumber write operations by 10:1.
3. In-memory operations are guarded using fine-grained synchronization locks to prevent race conditions.`,
      classesAndResponsibilities: `// Core Domain Entities & Value Objects
class ${problem.title.replace(/[^a-zA-Z]/g, '')}System {
  - repository: IRepository
  - strategy: IStrategy
  + initialize(): void
  + processRequest(req: Request): Response
}

interface IStrategy {
  + execute(context: Context): Result
}

class DefaultStrategy implements IStrategy {
  + execute(context: Context): Result { /* implementation */ }
}`,
      relationships: `1. ${problem.title.replace(/[^a-zA-Z]/g, '')}System has-a (composition) IStrategy interface for polymorphic behavior.
2. DefaultStrategy implements IStrategy.
3. Context is passed as a dependency parameter into IStrategy (dependency inversion).`,
      extensibilityAnswer: `To accommodate the stated future requirement ("${problem.futureRequirements[0]}"), we introduce an adapter/strategy implementation without modifying the existing system contracts. This strictly adheres to the Open-Closed Principle (OCP).`,
    };

    setContent(starter);
    onSaveDraft(starter);
  };

  const tabs: { key: TabKey; label: string; icon: any; placeholder: string; field: keyof AttemptContent; hint: string }[] = [
    {
      key: 'assumptions',
      label: '1. Assumptions & Scope',
      icon: FileText,
      field: 'assumptions',
      placeholder: `Document key boundary conditions, scale expectations, and functional assumptions...

Example:
- Supported user volume and concurrency expectations
- Thread-safety strategy (locks, synchronizers)
- Persistence vs In-Memory guarantees`,
      hint: 'Scope the problem boundary before choosing classes. State concurrency and hardware constraints.',
    },
    {
      key: 'classes',
      label: '2. Classes & Responsibilities (SRP)',
      icon: Boxes,
      field: 'classesAndResponsibilities',
      placeholder: `List candidate classes, interfaces, abstract classes, attributes, and public method signatures...

Example:
interface AllocationStrategy {
  + allocateSpot(vehicle: Vehicle): ParkingSpot
}

class ParkingLot {
  - floors: List<ParkingFloor>
  - strategy: AllocationStrategy
  + parkVehicle(vehicle: Vehicle): Ticket
  + unparkVehicle(ticket: Ticket): Invoice
}`,
      hint: 'Adhere to Single Responsibility Principle. Avoid God classes that combine business logic and storage.',
    },
    {
      key: 'relationships',
      label: '3. Relationships & Interaction',
      icon: Network,
      field: 'relationships',
      placeholder: `Specify structural relationships between classes...

Example:
- Composition: ParkingLot has-a ParkingFloor (1:N lifecycle bound)
- Aggregation: ParkingFloor has-a ParkingSpot (1:N)
- Inheritance / Polymorphism: EVSpot, CompactSpot extend ParkingSpot (is-a)
- Interface Implementation: NearestFirstStrategy implements AllocationStrategy`,
      hint: 'Favor composition over inheritance. Explicitly identify 1:N cardinality and interface contracts.',
    },
    {
      key: 'extensibility',
      label: '4. Extensibility & Future Test',
      icon: Zap,
      field: 'extensibilityAnswer',
      placeholder: `Explain how your design gracefully handles the problem's stated future requirements without modifying existing core classes (Open-Closed Principle)...

Review problem statement's stated future requirements:
"${problem.futureRequirements.join('\n')}"

Describe:
1. What new classes or interfaces you would add
2. Which existing classes remain untouched
3. What design patterns (Strategy, Factory, Adapter, Observer) protect the core`,
      hint: 'This directly tests Criterion 6. Ground your answer in Design Patterns and the Open-Closed Principle.',
    },
  ];

  const currentTabConfig = tabs.find((t) => t.key === activeTab)!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Breadcrumb, Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-stone-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-stone-500 font-medium">
            <span>Problem Catalog</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-stone-900 font-semibold">{problem.title}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
            Design Studio & Architectural Workspace
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* Save status badge */}
          <div className="flex items-center space-x-1.5 text-xs text-stone-500 font-medium px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200">
            {saveStatus === 'saving' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Auto-saving draft...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">All changes saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-stone-400" />
                <span>Draft persistent</span>
              </>
            )}
          </div>

          <button
            id="load-starter-btn"
            onClick={loadStarterTemplate}
            className="text-xs font-medium px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Scaffolding</span>
          </button>

          <button
            id="submit-attempt-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`text-xs font-semibold px-5 py-2 rounded-xl text-white flex items-center space-x-2 cursor-pointer transition-all shadow-xs ${
              isSubmitting
                ? 'bg-stone-400 cursor-wait'
                : 'bg-stone-900 hover:bg-stone-800'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting for Audit...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>Submit for Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Two-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Problem Brief & Extensibility Targets (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
                  {problem.difficulty}
                </span>
                <span className="text-xs text-stone-400 font-mono">Attempt: {attempt.id.slice(0, 10)}</span>
              </div>
              <h2 className="text-lg font-semibold text-stone-900 mt-2">{problem.title}</h2>
            </div>

            {/* Markdown-style Description */}
            <div className="text-xs sm:text-sm text-stone-700 whitespace-pre-line leading-relaxed border-t border-stone-100 pt-4 space-y-2">
              {problem.description}
            </div>

            {/* Future Requirements Box (Crucial for Criterion 6) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-900 uppercase tracking-wide">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>Extensibility Dimension Prompts</span>
              </div>
              <p className="text-xs text-amber-800">
                Your design will be evaluated on how cleanly it absorbs these future additions without modifying core classes:
              </p>
              <ul className="list-disc list-inside text-xs text-amber-950 space-y-1.5 font-medium pl-1">
                {problem.futureRequirements.map((req, i) => (
                  <li key={i} className="leading-snug">{req}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Structured Response Tabs (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col overflow-hidden min-h-[640px]">
          {/* Section Navigation Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50/70 p-2 gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const hasContent = Boolean(content[tab.field]?.trim());

              return (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-xs font-semibold border border-stone-200'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-600' : 'text-stone-400'}`} />
                  <span>{tab.label}</span>
                  {hasContent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Field Workspace */}
          <div className="p-6 flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-medium text-stone-700">{currentTabConfig.hint}</span>
              <span>{(content[currentTabConfig.field] || '').length} characters</span>
            </div>

            <textarea
              id={`input-${currentTabConfig.field}`}
              value={content[currentTabConfig.field] || ''}
              onChange={(e) => handleFieldChange(currentTabConfig.field, e.target.value)}
              placeholder={currentTabConfig.placeholder}
              rows={18}
              className={`w-full flex-1 p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-xs sm:text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 resize-none ${
                activeTab === 'classes' ? 'font-mono text-xs' : 'font-sans'
              }`}
            />
          </div>

          {/* Tab Next / Previous Guidance Footer */}
          <div className="border-t border-stone-100 px-6 py-3 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
            <span>Structured Section {tabs.findIndex((t) => t.key === activeTab) + 1} of 4</span>
            <div className="flex items-center space-x-2">
              {activeTab !== 'assumptions' && (
                <button
                  onClick={() => {
                    const idx = tabs.findIndex((t) => t.key === activeTab);
                    setActiveTab(tabs[idx - 1].key);
                  }}
                  className="px-2.5 py-1 text-stone-600 hover:text-stone-900 font-medium cursor-pointer"
                >
                  Back
                </button>
              )}
              {activeTab !== 'extensibility' && (
                <button
                  onClick={() => {
                    const idx = tabs.findIndex((t) => t.key === activeTab);
                    setActiveTab(tabs[idx + 1].key);
                  }}
                  className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium rounded-lg cursor-pointer"
                >
                  Next Section &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
