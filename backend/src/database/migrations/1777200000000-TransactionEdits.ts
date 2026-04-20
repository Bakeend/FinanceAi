import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionEdits1777200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const tables: Array<{ name: string }> = await q.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='transaction_edits'`,
    );
    if (tables.length > 0) return;
    await q.query(`
      CREATE TABLE transaction_edits (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        field VARCHAR(32) NOT NULL,
        before_value TEXT,
        after_value TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await q.query(`CREATE INDEX idx_tx_edits_transaction_id ON transaction_edits(transaction_id)`);
    await q.query(`CREATE INDEX idx_tx_edits_user_id ON transaction_edits(user_id)`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS transaction_edits`);
  }
}
