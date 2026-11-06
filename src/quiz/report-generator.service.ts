import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LlmService } from '../llm/llm.service.js';
import type { SyllabusTopic } from '../syllabus/syllabus.data.js';
import type { Difficulty, ReportResponse } from './quiz.contract.js';
import type { QuestionResult } from './quiz-tokens.js';
import {
  buildReportPrompt,
  REPORT_INSTRUCTIONS,
  reportAdviceSchema,
  type ReportAdvice,
} from './prompts/report.prompt.js';
import {
  computeCoverage,
  computeScore,
  type ConceptCoverage,
} from './scoring.js';

const MAX_LIST_ITEMS = 6;

/**
 * Score and coverage are computed here in code; the LLM only writes the
 * advice around them.
 */
@Injectable()
export class ReportGeneratorService {
  constructor(
    private readonly llm: LlmService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ReportGeneratorService.name);
  }

  async generate(input: {
    topic: SyllabusTopic;
    difficulty: Difficulty;
    results: QuestionResult[];
    abortSignal?: AbortSignal;
  }): Promise<ReportResponse> {
    const { topic, difficulty, results } = input;
    const score = computeScore(results);
    const coverage = computeCoverage(topic.concepts, results);

    const { output } = await this.llm.runStructured('report-generate', {
      schema: reportAdviceSchema,
      instructions: REPORT_INSTRUCTIONS,
      prompt: buildReportPrompt({
        topic,
        difficulty,
        score,
        coverage,
        results,
      }),
      context: {
        topicId: topic.id,
        difficulty,
        questions: results.length,
        percent: score.percent,
      },
      semanticCheck: (advice) =>
        advice.summary.trim().length > 0 ? null : 'empty summary',
      abortSignal: input.abortSignal,
    });

    const improvementPlan = buildImprovementPlan(topic, coverage, output);
    this.logger.debug(
      {
        topicId: topic.id,
        planned: improvementPlan.map((p) => p.conceptId),
      },
      'Improvement plan assembled',
    );

    return {
      score,
      coverage: coverage.map(({ conceptId, name, status, questionsAsked }) => ({
        conceptId,
        name,
        status,
        questionsAsked,
      })),
      summary: output.summary.trim(),
      strengths: tidy(output.strengths),
      weaknesses: tidy(output.weaknesses),
      improvementPlan,
      nextSteps: tidy(output.nextSteps),
    };
  }
}

const tidy = (items: string[]) =>
  items
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);

/**
 * Guarantees one plan entry per weak or not-covered concept (weak first,
 * weakest first), using the LLM's entry when it wrote one and a
 * syllabus-based fallback otherwise. Names always come from the syllabus.
 * Extra LLM entries for strong concepts are kept after them.
 */
export function buildImprovementPlan(
  topic: SyllabusTopic,
  coverage: ConceptCoverage[],
  advice: Pick<ReportAdvice, 'improvementPlan'>,
): ReportResponse['improvementPlan'] {
  const byConcept = new Map<string, ReportAdvice['improvementPlan'][number]>();
  for (const entry of advice.improvementPlan) {
    const id = entry.conceptId.trim();
    if (!byConcept.has(id)) byConcept.set(id, entry);
  }
  const conceptById = new Map(topic.concepts.map((c) => [c.id, c]));

  const needsWork = coverage
    .filter((c) => c.status !== 'strong')
    .sort(
      (a, b) =>
        (a.status === 'weak' ? 0 : 1) - (b.status === 'weak' ? 0 : 1) ||
        (a.averageScore ?? 0) - (b.averageScore ?? 0),
    );
  const strongWithAdvice = coverage.filter(
    (c) => c.status === 'strong' && byConcept.has(c.conceptId),
  );

  return [...needsWork, ...strongWithAdvice].map((c) => {
    const entry = byConcept.get(c.conceptId);
    const concept = conceptById.get(c.conceptId);
    const whatToStudy = entry ? tidy(entry.whatToStudy) : [];
    const practiceIdeas = entry ? tidy(entry.practiceIdeas) : [];
    return {
      conceptId: c.conceptId,
      name: c.name,
      why:
        entry?.why.trim() ||
        (c.status === 'weak'
          ? `Your answers on ${c.name} showed gaps.`
          : `${c.name} wasn't covered in this quiz.`),
      whatToStudy:
        whatToStudy.length > 0
          ? whatToStudy
          : [concept?.description ?? `Review the fundamentals of ${c.name}.`],
      practiceIdeas:
        practiceIdeas.length > 0
          ? practiceIdeas
          : [`Start a quiz focused on ${c.name} with "Practise weak areas".`],
    };
  });
}
