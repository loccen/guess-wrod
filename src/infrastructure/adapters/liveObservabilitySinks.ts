import type { AnalyticsEvent, AnalyticsSink, ArchiveRecord, ArchiveSink, ArchiveWriteResult } from "../../usecases/ports/observability";

export class LiveAnalyticsSink implements AnalyticsSink {
  async track(event: AnalyticsEvent): Promise<void> {
    console.log("[analytics]", JSON.stringify(event));
  }
}

export class LiveArchiveSink implements ArchiveSink {
  async append(record: ArchiveRecord): Promise<ArchiveWriteResult> {
    const objectKey = `${record.stream}/${record.createdAt}`;
    console.log("[archive]", objectKey, JSON.stringify(record.payload));
    return { objectKey };
  }
}
