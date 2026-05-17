import type {
  AiCallLog,
  Game,
  GameExpireReason,
  GameStatus,
  Guess,
  NewAiCallLog,
  NewGame,
  NewGuess,
  NewScoreCacheEntry,
  NewScoreFeedback,
  NewSession,
  NewVisitor,
  NewWord,
  ScoreCacheEntry,
  ScoreFeedback,
  Session,
  Visitor,
  Word,
  WordDifficulty
} from "../../domain/models/storage";

export interface SessionRepository {
  upsertVisitor(visitor: NewVisitor): Promise<void>;
  touchVisitor(visitorId: string, lastSeenAt: string): Promise<void>;
  createSession(session: NewSession): Promise<void>;
  findVisitorById(visitorId: string): Promise<Visitor | null>;
  findSessionById(sessionId: string): Promise<Session | null>;
  findSessionByTokenHash(sessionTokenHash: string): Promise<Session | null>;
  revokeSession(sessionId: string, revokedAt: string): Promise<void>;
}

export interface WordRepository {
  upsertWord(word: NewWord): Promise<void>;
  findWordById(wordId: string): Promise<Word | null>;
  findEnabledWordByNormalized(wordNormalized: string): Promise<Word | null>;
  listEnabledWords(options?: { difficulty?: WordDifficulty; limit?: number }): Promise<Word[]>;
}

export interface GameRepository {
  createGame(game: NewGame): Promise<void>;
  findGameById(gameId: string): Promise<Game | null>;
  listGamesByVisitor(visitorId: string, options?: { status?: GameStatus; limit?: number }): Promise<Game[]>;
  incrementGuessCount(gameId: string, amount?: number): Promise<void>;
  updateBestGuess(gameId: string, bestGuessId: string | null): Promise<void>;
  finishGame(gameId: string, status: Exclude<GameStatus, "playing">, endedAt: string, expireReason?: GameExpireReason | null): Promise<void>;
}

export interface GuessRepository {
  createGuess(guess: NewGuess): Promise<void>;
  findGuessById(guessId: string): Promise<Guess | null>;
  findCountedGuessByGameAndNormalized(gameId: string, guessNormalized: string): Promise<Guess | null>;
  listGuessesByGame(gameId: string, options?: { limit?: number }): Promise<Guess[]>;
}

export interface ScoreCacheRepository {
  putScoreCache(entry: NewScoreCacheEntry): Promise<void>;
  findScoreCache(params: {
    answerId: string;
    guessNormalized: string;
    ruleVersion: string;
    modelName: string;
    thinkingMode: string;
  }): Promise<ScoreCacheEntry | null>;
  recordScoreCacheHit(cacheKey: string, hitAt: string): Promise<void>;
}

export interface FeedbackRepository {
  createFeedback(feedback: NewScoreFeedback): Promise<void>;
  findFeedbackById(feedbackId: string): Promise<ScoreFeedback | null>;
  listFeedbackByGuess(guessId: string, options?: { limit?: number }): Promise<ScoreFeedback[]>;
}

export interface AiCallLogRepository {
  createAiCallLog(log: NewAiCallLog): Promise<void>;
  findAiCallLogById(logId: string): Promise<AiCallLog | null>;
  listAiCallLogsByGame(gameId: string, options?: { limit?: number }): Promise<AiCallLog[]>;
}

export interface StorageRepositories {
  sessions: SessionRepository;
  words: WordRepository;
  games: GameRepository;
  guesses: GuessRepository;
  scoreCache: ScoreCacheRepository;
  feedback: FeedbackRepository;
  aiCallLogs: AiCallLogRepository;
}
