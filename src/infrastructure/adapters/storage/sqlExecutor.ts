export type SqlValue = string | number | boolean | null;

export interface SqlResult {
  success?: boolean;
  meta?: unknown;
}

export interface SqlQueryResult<Row> {
  results?: Row[];
}

export interface SqlPreparedStatement {
  bind(...values: SqlValue[]): SqlPreparedStatement;
  first<Row = Record<string, unknown>>(): Promise<Row | null>;
  all<Row = Record<string, unknown>>(): Promise<SqlQueryResult<Row>>;
  run(): Promise<SqlResult>;
}

export interface SqlExecutor {
  prepare(sql: string): SqlPreparedStatement;
}
