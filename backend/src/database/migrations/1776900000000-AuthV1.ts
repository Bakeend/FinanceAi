import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthV11776900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id              TEXT PRIMARY KEY,
        username        TEXT NOT NULL UNIQUE,
        password_hash   TEXT NOT NULL,
        password_salt   TEXT NOT NULL,
        pin_hash        TEXT,
        pin_salt        TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE users`);
  }
}
