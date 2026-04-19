import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturesV31776576437065 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Accounts
    await q.query(`
      CREATE TABLE accounts (
        id         TEXT PRIMARY KEY,
        nome       TEXT NOT NULL,
        tipo       TEXT NOT NULL CHECK (tipo IN ('conta','cartao','dinheiro','investimento')),
        cor        TEXT NOT NULL DEFAULT '#38bdf8',
        banco      TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Reminders (recurring bills)
    await q.query(`
      CREATE TABLE reminders (
        id          TEXT PRIMARY KEY,
        descricao   TEXT NOT NULL,
        valor       NUMERIC NOT NULL,
        dia         INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
        categoria   TEXT NOT NULL DEFAULT 'Outros',
        account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        active      INTEGER NOT NULL DEFAULT 1,
        last_paid   TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Transactions: add account, installments, splits, attachment
    await q.query(`ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL`);
    await q.query(`ALTER TABLE transactions ADD COLUMN installment_group TEXT`);
    await q.query(`ALTER TABLE transactions ADD COLUMN installment_num INTEGER`);
    await q.query(`ALTER TABLE transactions ADD COLUMN installment_total INTEGER`);
    await q.query(`ALTER TABLE transactions ADD COLUMN split_parent_id TEXT`);
    await q.query(`ALTER TABLE transactions ADD COLUMN attachment TEXT`);
    await q.query(`CREATE INDEX idx_transactions_account ON transactions(account_id)`);
    await q.query(`CREATE INDEX idx_transactions_installment ON transactions(installment_group)`);

    // Seed default "Conta principal" account
    await q.query(`
      INSERT INTO accounts (id, nome, tipo, cor, is_default)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Conta principal', 'conta', '#38bdf8', 1)
    `);
    // Attach existing transactions to the default account
    await q.query(`UPDATE transactions SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transactions DROP COLUMN attachment`);
    await q.query(`ALTER TABLE transactions DROP COLUMN split_parent_id`);
    await q.query(`ALTER TABLE transactions DROP COLUMN installment_total`);
    await q.query(`ALTER TABLE transactions DROP COLUMN installment_num`);
    await q.query(`ALTER TABLE transactions DROP COLUMN installment_group`);
    await q.query(`ALTER TABLE transactions DROP COLUMN account_id`);
    await q.query(`DROP TABLE reminders`);
    await q.query(`DROP TABLE accounts`);
  }
}
