export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    counted?: boolean;
  };
};

export class FrontendApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly counted: boolean;

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.error.message ?? `请求失败，状态码 ${status}`);
    this.name = "FrontendApiError";
    this.code = payload?.error.code ?? "unknown_error";
    this.status = status;
    this.counted = payload?.error.counted ?? false;
  }
}

export type SessionCreateData = {
  visitor_id: string;
  session_token: string;
  expires_at: string;
};

export type SessionData = {
  visitor_id: string;
  expires_at: string;
  active_game_id: string | null;
};

export type CreateGameData = {
  game_id: string;
  mode: "random";
  status: string;
  guess_count: number;
  started_at: string;
  expires_at: string | null;
};

export type GameGuessData = {
  guess_id: string;
  guess: string;
  score: number | null;
  relation_type: string | null;
  source: string;
  counted: boolean;
  created_at: string;
};

export type GameStatusData = {
  game_id: string;
  status: string;
  expire_reason?: "ttl" | "guess_limit";
  guess_count: number;
  best_guess: {
    guess_id: string;
    guess: string;
    score: number | null;
  } | null;
  guesses: GameGuessData[];
  started_at: string;
  ended_at: string | null;
  answer?: string;
  answer_aliases?: string[];
};

export type SubmitGuessData = {
  guess_id: string;
  guess: string;
  normalized_guess: string;
  score: number;
  relation_type: string;
  is_exact: boolean;
  status: string;
  source: string;
  counted: boolean;
  guess_count: number;
  best_guess: {
    guess_id: string;
    guess: string;
    score: number;
  } | null;
  answer?: string;
};

export type GiveUpGameData = {
  game_id: string;
  status: string;
  answer: string;
  guess_count: number;
  ended_at: string;
};

export type SubmitFeedbackData = {
  success: true;
};

type RequestOptions = RequestInit & {
  token?: string | null;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const text = await response.text();
  const payload: ({ data?: T } & Partial<ApiErrorPayload>) | null = text ? JSON.parse(text) : null;
  if (!response.ok || !payload?.data) {
    throw new FrontendApiError(response.status, payload as ApiErrorPayload | undefined);
  }

  return payload.data;
}

export const apiClient = {
  getHealth(): Promise<{ service: string; status: string; timestamp: string }> {
    return requestJson("/api/health");
  },
  createSession(input: { clientTimezone: string | null; turnstileToken?: string | null }): Promise<SessionCreateData> {
    return requestJson("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        client_timezone: input.clientTimezone,
        ...(input.turnstileToken ? { turnstile_token: input.turnstileToken } : {})
      })
    });
  },
  getSession(token: string): Promise<SessionData> {
    return requestJson("/api/session", { token });
  },
  createGame(token: string): Promise<CreateGameData> {
    return requestJson("/api/games", {
      method: "POST",
      token,
      body: JSON.stringify({ mode: "random" })
    });
  },
  getGame(token: string, gameId: string): Promise<GameStatusData> {
    return requestJson(`/api/games/${encodeURIComponent(gameId)}`, { token });
  },
  submitGuess(token: string, gameId: string, guess: string): Promise<SubmitGuessData> {
    return requestJson(`/api/games/${encodeURIComponent(gameId)}/guesses`, {
      method: "POST",
      token,
      body: JSON.stringify({ guess })
    });
  },
  giveUpGame(token: string, gameId: string): Promise<GiveUpGameData> {
    return requestJson(`/api/games/${encodeURIComponent(gameId)}/give-up`, {
      method: "POST",
      token
    });
  },
  submitFeedback(
    token: string,
    gameId: string,
    input: {
      guessId: string;
      feedbackType: "score_unreasonable";
      note?: string | null;
    }
  ): Promise<SubmitFeedbackData> {
    return requestJson(`/api/games/${encodeURIComponent(gameId)}/feedback`, {
      method: "POST",
      token,
      body: JSON.stringify({
        guess_id: input.guessId,
        feedback_type: input.feedbackType,
        ...(input.note ? { note: input.note } : {})
      })
    });
  }
};
