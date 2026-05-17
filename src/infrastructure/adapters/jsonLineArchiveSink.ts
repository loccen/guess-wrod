import type { ArchiveRecord, ArchiveSink, ArchiveWriteResult } from "../../usecases/ports/observability";

export interface JsonLineWriter {
  append(relativePath: string, line: string): Promise<void>;
}

function dayFromIsoDateTime(value: string): string {
  const day = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day;
  }

  return "unknown-date";
}

function pathForRecord(record: ArchiveRecord): string {
  const day = dayFromIsoDateTime(record.createdAt);
  if (record.stream === "guess_events") {
    return `events/${day}/guess-events.jsonl`;
  }

  return `ai-calls/${day}/ai-call-logs.jsonl`;
}

export class JsonLineArchiveSink implements ArchiveSink {
  constructor(private readonly writer: JsonLineWriter) {}

  async append(record: ArchiveRecord): Promise<ArchiveWriteResult> {
    const objectKey = pathForRecord(record);
    const line = JSON.stringify({
      created_at: record.createdAt,
      ...record.payload
    });
    await this.writer.append(objectKey, `${line}\n`);

    return { objectKey };
  }
}
