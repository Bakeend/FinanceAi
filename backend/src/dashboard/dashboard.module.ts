import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
