import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';
import { OfxParser } from './parsers/ofx.parser';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';
import { RulesModule } from '../rules/rules.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month]), forwardRef(() => AiModule), RulesModule, TripsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    CsvParser,
    OfxParser,
    {
      provide: PdfParser,
      inject: [AiService],
      useFactory: (ai: AiService) => new PdfParser({ fallbackAi: (text) => ai.extractTransactions(text) }),
    },
  ],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule {}
