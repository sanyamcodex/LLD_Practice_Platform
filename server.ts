import express, { Express, Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './backend/src/config/env';
import { errorHandler } from './backend/src/api/middleware/errorHandler';
import { PrismaProblemRepository } from './backend/src/infrastructure/repositories/PrismaProblemRepository';
import { PrismaAttemptRepository } from './backend/src/infrastructure/repositories/PrismaAttemptRepository';
import { PrismaSubmissionRepository } from './backend/src/infrastructure/repositories/PrismaSubmissionRepository';
import { PrismaEvaluationRepository } from './backend/src/infrastructure/repositories/PrismaEvaluationRepository';
import { seedProblems } from './backend/src/infrastructure/seed/seedProblems';
import { DeterministicEvaluator } from './backend/src/domain/evaluation/DeterministicEvaluator';
import { AIRubricEvaluator } from './backend/src/domain/evaluation/AIRubricEvaluator';
import { StubAIEvaluator } from './backend/src/domain/evaluation/StubAIEvaluator';
import { GeminiClient } from './backend/src/infrastructure/llm/GeminiClient';
import { EvaluationOrchestrator } from './backend/src/domain/evaluation/EvaluationOrchestrator';
import { EvaluationQueue } from './backend/src/application/EvaluationQueue';
import { ProblemService } from './backend/src/application/ProblemService';
import { AttemptService } from './backend/src/application/AttemptService';
import { SubmissionService } from './backend/src/application/SubmissionService';
import { createProblemsRouter } from './backend/src/api/routes/problems.routes';
import { createAttemptsRouter } from './backend/src/api/routes/attempts.routes';
import { createSubmissionsRouter } from './backend/src/api/routes/submissions.routes';
import { createHistoryRouter } from './backend/src/api/routes/history.routes';

export async function createBackendApp(options?: { useStubAI?: boolean }): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Repositories
  const problemRepo = new PrismaProblemRepository();
  const attemptRepo = new PrismaAttemptRepository();
  const submissionRepo = new PrismaSubmissionRepository();
  const evaluationRepo = new PrismaEvaluationRepository();

  // Seed problems at startup
  await seedProblems(problemRepo);

  // Evaluators & Orchestrator
  const deterministicEvaluator = new DeterministicEvaluator();
  const geminiClient = new GeminiClient();
  
  // Real AIRubricEvaluator is used in live runtime with GeminiClient (with multi-model fallback & backoff retries).
  // StubAIEvaluator is strictly gated behind options?.useStubAI for hermetic automated testing.
  const aiEvaluator = options?.useStubAI
    ? new StubAIEvaluator()
    : new AIRubricEvaluator(geminiClient, 35000);

  const orchestrator = new EvaluationOrchestrator(
    deterministicEvaluator,
    aiEvaluator,
    evaluationRepo,
    submissionRepo
  );

  // In-process Async Worker Queue
  const evaluationQueue = new EvaluationQueue(orchestrator, submissionRepo, problemRepo, attemptRepo);

  // Services
  const problemService = new ProblemService(problemRepo);
  const attemptService = new AttemptService(attemptRepo, problemRepo);
  const submissionService = new SubmissionService(
    submissionRepo,
    attemptRepo,
    evaluationRepo,
    evaluationQueue
  );

  // Health-check endpoint per Phase 0
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // API Routes per GoogleAI.md §5
  app.use('/api/problems', createProblemsRouter(problemService));
  app.use('/api/attempts', createAttemptsRouter(attemptService, submissionService));
  app.use('/api/submissions', createSubmissionsRouter(submissionService));
  app.use('/api/history', createHistoryRouter(attemptService, submissionRepo, evaluationRepo, problemRepo, submissionService));

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  const app = await createBackendApp();
  const PORT = config.port || 3000;

  // Mount Vite middleware for dev or serve static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LLD Practice Platform] Server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start if executed directly
if (process.argv[1] && process.argv[1].includes('server.ts')) {
  startServer().catch((err) => {
    console.error('Fatal failure starting server:', err);
    process.exit(1);
  });
}
