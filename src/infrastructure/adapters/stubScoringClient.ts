import type { AiScoringClient, AiScoringRequest } from "../../usecases/scoring/scoringGateway";

export interface StubScoringRule {
  guess: string;
  response: unknown;
}

export class StubScoringClient implements AiScoringClient {
  private readonly responsesByGuess: ReadonlyMap<string, unknown>;

  constructor(rules: StubScoringRule[] = []) {
    this.responsesByGuess = new Map(rules.map((rule) => [rule.guess, rule.response]));
  }

  async score(request: AiScoringRequest): Promise<unknown> {
    const configuredResponse = this.responsesByGuess.get(request.guess);
    if (configuredResponse !== undefined) {
      return configuredResponse;
    }

    return {
      score: request.guess === request.answer ? 100 : 18,
      relation_type: request.guess === request.answer ? "exact" : "unrelated",
      is_exact: request.guess === request.answer,
      reason: "stub scoring client used for local development.",
      confidence: 0.5,
    };
  }
}
