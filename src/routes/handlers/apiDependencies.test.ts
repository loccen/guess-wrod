import { describe, expect, it } from "vitest";
import { createAppServices, type ApiRuntimeEnv } from "./apiDependencies";

function createDbStub(): D1Database {
  return {
    prepare() {
      throw new Error("not implemented in this test");
    },
    batch() {
      throw new Error("not implemented in this test");
    },
    exec() {
      throw new Error("not implemented in this test");
    },
    dump() {
      throw new Error("not implemented in this test");
    }
  } as unknown as D1Database;
}

describe("createAppServices", () => {
  it("throws when ARCHIVE_MODE=live but R2 bucket binding is missing", () => {
    const env = {
      DB: createDbStub(),
      ARCHIVE_MODE: "live"
    } satisfies ApiRuntimeEnv;

    expect(() => createAppServices(env)).toThrowError(
      "R2_LOG_BUCKET binding is required when ARCHIVE_MODE=live."
    );
  });
});
