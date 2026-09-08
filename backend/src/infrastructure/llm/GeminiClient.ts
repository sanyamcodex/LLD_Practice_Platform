import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../../config/env';
import { LLMClient, LLMClientEvaluationRequest, LLMClientEvaluationResponse } from '../../domain/ports/LLMClient';

/**
 * GeminiClient
 * Implements LLMClient port.
 * Communicates with Google Gemini API requesting structured JSON output conforming to the 7-criterion rubric.
 * Uses official @google/genai SDK on the server side with structured responseSchema.
 */
export class GeminiClient implements LLMClient {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = config.geminiApiKey;
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

    // Candidate models in preference order: primary gemini-3.8-flash, followed by robust fallbacks
    const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    const isTransient = (err: any): boolean => {
      const msg = `${err?.message || ''} ${typeof err === 'string' ? err : JSON.stringify(err)}`;
      const status = err?.status || err?.code || err?.statusCode;
      return (
        status === 503 ||
        status === 429 ||
        status === 'UNAVAILABLE' ||
        status === 'RESOURCE_EXHAUSTED' ||
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('temporarily') ||
        msg.includes('exhausted')
      );
    };

    for (const model of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are an authoritative Low-Level Design evaluator. Always provide constructive, evidence-based feedback formatted as valid JSON adhering to the exact responseSchema.',
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error(`Empty response received from Gemini API with model ${model}`);
          }

          const parsed = JSON.parse(text) as LLMClientEvaluationResponse;
          return parsed;
        } catch (err: any) {
          lastError = err;
          console.warn(`[GeminiClient] Model ${model} attempt ${attempt} failed:`, err?.message || err);

          if (attempt === 1 && isTransient(err)) {
            // Brief backoff before re-attempting with the same model
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            // Move on to the next candidate model
            break;
          }
        }
      }
    }

    throw lastError || new Error('All candidate Gemini models failed evaluation.');
  }
}
