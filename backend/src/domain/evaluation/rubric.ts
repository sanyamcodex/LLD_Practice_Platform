import { Criterion, Rubric } from '../entities';

/**
 * FIXED_RUBRIC_CRITERIA
 * The 7 core evaluation dimensions specified in Requirements §3.4/FR15 and GoogleAI.md §4.1.
 * Serves as the single source of truth referenced by determinism, AI prompts, and frontend views.
 */
export const FIXED_RUBRIC_CRITERIA: Criterion[] = [
  {
    key: 'requirement_understanding',
    label: 'Requirement Understanding',
    description:
      'Completeness of functional and non-functional requirement coverage, boundary cases, and sound assumptions without scope creep.',
  },
  {
    key: 'class_responsibilities',
    label: 'Class Responsibilities & SRP',
    description:
      'Proper decomposition into coherent classes where each class has a single, well-defined responsibility and avoids God objects.',
  },
  {
    key: 'coupling_cohesion',
    label: 'Coupling & Cohesion',
    description:
      'Low coupling between modules and high cohesion within modules; clear ownership and minimal ripple effects on changes.',
  },
  {
    key: 'encapsulation_interfaces',
    label: 'Encapsulation & Interfaces',
    description:
      'Information hiding, private state protection, clean public interfaces, and adherence to programming to interfaces rather than concrete implementations.',
  },
  {
    key: 'abstraction_pattern_use',
    label: 'Abstraction & Design Pattern Selection',
    description:
      'Appropriate use of classic design patterns (Strategy, Factory, State, Observer, Command, etc.) without over-engineering or premature complexity.',
  },
  {
    key: 'extensibility',
    label: 'Extensibility & Future Requirements',
    description:
      'Resilience to the stated future requirement changes (Open-Closed Principle); ability to accommodate new features with minimal surgery.',
  },
  {
    key: 'explanation_quality',
    label: 'Design Rationale & Trade-offs',
    description:
      'Clarity, precision, and depth of design rationale; explicit articulation of trade-offs made (e.g. memory vs speed, simplicity vs flexibility).',
  },
];

export const STANDARD_LLD_RUBRIC: Rubric = {
  id: 'standard-lld-rubric-v1',
  name: 'Standard Low-Level Design Assessment Rubric',
  description:
    'Evaluates structural completeness, object-oriented principles, design patterns, and extensibility against concrete problem requirements.',
  criteria: FIXED_RUBRIC_CRITERIA,
};
