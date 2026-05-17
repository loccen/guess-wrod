import type { ValueHasher } from "../../usecases/services/platformPorts";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export class Sha256ValueHasher implements ValueHasher {
  async hash(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return toHex(digest);
  }
}
