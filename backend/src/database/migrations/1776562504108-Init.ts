import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1776562504108 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE transactions (
        id          TEXT PRIMARY KEY,
        data        TEXT NOT NULL,
        descricao   TEXT NOT NULL,
        valor       NUMERIC NOT NULL,
        categoria   TEXT NOT NULL DEFAULT 'Outros',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`CREATE INDEX idx_transactions_data ON transactions(data)`);
    await q.query(`
      CREATE TABLE months (
        id             TEXT PRIMARY KEY,
        mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
        ano            INTEGER NOT NULL,
        total_gasto    NUMERIC NOT NULL DEFAULT 0,
        total_entrada  NUMERIC NOT NULL DEFAULT 0,
        UNIQUE (mes, ano)
      )
    `);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE months`);
    await q.query(`DROP TABLE transactions`);
  }
}
