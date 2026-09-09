process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './backend/src/config/env';
import { errorHandler } from './backend/src/api/middleware/errorHandler';
import { PrismaProblemRepository } from './backend/src/infrastructure/repositories/PrismaProblemRepository';
import { PrismaAttemptRepository } from './backend/src/infrastructure/repositories/PrismaAttemptRepository';
import { PrismaSubmissionRepository } from './backend/src/infrastructure/repositories/PrismaSubmissionRepository';
import { PrismaEvaluationRepository } from './backend/src/infrastructure/repositories/PrismaEvaluationRepository';
import { checkDatabaseConnection } from './backend/src/infrastructure/prisma/client';
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
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Startup database & repository initialization wrapped in explicit error logging
  let problemRepo: PrismaProblemRepository;
  let attemptRepo: PrismaAttemptRepository;
  let submissionRepo: PrismaSubmissionRepository;
  let evaluationRepo: PrismaEvaluationRepository;

  try {
    console.log('[Startup] Initializing database...');
    if (process.env.DATABASE_URL && !options?.useStubAI) {
      await checkDatabaseConnection();
    }
    problemRepo = new PrismaProblemRepository();
    attemptRepo = new PrismaAttemptRepository();
    submissionRepo = new PrismaSubmissionRepository();
    evaluationRepo = new PrismaEvaluationRepository();

    // Seed problems at startup
    console.log('[Startup] Seeding...');
    await seedProblems(problemRepo);
    console.log('[Startup] Database and problem repositories ready.');
  } catch (dbErr) {
    console.error('[Startup] FATAL DATABASE / PRISMA INITIALIZATION ERROR:', dbErr);
    throw dbErr;
  }

  // Evaluators & Orchestrator
  const deterministicEvaluator = new DeterministicEvaluator();
  const geminiClient = new GeminiClient();
  
  // Real AIRubricEvaluator is used in live runtime with GeminiClient (with multi-model fallback & backoff retries).
  // StubAIEvaluator is strictly gated behind options?.useStubAI for hermetic automated testing.
  const aiEvaluator = options?.useStubAI
    ? new StubAIEvaluator()
    : new AIRubricEvaluator(geminiClient, 18000);

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
  console.log('[Startup] Starting server');
  const PORT = Number(process.env.PORT) || 3000;
  console.log(`[Startup] PORT=${PORT}`);

  const app = await createBackendApp();

  // Mount Vite middleware for dev or serve static files in production
  if (process.env.NODE_ENV === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log('[Startup] Starting HTTP server...');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`[LLD Practice Platform] Server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start if not running under a test runner (e.g. vitest)
const isTestEnvironment = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
if (!isTestEnvironment) {
  startServer().catch((err) => {
    console.error('[Startup] Fatal failure starting server:', err);
    process.exit(1);
  });
}
