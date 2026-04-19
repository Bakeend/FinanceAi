import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenRouterClient } from './openrouter.client';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ChatMessageEntity } from './chat-message.entity';
import { AiMemoryEntity } from './memory.entity';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessageEntity, AiMemoryEntity]), forwardRef(() => TransactionsModule)],
  providers: [
    {
      provide: OpenRouterClient,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => new OpenRouterClient({
        apiKey: cfg.get<string>('OPENROUTER_API_KEY')!,
        referer: cfg.get<string>('APP_REFERER') ?? 'http://localhost:5173',
        title: cfg.get<string>('APP_TITLE') ?? 'FinanceAi',
        models: [
          'openrouter/auto',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen-2.5-72b-instruct:free',
          'google/gemini-2.0-flash-exp:free',
        ],
      }),
    },
    AiService,
  ],
  controllers: [AiController],
  exports: [AiService, OpenRouterClient],
})
export class AiModule {}
