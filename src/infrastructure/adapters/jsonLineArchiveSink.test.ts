import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { JsonLineArchiveSink, type JsonLineWriter } from "./jsonLineArchiveSink";

class FileWriter implements JsonLineWriter {
  constructor(private readonly rootDir: string) {}

  async append(relativePath: string, line: string): Promise<void> {
    const absolutePath = join(this.rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    const previous = await readFile(absolutePath, "utf8").catch(() => "");
    await writeFile(absolutePath, previous + line, "utf8");
  }
}

describe("JsonLineArchiveSink", () => {
  it("writes archive records into daily jsonl files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "guess-wrod-archive-"));
    const sink = new JsonLineArchiveSink(new FileWriter(rootDir));

    const eventResult = await sink.append({
      stream: "guess_events",
      createdAt: "2026-05-17T10:00:00.000Z",
      payload: {
        event_name: "guess_submitted",
        game_id: "game_1"
      }
    });
    const aiCallResult = await sink.append({
      stream: "ai_call_logs",
      createdAt: "2026-05-17T10:00:00.000Z",
      payload: {
        id: "ai_call_1",
        status: "success"
      }
    });

    expect(eventResult.objectKey).toBe("events/2026-05-17/guess-events.jsonl");
    expect(aiCallResult.objectKey).toBe("ai-calls/2026-05-17/ai-call-logs.jsonl");

    const eventFile = await readFile(join(rootDir, "events/2026-05-17/guess-events.jsonl"), "utf8");
    const aiCallFile = await readFile(join(rootDir, "ai-calls/2026-05-17/ai-call-logs.jsonl"), "utf8");

    expect(eventFile).toContain("\"event_name\":\"guess_submitted\"");
    expect(eventFile).toContain("\"created_at\":\"2026-05-17T10:00:00.000Z\"");
    expect(aiCallFile).toContain("\"id\":\"ai_call_1\"");
    expect(aiCallFile).toContain("\"status\":\"success\"");
  });
});
