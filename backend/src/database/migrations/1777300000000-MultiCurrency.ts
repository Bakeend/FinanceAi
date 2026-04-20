import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiCurrency1777300000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Add currency column to transactions if missing
    const txCols: Array<{ name: string }> = await q.query(`PRAGMA table_info(transactions)`);
    const colNames = txCols.map((c) => c.name);

    if (!colNames.includes('currency')) {
      await q.query(`ALTER TABLE transactions ADD COLUMN currency VARCHAR(8) NOT NULL DEFAULT 'BRL'`);
    }
    if (!colNames.includes('original_amount')) {
      await q.query(`ALTER TABLE transactions ADD COLUMN original_amount NUMERIC(12,2)`);
    }

    // Create exchange_rates table if missing
    const tables: Array<{ name: string }> = await q.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='exchange_rates'`,
    );
    if (tables.length === 0) {
      await q.query(`
        CREATE TABLE exchange_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          currency VARCHAR(8) NOT NULL,
          rate NUMERIC(16,6) NOT NULL,
          date DATE NOT NULL,
          UNIQUE(currency, date)
        )
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS exchange_rates`);
    // SQLite does not support DROP COLUMN in older versions; skip reverting transaction columns
  }
}
