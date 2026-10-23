// Erstatning for @vercel/postgres' `sql`-tag, bygget paa node-postgres (pg).
// @vercel/postgres taler kun Neons serverless-protokol og virker derfor ikke
// mod en almindelig Postgres. Denne adapter virker mod begge (ogsaa Neon/Vercel),
// og har samme form: sql`...${v}...` og sql.query(text, params) -> { rows, rowCount }.
import { Pool, type QueryResultRow } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

type Resultat<T> = Promise<{ rows: T[]; rowCount: number | null }>;

interface SqlTag {
  <T extends QueryResultRow = QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Resultat<T>;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Resultat<T>;
}

function tag<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Resultat<T> {
  let text = strings[0];
  for (let i = 1; i < strings.length; i++) text += "$" + i + strings[i];
  return pool.query<T>(text, values);
}

tag.query = function <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Resultat<T> {
  return pool.query<T>(text, params);
};

export const sql = tag as SqlTag;
