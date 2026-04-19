import { MigrationInterface, QueryRunner } from 'typeorm';

export class Features1776570603242 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transactions ADD COLUMN tags TEXT`);
    await q.query(`
      CREATE TABLE goals (
        id         TEXT PRIMARY KEY,
        categoria  TEXT NOT NULL,
        valor      NUMERIC NOT NULL,
        mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
        ano        INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (categoria, mes, ano)
      )
    `);
    await q.query(`
      CREATE TABLE chat_messages (
        id         TEXT PRIMARY KEY,
        role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`CREATE INDEX idx_chat_messages_created ON chat_messages(created_at)`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE chat_messages`);
    await q.query(`DROP TABLE goals`);
    await q.query(`ALTER TABLE transactions DROP COLUMN tags`);
  }
}
