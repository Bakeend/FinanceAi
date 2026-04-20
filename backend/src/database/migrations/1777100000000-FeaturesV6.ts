import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturesV61777100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const cols: Array<{ name: string }> = await q.query(`PRAGMA table_info(transactions)`);
    if (!cols.some((c) => c.name === 'is_recurring')) {
      await q.query(`ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`);
    }
  }
  public async down(q: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily
  }
}
