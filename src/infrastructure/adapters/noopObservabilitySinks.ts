import type { AnalyticsEvent, AnalyticsSink, ArchiveRecord, ArchiveSink, ArchiveWriteResult } from "../../usecases/ports/observability";

const NOOP_ARCHIVE_RESULT: ArchiveWriteResult = {
  objectKey: null
};

export class NoopAnalyticsSink implements AnalyticsSink {
  async track(_event: AnalyticsEvent): Promise<void> {}
}

export class NoopArchiveSink implements ArchiveSink {
  async append(_record: ArchiveRecord): Promise<ArchiveWriteResult> {
    return NOOP_ARCHIVE_RESULT;
  }
}
