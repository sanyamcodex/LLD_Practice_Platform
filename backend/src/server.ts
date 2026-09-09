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
import { config } from './config/env';
import { errorHandler } from './api/middleware/errorHandler';
import { PrismaProblemRepository } from './infrastructure/repositories/PrismaProblemRepository';
import { PrismaAttemptRepository } from './infrastructure/repositories/PrismaAttemptRepository';
import { PrismaSubmissionRepository } from './infrastructure/repositories/PrismaSubmissionRepository';
import { PrismaEvaluationRepository } from './infrastructure/repositories/PrismaEvaluationRepository';
import { checkDatabaseConnection } from './infrastructure/prisma/client';
import { seedProblems } from './infrastructure/seed/seedProblems';
import { DeterministicEvaluator } from './domain/evaluation/DeterministicEvaluator';
import { AIRubricEvaluator } from './domain/evaluation/AIRubricEvaluator';
import { StubAIEvaluator } from './domain/evaluation/StubAIEvaluator';
import { GeminiClient } from './infrastructure/llm/GeminiClient';
import { EvaluationOrchestrator } from './domain/evaluation/EvaluationOrchestrator';
import { EvaluationQueue } from './application/EvaluationQueue';
import { ProblemService } from './application/ProblemService';
import { AttemptService } from './application/AttemptService';
import { SubmissionService } from './application/SubmissionService';
import { createProblemsRouter } from './api/routes/problems.routes';
import { createAttemptsRouter } from './api/routes/attempts.routes';
import { createSubmissionsRouter } from './api/routes/submissions.routes';
import { createHistoryRouter } from './api/routes/history.routes';

export async function createBackendApp(options?: { useStubAI?: boolean }): Promise<Express> {
  const app = express();

  // CORS configuration to allow Vercel frontend, custom ALLOWED_ORIGIN, and localhost dev
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || config.allowedOrigin;
  const configuredOrigins = allowedOriginEnv
    ? allowedOriginEnv.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, server-to-server, health checks)
        if (!origin) return callback(null, true);

        // Allow wildcard or exact match in configured origins
        if (
          allowedOriginEnv === '*' ||
          configuredOrigins.includes(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }

        // Fallback: log and allow during preview / dev to prevent broken UI
        console.warn(`[CORS] Request from unexpected origin: ${origin}. Allowing for compatibility.`);
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Startup database & repository initialization wrapped in explicit error logging
  let problemRepo: PrismaProblemRepository;
  let attemptRepo: PrismaAttemptRepository;
  let submissionRepo: PrismaSubmissionRepository;
  let evaluationRepo: PrismaEvaluationRepository;

  try {
    console.log('[Startup] Initializing database and repositories...');
    if (process.env.DATABASE_URL && !options?.useStubAI) {
      await checkDatabaseConnection();
    }
    problemRepo = new PrismaProblemRepository();
    attemptRepo = new PrismaAttemptRepository();
    submissionRepo = new PrismaSubmissionRepository();
    evaluationRepo = new PrismaEvaluationRepository();

    // Seed problems at startup
    await seedProblems(problemRepo);
    console.log('[Startup] Database and problem repositories ready.');
  } catch (dbErr) {
    console.error('FATAL DATABASE / PRISMA INITIALIZATION ERROR:', dbErr);
    throw dbErr;
  }

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

  // Health-check endpoint for Render / load balancers
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // API Routes
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
  // On Render, process.env.PORT is assigned dynamically (e.g. 10000). Filter out 8080 for sandbox dev containers.
  const PORT = process.env.PORT && process.env.PORT !== '8080'
    ? parseInt(process.env.PORT, 10)
    : (config.port || 3000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`[LLD Practice Platform Backend] Running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start if not running under a test runner (e.g. vitest)
const isTestEnvironment = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
if (!isTestEnvironment) {
  startServer().catch((err) => {
    console.error('Fatal failure starting backend server:', err);
    process.exit(1);
  });
}
