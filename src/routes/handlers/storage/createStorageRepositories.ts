import { createSqliteStorageRepositories } from "../../../infrastructure/adapters/storage/sqliteStorageRepositories";
import type { SqlExecutor } from "../../../infrastructure/adapters/storage/sqlExecutor";
import type { StorageRepositories } from "../../../usecases/repositories/storageRepositories";

export interface StorageBindings {
  DB?: SqlExecutor;
  R2_LOG_BUCKET?: R2Bucket;
}

export function createStorageRepositories(env: StorageBindings): StorageRepositories {
  if (!env.DB) {
    throw new Error("DB binding is required to create storage repositories.");
  }

  return createSqliteStorageRepositories(env.DB);
}
