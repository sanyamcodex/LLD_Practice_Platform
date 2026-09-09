import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../../config/env';
import { LLMClient, LLMClientEvaluationRequest, LLMClientEvaluationResponse } from '../../domain/ports/LLMClient';

export interface ModelPlan {
  model: string;
  timeoutMs: number;
  maxAttempts: number;
  isPrimary: boolean;
}

export interface GeminiClientOptions {
  apiKey?: string;
  primaryModel?: string;
  primaryTimeoutMs?: number;
  primaryMaxAttempts?: number;
  fallbackModel?: string;
  fallbackTimeoutMs?: number;
  fallbackMaxAttempts?: number;
  backoffBaseMs?: number;
  aiClient?: any;
}

export function is503OrUnavailable(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.code || err?.statusCode;
  if (status === 503 || status === 'UNAVAILABLE') return true;
  const msg = `${err?.message || ''} ${err?.statusText || ''} ${typeof err === 'string' ? err : ''}`.toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('temporarily overloaded') ||
    msg.includes('service unavailable')
  );
}

export function isTransientError(err: any): boolean {
  if (is503OrUnavailable(err)) return true;
  const status = err?.status || err?.code || err?.statusCode;
  if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
  const msg = `${err?.message || ''} ${err?.statusText || ''} ${typeof err === 'string' ? err : ''}`.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * GeminiClient
 * Implements LLMClient port with resilient multi-model cascading fallback,
 * bounded retries with exponential backoff on HTTP 503 / UNAVAILABLE, and per-call timeouts.
 */
export class GeminiClient implements LLMClient {
  private ai: any = null;
  public readonly options: Required<Omit<GeminiClientOptions, 'apiKey' | 'aiClient'>> & { apiKey?: string };

  constructor(options: GeminiClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey,
      primaryModel: options.primaryModel || 'gemini-3.8-flash',
      primaryTimeoutMs: options.primaryTimeoutMs ?? 9000,
      primaryMaxAttempts: options.primaryMaxAttempts ?? 2,
      fallbackModel: options.fallbackModel || 'gemini-3.7-flash',
      fallbackTimeoutMs: options.fallbackTimeoutMs ?? 8000,
      fallbackMaxAttempts: options.fallbackMaxAttempts ?? 1,
      backoffBaseMs: options.backoffBaseMs ?? 1000,
    };
    if (options.aiClient) {
      this.ai = options.aiClient;
    }
  }

  private getClient(): any {
    if (!this.ai) {
      const apiKey = this.options.apiKey || config.geminiApiKey;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the environment.');
      }
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.ai;
  }

  async evaluateDesign(request: LLMClientEvaluationRequest): Promise<LLMClientEvaluationResponse> {
    const ai = this.getClient();
    const { problem, submission, rubric } = request;
    const content = submission.contentSnapshot;

    const criteriaPrompt = rubric.criteria
      .map((c) => `- Key: "${c.key}" | Label: "${c.label}" | Description: ${c.description}`)
      .join('\n');

    const futureReqsPrompt = problem.futureRequirements
      .map((fr, i) => `Future Requirement ${i + 1}: ${fr}`)
      .join('\n');

    const prompt = `You are a Senior Principal Software Architect and Low-Level Design (LLD) Evaluator.
Your goal is to perform a rigorous, constructive, and evidence-grounded assessment of a software engineer's object-oriented low-level design.

### PROBLEM STATEMENT
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description & Constraints:
${problem.description}

### STATED FUTURE REQUIREMENTS (For Extensibility Test)
${futureReqsPrompt}

### LEARNER'S SUBMITTED DESIGN ARTIFACT
[SECTION 1: ASSUMPTIONS & SCOPE]
${content.assumptions || '(None provided)'}

[SECTION 2: CORE CLASSES, INTERFACES & RESPONSIBILITIES]
${content.classesAndResponsibilities || '(None provided)'}

[SECTION 3: RELATIONSHIPS & COMPONENT INTERACTIONS]
${content.relationships || '(None provided)'}

[SECTION 4: EXTENSIBILITY & FUTURE REQUIREMENTS STRATEGY]
${content.extensibilityAnswer || '(None provided)'}

### EVALUATION CRITERIA (EVALUATE EXACTLY THESE 7 CRITERIA)
${criteriaPrompt}

### STRICT EVALUATION GUIDELINES
1. Ground EVERY criterion score in direct, quoted evidence from the submission (use "quotations"). If evidence is missing, state that clearly as the evidence.
2. Score each criterion between 0 and 5:
   - 0-1: Completely missing, fatally flawed, or God class architecture.
   - 2-3: Basic functional attempt, but suffers from tight coupling, missing abstraction, or SRP violations.
   - 4: Solid professional design with clear interfaces, low coupling, and sound trade-offs.
   - 5: Exemplary architectural craftsmanship gracefully absorbing future requirements.
3. Be candid, educational, and specific in 'concern' and 'suggestion'. Never output generic boilerplate.
4. Output structured JSON matching the provided schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        overallSummary: {
          type: Type.STRING,
          description: 'A 2-3 sentence executive synthesis of the design strengths, architectural risks, and main recommendation.',
        },
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              criterionKey: {
                type: Type.STRING,
                description: 'One of the 7 fixed rubric criterion keys (e.g. requirement_understanding, class_responsibilities, coupling_cohesion, encapsulation_interfaces, abstraction_pattern_use, extensibility, explanation_quality)',
              },
              score: {
                type: Type.INTEGER,
                description: 'Integer score from 0 to 5',
              },
              evidence: {
                type: Type.STRING,
                description: 'Direct quote or concrete citation from the submission justifying the score',
              },
              concern: {
                type: Type.STRING,
                description: 'Specific vulnerability, architectural smell, or unhandled requirement',
              },
              suggestion: {
                type: Type.STRING,
                description: 'Concrete actionable design improvement or pattern refactoring advice',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence score between 0.0 and 1.0',
              },
            },
            required: ['criterionKey', 'score', 'evidence', 'concern', 'suggestion', 'confidence'],
          },
        },
      },
      required: ['overallSummary', 'results'],
    };

    // Candidate models in strict preference order:
    // 1. Primary model (gemini-3.8-flash, 9s timeout, 2 attempts max with exponential backoff on 503)
    // 2. Fallback stable model (gemini-3.7-flash, 8s timeout, 1 short attempt, NO -latest alias)
    const modelPlans: ModelPlan[] = [
      {
        model: this.options.primaryModel,
        timeoutMs: this.options.primaryTimeoutMs,
        maxAttempts: this.options.primaryMaxAttempts,
        isPrimary: true,
      },
      {
        model: this.options.fallbackModel,
        timeoutMs: this.options.fallbackTimeoutMs,
        maxAttempts: this.options.fallbackMaxAttempts,
        isPrimary: false,
      },
    ];

    let lastError: any = null;

    for (let planIndex = 0; planIndex < modelPlans.length; planIndex++) {
      const plan = modelPlans[planIndex];

      if (!plan.isPrimary) {
        console.log(`[GeminiClient] Primary model ${modelPlans[0].model} failed. Fallback model invoked: ${plan.model}...`);
      }

      for (let attempt = 1; attempt <= plan.maxAttempts; attempt++) {
        try {
          console.log(`[GeminiClient] API request started for model ${plan.model} (attempt ${attempt}/${plan.maxAttempts}, timeout ${plan.timeoutMs}ms)...`);

          const generatePromise = ai.models.generateContent({
            model: plan.model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are an authoritative Low-Level Design evaluator. Always provide constructive, evidence-based feedback formatted as valid JSON adhering to the exact responseSchema.',
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const response = await withTimeout<any>(
            generatePromise,
            plan.timeoutMs,
            `Gemini API request (${plan.model})`
          );

          const text = response?.text;
          if (!text) {
            throw new Error(`Empty response received from Gemini API with model ${plan.model}`);
          }

          const parsed = JSON.parse(text) as LLMClientEvaluationResponse;
          parsed.modelUsed = plan.model;
          console.log(`[GeminiClient] Final AI success: Received valid evaluation from model ${plan.model}.`);
          return parsed;
        } catch (err: any) {
          lastError = err;

          if (is503OrUnavailable(err)) {
            console.warn(`[GeminiClient] HTTP 503 UNAVAILABLE received for model ${plan.model} (attempt ${attempt}/${plan.maxAttempts}): ${err?.message || err}`);
          } else {
            console.warn(`[GeminiClient] Model ${plan.model} attempt ${attempt}/${plan.maxAttempts} failed: ${err?.message || err}`);
          }

          if (attempt < plan.maxAttempts && isTransientError(err)) {
            const delayMs = this.options.backoffBaseMs * Math.pow(2, attempt - 1);
            console.log(`[GeminiClient] Retrying primary model ${plan.model} after backoff of ${delayMs}ms (attempt ${attempt + 1}/${plan.maxAttempts})...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // No more retries for this model
            break;
          }
        }
      }
    }

    const modelNames = modelPlans.map((p) => p.model).join(', ');
    console.error(`[GeminiClient] Final AI failure: All candidate models (${modelNames}) failed or unavailable.`);
    throw lastError || new Error(`All candidate AI models (${modelNames}) failed.`);
  }
}
