import type { AnalyticsEvent, AnalyticsSink, ArchiveRecord, ArchiveSink, ArchiveWriteResult } from "../../usecases/ports/observability";

export class LiveAnalyticsSink implements AnalyticsSink {
  async track(event: AnalyticsEvent): Promise<void> {
    console.log("[analytics]", JSON.stringify(event));
  }
}

export class LiveArchiveSink implements ArchiveSink {
  constructor(private readonly bucket: R2Bucket) {}

  async append(record: ArchiveRecord): Promise<ArchiveWriteResult> {
    const objectKey = `${record.stream}/${record.createdAt}`;
    const body = JSON.stringify({
      stream: record.stream,
      created_at: record.createdAt,
      payload: record.payload
    });
    await this.bucket.put(objectKey, body, {
      httpMetadata: {
        contentType: "application/json"
      }
    });
    return { objectKey };
  }
}
