import type { AnalyticsEvent, AnalyticsSink } from "../../usecases/ports/observability";

export class CompositeAnalyticsSink implements AnalyticsSink {
  constructor(private readonly sinks: AnalyticsSink[]) {}

  async track(event: AnalyticsEvent): Promise<void> {
    await Promise.all(this.sinks.map(async (sink) => sink.track(event)));
  }
}
