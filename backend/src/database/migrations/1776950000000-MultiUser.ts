import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiUser1776950000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Add user_id to simple tables
    const simpleTables = ['transactions', 'accounts', 'budgets', 'rules', 'reminders', 'trips', 'chat_messages'];
    for (const t of simpleTables) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
    }

    // Populate user_id from first user for all existing rows
    for (const t of simpleTables) {
      await q.query(`UPDATE ${t} SET user_id = COALESCE((SELECT id FROM users LIMIT 1), '') WHERE user_id = ''`);
      await q.query(`CREATE INDEX IF NOT EXISTS idx_${t}_user_id ON ${t}(user_id)`);
    }

    // Recreate months table (need to change UNIQUE constraint to include user_id)
    await q.query(`
      CREATE TABLE months_new (
        id            TEXT PRIMARY KEY,
        mes           INTEGER NOT NULL,
        ano           INTEGER NOT NULL,
        total_gasto   NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_entrada NUMERIC(12,2) NOT NULL DEFAULT 0,
        user_id       TEXT NOT NULL DEFAULT '',
        UNIQUE(mes, ano, user_id)
      )
    `);
    await q.query(`INSERT INTO months_new SELECT id, mes, ano, total_gasto, total_entrada, COALESCE((SELECT id FROM users LIMIT 1), '') FROM months`);
    await q.query(`DROP TABLE months`);
    await q.query(`ALTER TABLE months_new RENAME TO months`);

    // Recreate goals table (UNIQUE was categoria+mes+ano, now add user_id)
    await q.query(`
      CREATE TABLE goals_new (
        id          TEXT PRIMARY KEY,
        categoria   VARCHAR(32) NOT NULL,
        valor       NUMERIC(12,2) NOT NULL,
        mes         INTEGER NOT NULL,
        ano         INTEGER NOT NULL,
        tipo        VARCHAR(16) NOT NULL DEFAULT 'limite',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        user_id     TEXT NOT NULL DEFAULT '',
        UNIQUE(categoria, mes, ano, user_id)
      )
    `);
    await q.query(`INSERT INTO goals_new SELECT id, categoria, valor, mes, ano, tipo, created_at, COALESCE((SELECT id FROM users LIMIT 1), '') FROM goals`);
    await q.query(`DROP TABLE goals`);
    await q.query(`ALTER TABLE goals_new RENAME TO goals`);

    // Recreate ai_memory with user_id as primary key (was integer id=1)
    await q.query(`
      CREATE TABLE ai_memory_new (
        user_id    TEXT PRIMARY KEY,
        content    TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`
      INSERT OR IGNORE INTO ai_memory_new
      SELECT COALESCE((SELECT id FROM users LIMIT 1), 'default'), content, updated_at
      FROM ai_memory WHERE id = 1
    `);
    await q.query(`DROP TABLE ai_memory`);
    await q.query(`ALTER TABLE ai_memory_new RENAME TO ai_memory`);
  }

  public async down(q: QueryRunner): Promise<void> {
    throw new Error('Down migration not supported for multi-user isolation');
  }
}
