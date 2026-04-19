import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiMemory1776621707995 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE ai_memory (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        content    TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`INSERT INTO ai_memory (id, content) VALUES (1, '')`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE ai_memory`);
  }
}
