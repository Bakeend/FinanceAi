import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GoalsModule } from './goals/goals.module';
import { AccountsModule } from './accounts/accounts.module';
import { RemindersModule } from './reminders/reminders.module';
import { BudgetsModule } from './budgets/budgets.module';
import { RulesModule } from './rules/rules.module';
import { TripsModule } from './trips/trips.module';
import { BackupModule } from './backup/backup.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
    }),
    DatabaseModule, AuthModule, TransactionsModule, AiModule, DashboardModule, GoalsModule, AccountsModule, RemindersModule, BudgetsModule, RulesModule, TripsModule, BackupModule
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
