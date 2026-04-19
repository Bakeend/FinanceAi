import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturesV51776800000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE trips (
        id          TEXT PRIMARY KEY,
        nome        TEXT NOT NULL,
        tag         TEXT NOT NULL UNIQUE,
        inicio      TEXT NOT NULL,
        fim         TEXT NOT NULL,
        orcamento   NUMERIC,
        cor         TEXT NOT NULL DEFAULT '#22d3ee',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`ALTER TABLE transactions ADD COLUMN subcategoria TEXT`);
    await q.query(`CREATE INDEX idx_transactions_subcategoria ON transactions(subcategoria)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transactions DROP COLUMN subcategoria`);
    await q.query(`DROP TABLE trips`);
  }
}
