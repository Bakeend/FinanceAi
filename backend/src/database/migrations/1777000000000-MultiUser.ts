import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona user_id em todas as tabelas de dados. Atribui os registros existentes
 * ao primeiro usuário criado (se houver). Se ainda não há usuários, ficam com ''
 * e serão migrados quando o primeiro usuário for criado (tratado no signup).
 */
export class MultiUser1777000000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    const firstUser = await q.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    const defaultUid = firstUser?.[0]?.id ?? '';

    // Adicionar user_id em cada tabela
    const tables = ['transactions', 'accounts', 'tx_rules', 'budgets', 'trips', 'goals', 'reminders', 'months'];
    for (const t of tables) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
      await q.query(`CREATE INDEX idx_${t}_user ON ${t}(user_id)`);
      if (defaultUid) {
        await q.query(`UPDATE ${t} SET user_id = ? WHERE user_id = ''`, [defaultUid]);
      }
    }

    // Recriar uniques compostos incluindo user_id onde aplicável
    // months: (mes, ano) → (mes, ano, user_id)
    await q.query(`DROP INDEX IF EXISTS "UQ_months_mes_ano"`);
    await q.query(`CREATE UNIQUE INDEX uq_months_mes_ano_user ON months(mes, ano, user_id)`);
    // goals: já tinha unique (categoria, mes, ano) — migrar pra incluir user_id
    await q.query(`DROP INDEX IF EXISTS "UQ_goals_categoria_mes_ano"`);
    await q.query(`CREATE UNIQUE INDEX uq_goals_cat_mes_ano_user ON goals(categoria, mes, ano, user_id)`);
    // budgets: (categoria, mes, ano) → idem
    await q.query(`DROP INDEX IF EXISTS "sqlite_autoindex_budgets_1"`);
    await q.query(`CREATE UNIQUE INDEX uq_budgets_cat_mes_ano_user ON budgets(categoria, mes, ano, user_id)`);
    // trips.tag era unique global — agora unique por usuário
    await q.query(`DROP INDEX IF EXISTS "sqlite_autoindex_trips_1"`);
    await q.query(`CREATE UNIQUE INDEX uq_trips_tag_user ON trips(tag, user_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    const tables = ['transactions', 'accounts', 'tx_rules', 'budgets', 'trips', 'goals', 'reminders', 'months'];
    for (const t of tables) {
      await q.query(`DROP INDEX IF EXISTS idx_${t}_user`);
      await q.query(`ALTER TABLE ${t} DROP COLUMN user_id`);
    }
  }
}
