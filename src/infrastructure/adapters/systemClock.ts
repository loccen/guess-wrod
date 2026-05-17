import type { Clock } from "../../usecases/services/platformPorts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
