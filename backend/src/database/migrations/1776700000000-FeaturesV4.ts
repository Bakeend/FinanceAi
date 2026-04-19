import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturesV41776700000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Budgets: limite mensal por categoria
    await q.query(`
      CREATE TABLE budgets (
        id         TEXT PRIMARY KEY,
        categoria  TEXT NOT NULL,
        mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
        ano        INTEGER NOT NULL,
        valor      NUMERIC NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(categoria, mes, ano)
      )
    `);
    // Transaction rules: padrão → categoria automática
    await q.query(`
      CREATE TABLE tx_rules (
        id         TEXT PRIMARY KEY,
        pattern    TEXT NOT NULL,
        categoria  TEXT NOT NULL,
        priority   INTEGER NOT NULL DEFAULT 0,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Credit card / account extras
    await q.query(`ALTER TABLE accounts ADD COLUMN closing_day INTEGER`);
    await q.query(`ALTER TABLE accounts ADD COLUMN due_day INTEGER`);
    await q.query(`ALTER TABLE accounts ADD COLUMN limite NUMERIC`);
    // Transfer pair id — liga as duas pernas de uma transferência manual
    await q.query(`ALTER TABLE transactions ADD COLUMN transfer_pair_id TEXT`);
    await q.query(`CREATE INDEX idx_transactions_transfer_pair ON transactions(transfer_pair_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transactions DROP COLUMN transfer_pair_id`);
    await q.query(`ALTER TABLE accounts DROP COLUMN limite`);
    await q.query(`ALTER TABLE accounts DROP COLUMN due_day`);
    await q.query(`ALTER TABLE accounts DROP COLUMN closing_day`);
    await q.query(`DROP TABLE tx_rules`);
    await q.query(`DROP TABLE budgets`);
  }
}
