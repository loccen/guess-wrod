import type { IdGenerator } from "../../usecases/services/platformPorts";

export class CryptoIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
}
