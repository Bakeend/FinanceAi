import 'dotenv/config';
import { DataSource } from 'typeorm';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/financeai.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
});
