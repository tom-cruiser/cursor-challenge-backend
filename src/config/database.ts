import { Pool, types } from 'pg';
import { env } from './env';

/**
 * Local PostgreSQL access (node-postgres) behind a small query builder that
 * mirrors the subset of the supabase-js API the services use:
 * select (with to-one embeds), insert, update, upsert, delete, eq/neq/in/
 * lt/lte/gt/gte/is, order, limit, single, maybeSingle and head counts.
 * Results have the shape { data, error, count }.
 */

// Match PostgREST output: DATE stays 'YYYY-MM-DD', timestamps are ISO strings,
// int8/numeric become JS numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1184, (v) => new Date(v).toISOString());
types.setTypeParser(1114, (v) => new Date(`${v}Z`).toISOString());
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  // Keep embedded (row_to_json) timestamps in UTC, matching top-level columns.
  options: '-c timezone=UTC',
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[database] Unexpected pool error:', err);
});

export interface DbError {
  code?: string;
  message: string;
  details?: string;
}

// Rows are untyped, like supabase-js used without generated types.
type Row = Record<string, any>;

export interface DbResult<T = Row[] | null> {
  data: T;
  error: DbError | null;
  count?: number | null;
}

// ---------------------------------------------------------------------------
// Foreign-key metadata (for to-one embeds such as `child:children(id, name)`)
// ---------------------------------------------------------------------------

interface ForeignKey {
  name: string;
  srcTable: string;
  srcCol: string;
  tgtTable: string;
  tgtCol: string;
}

let fkCache: Promise<ForeignKey[]> | null = null;

function loadForeignKeys(): Promise<ForeignKey[]> {
  if (!fkCache) {
    fkCache = pool
      .query(
        `SELECT c.conname AS name, s.relname AS "srcTable", sa.attname AS "srcCol",
                t.relname AS "tgtTable", ta.attname AS "tgtCol"
           FROM pg_constraint c
           JOIN pg_class s ON s.oid = c.conrelid
           JOIN pg_class t ON t.oid = c.confrelid
           JOIN pg_attribute sa ON sa.attrelid = c.conrelid AND sa.attnum = c.conkey[1]
           JOIN pg_attribute ta ON ta.attrelid = c.confrelid AND ta.attnum = c.confkey[1]
          WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`,
      )
      .then((r) => r.rows as ForeignKey[])
      .catch((err) => {
        fkCache = null;
        throw err;
      });
  }
  return fkCache;
}

// ---------------------------------------------------------------------------
// Select-string parsing:  "id, name, child:children!inner(id, parent:users(*))"
// ---------------------------------------------------------------------------

interface ColumnItem {
  kind: 'column';
  name: string;
}
interface EmbedItem {
  kind: 'embed';
  alias: string;
  table: string;
  hint?: string;
  inner: boolean;
  items: SelectItem[];
}
type SelectItem = ColumnItem | EmbedItem;

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(input: string): SelectItem[] {
  return splitTopLevel(input).map((part): SelectItem => {
    const open = part.indexOf('(');
    if (open === -1) return { kind: 'column', name: part };

    const head = part.slice(0, open).trim();
    const body = part.slice(open + 1, part.lastIndexOf(')'));
    const [aliasPart, rest] = head.includes(':') ? head.split(':') : [null, head];
    const [table, ...mods] = rest.split('!');
    const inner = mods.includes('inner');
    const hint = mods.find((m) => m !== 'inner');

    return {
      kind: 'embed',
      alias: aliasPart ?? table,
      table,
      hint,
      inner,
      items: parseSelect(body),
    };
  });
}

const ident = (name: string): string => `"${name.replace(/"/g, '""')}"`;

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Filter = { col: string; op: string; value: unknown };

class QueryBuilder implements PromiseLike<DbResult> {
  private op: Op = 'select';
  private selectStr: string | null = null;
  private returning = false;
  private head = false;
  private wantCount = false;
  private filters: Filter[] = [];
  private orders: Array<{ col: string; ascending: boolean }> = [];
  private limitN: number | null = null;
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private onConflict: string | null = null;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private aliasCounter = 0;

  constructor(private readonly table: string) {}

