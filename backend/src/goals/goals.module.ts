import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from '../transactions/entities/goal.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Goal, Transaction])],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
