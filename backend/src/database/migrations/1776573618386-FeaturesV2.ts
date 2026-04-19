import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturesV21776573618386 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transactions ADD COLUMN is_transfer INTEGER NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE goals ADD COLUMN tipo TEXT NOT NULL DEFAULT 'limite'`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE goals DROP COLUMN tipo`);
    await q.query(`ALTER TABLE transactions DROP COLUMN is_transfer`);
  }
}