  select(columns = '*', opts: { count?: 'exact'; head?: boolean } = {}): this {
    this.selectStr = columns;
    if (this.op !== 'select') this.returning = true;
    if (opts.count) this.wantCount = true;
    if (opts.head) this.head = true;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = 'insert';
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts: { onConflict?: string } = {},
  ): this {
    this.op = 'upsert';
    this.rows = Array.isArray(values) ? values : [values];
    this.onConflict = opts.onConflict ?? 'id';
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.op = 'update';
    this.patch = values;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  eq(col: string, value: unknown): this {
    return this.addFilter(col, '=', value);
  }
  neq(col: string, value: unknown): this {
    return this.addFilter(col, '<>', value);
  }
  gt(col: string, value: unknown): this {
    return this.addFilter(col, '>', value);
  }
  gte(col: string, value: unknown): this {
    return this.addFilter(col, '>=', value);
  }
  lt(col: string, value: unknown): this {
    return this.addFilter(col, '<', value);
  }
  lte(col: string, value: unknown): this {
    return this.addFilter(col, '<=', value);
  }
  in(col: string, values: unknown[]): this {
    return this.addFilter(col, 'in', values);
  }
  is(col: string, value: null | boolean): this {
    return this.addFilter(col, 'is', value);
  }

  order(col: string, opts: { ascending?: boolean } = {}): this {
    this.orders.push({ col, ascending: opts.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): PromiseLike<DbResult<Row | null>> {
    this.mode = 'single';
    return this as unknown as PromiseLike<DbResult<Row | null>>;
  }

  maybeSingle(): PromiseLike<DbResult<Row | null>> {
    this.mode = 'maybeSingle';
    return this as unknown as PromiseLike<DbResult<Row | null>>;
  }

  then<R1 = DbResult, R2 = never>(
    onfulfilled?: ((value: DbResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  // -- internals ------------------------------------------------------------

  private addFilter(col: string, op: string, value: unknown): this {
    this.filters.push({ col, op, value });
    return this;
  }

  private nextAlias(): string {
    return `t${this.aliasCounter++}`;
  }

  private buildWhere(alias: string, params: unknown[], extra: string[] = []): string {
    const clauses = [...extra];
    for (const f of this.filters) {
      const col = `${alias}.${ident(f.col)}`;
      if (f.op === 'in') {
        const list = f.value as unknown[];
        if (list.length === 0) {
          clauses.push('FALSE');
        } else {
          params.push(list);
          clauses.push(`${col} = ANY($${params.length})`);
        }
      } else if (f.op === 'is') {
        clauses.push(
          f.value === null ? `${col} IS NULL` : `${col} IS ${f.value ? 'TRUE' : 'FALSE'}`,
        );
      } else {
        params.push(f.value);
        clauses.push(`${col} ${f.op} $${params.length}`);
      }
    }
    return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  }

  private async resolveEmbed(
    baseTable: string,
    embed: EmbedItem,
  ): Promise<ForeignKey> {
    const fks = await loadForeignKeys();
    const candidates = fks.filter((fk) => fk.srcTable === baseTable && fk.tgtTable === embed.table);
    if (candidates.length === 0) {
      throw new Error(`No to-one relationship from "${baseTable}" to "${embed.table}"`);
    }
    if (embed.hint) {
      const hinted = candidates.find((fk) => fk.name === embed.hint || fk.srcCol === embed.hint);
      if (hinted) return hinted;
    }
    return (
      candidates.find((fk) => fk.srcCol.startsWith(embed.alias)) ??
      candidates[0]
    );
  }

  private async buildColumns(
    baseTable: string,
    alias: string,
    items: SelectItem[],
    innerConds: string[],
  ): Promise<string> {
    const cols: string[] = [];
    for (const item of items) {
      if (item.kind === 'column') {
        cols.push(item.name === '*' ? `${alias}.*` : `${alias}.${ident(item.name)}`);
        continue;
      }
      const fk = await this.resolveEmbed(baseTable, item);
      const e = this.nextAlias();
      const inner = this.nextAlias();
      const nestedInner: string[] = [];
      const nested = await this.buildColumns(item.table, e, item.items, nestedInner);
      const where = [`${e}.${ident(fk.tgtCol)} = ${alias}.${ident(fk.srcCol)}`, ...nestedInner];
      cols.push(
        `(SELECT row_to_json(${inner}) FROM (SELECT ${nested} FROM ${ident(item.table)} ${e} ` +
          `WHERE ${where.join(' AND ')} LIMIT 1) ${inner}) AS ${ident(item.alias)}`,
      );
      if (item.inner) {
        innerConds.push(
          `EXISTS (SELECT 1 FROM ${ident(item.table)} x WHERE x.${ident(fk.tgtCol)} = ${alias}.${ident(fk.srcCol)})`,
        );
      }
    }
    return cols.join(', ');
  }

  private async buildReturning(alias: string): Promise<string> {
    const items = parseSelect(this.selectStr ?? '*');
    return this.buildColumns(this.table, alias, items, []);
  }

  private async buildSql(): Promise<{ sql: string; params: unknown[] }> {
    const params: unknown[] = [];
    const t = ident(this.table);

    if (this.op === 'select') {
      const alias = 'b';
      const inner: string[] = [];
      const items = parseSelect(this.selectStr ?? '*');
      const cols = await this.buildColumns(this.table, alias, items, inner);
      const where = this.buildWhere(alias, params, inner);
      const order = this.orders.length
        ? ` ORDER BY ${this.orders
            .map((o) => `${alias}.${ident(o.col)} ${o.ascending ? 'ASC' : 'DESC'}`)
            .join(', ')}`
        : '';
      const limit = this.limitN !== null ? ` LIMIT ${Number(this.limitN)}` : '';
      if (this.head) {
        return { sql: `SELECT COUNT(*)::int AS count FROM ${t} ${alias}${where}`, params };
      }
      return { sql: `SELECT ${cols} FROM ${t} ${alias}${where}${order}${limit}`, params };
    }

    const returningSql = this.returning ? ` RETURNING ${await this.buildReturning(t)}` : '';

    if (this.op === 'insert' || this.op === 'upsert') {
      if (this.rows.length === 0) return { sql: 'SELECT 1 WHERE FALSE', params };
      const columns = [...new Set(this.rows.flatMap((r) => Object.keys(r)))];
      const tuples = this.rows.map((row) => {
        const placeholders = columns.map((c) => {
          if (row[c] === undefined) return 'DEFAULT';
          params.push(row[c]);
          return `$${params.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      let sql = `INSERT INTO ${t} (${columns.map(ident).join(', ')}) VALUES ${tuples.join(', ')}`;
      if (this.op === 'upsert') {
        const target = this.onConflict!.split(',').map((c) => c.trim());
        const updates = columns.filter((c) => !target.includes(c));
        sql +=
          ` ON CONFLICT (${target.map(ident).join(', ')}) ` +
          (updates.length
            ? `DO UPDATE SET ${updates.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ')}`
            : 'DO NOTHING');
      }
      return { sql: sql + returningSql, params };
    }

    if (this.op === 'update') {
      const entries = Object.entries(this.patch).filter(([, v]) => v !== undefined);
      const sets = entries.map(([c, v]) => {
        params.push(v);
        return `${ident(c)} = $${params.length}`;
      });
      const where = this.buildWhere(t, params);
      return { sql: `UPDATE ${t} SET ${sets.join(', ')}${where}${returningSql}`, params };
    }

    // delete
    const where = this.buildWhere(t, params);
    return { sql: `DELETE FROM ${t}${where}${returningSql}`, params };
  }

  private async execute(): Promise<DbResult<any>> {
    try {
      const { sql, params } = await this.buildSql();
      const result = await pool.query(sql, params);

      if (this.op === 'select' && this.head) {
        return { data: null, error: null, count: result.rows[0].count };
      }

      const hasRows = this.op === 'select' || this.returning;
      const rows = hasRows ? result.rows : null;
      const count = this.wantCount ? (rows?.length ?? 0) : null;

      if (this.mode === 'many') return { data: rows, error: null, count };

      const list = rows ?? [];
      if (this.mode === 'single' && list.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${list.length} rows`,
          },
        };
      }
      if (this.mode === 'maybeSingle' && list.length > 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple rows returned',
          },
        };
      }
      return { data: list[0] ?? null, error: null, count };
    } catch (err) {
      const e = err as { code?: string; message?: string; detail?: string };
      return {
        data: null,
        error: { code: e.code, message: e.message ?? 'Database error', details: e.detail },
      };
    }
  }
}

export const db = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};
