import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from 'pg';

type StatementParams = Record<string, unknown>;
type DatabaseClient = Pool | PoolClient;

interface PreparedQuery {
  all<T extends QueryResultRow = QueryResultRow>(
    params?: StatementParams,
  ): Promise<T[]>;
  get<T extends QueryResultRow = QueryResultRow>(
    params?: StatementParams,
  ): Promise<T | undefined>;
  run(params?: StatementParams): Promise<QueryResult>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly transactionStorage = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('database.url');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for PostgreSQL runtime.');
    }

    if (
      !databaseUrl.startsWith('postgres://') &&
      !databaseUrl.startsWith('postgresql://')
    ) {
      throw new Error(
        `Unsupported DATABASE_URL for PostgreSQL runtime: ${databaseUrl}`,
      );
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
    });

    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `PostgreSQL runtime initialization failed for ${databaseUrl}. ${message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  prepare(sql: string): PreparedQuery {
    return {
      all: <T extends QueryResultRow = QueryResultRow>(params?: StatementParams) =>
        this.query<T>(sql, params),
      get: async <T extends QueryResultRow = QueryResultRow>(
        params?: StatementParams,
      ): Promise<T | undefined> => {
        const rows = await this.query<T>(sql, params);
        return rows[0];
      },
      run: (params?: StatementParams) => this.execute(sql, params),
    };
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await this.transactionStorage.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * True when the current async context is executing inside `transaction()`.
   * Lets a service assert that its multi-statement write is atomic before it
   * runs — guarding against partial writes / data drift.
   */
  isTransactionActive(): boolean {
    return this.transactionStorage.getStore() !== undefined;
  }

  private async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: StatementParams,
  ): Promise<T[]> {
    const result = await this.execute(sql, params);
    return result.rows as T[];
  }

  private async execute(
    sql: string,
    params?: StatementParams,
  ): Promise<QueryResult> {
    const client = this.getActiveClient();
    const statement = this.compileStatement(sql, params);
    return client.query(statement.text, statement.values);
  }

  private compileStatement(sql: string, params?: StatementParams) {
    const values: unknown[] = [];
    const indexes = new Map<string, number>();

    const text = sql.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key: string) => {
      const namedKey = `$${key}`;
      if (!params || (!(key in params) && !(namedKey in params))) {
        throw new Error(`Missing SQL parameter: $${key}`);
      }

      if (!indexes.has(key)) {
        indexes.set(key, values.length + 1);
        values.push(key in params ? params[key] : params[namedKey]);
      }

      return `$${indexes.get(key)}`;
    });

    return {
      text,
      values,
    };
  }

  private getActiveClient(): DatabaseClient {
    return this.transactionStorage.getStore() ?? this.getPool();
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL database has not been initialized.');
    }

    return this.pool;
  }
}
