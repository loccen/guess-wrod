import type { RandomSource } from "../../usecases/services/platformPorts";

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
