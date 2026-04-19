import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/financeai.db');
        mkdirSync(dirname(dbPath), { recursive: true });
        return {
          type: 'better-sqlite3' as const,
          database: dbPath,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
