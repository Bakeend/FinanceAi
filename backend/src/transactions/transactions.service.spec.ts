import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: jest.Mocked<Repository<Transaction>>;
  let monthRepo: jest.Mocked<Repository<Month>>;

  beforeEach(async () => {
    txRepo = { createQueryBuilder: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), update: jest.fn() } as any;
    monthRepo = { upsert: jest.fn() } as any;
    const mod = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(Month), useValue: monthRepo },
      ],
    }).compile();
    service = mod.get(TransactionsService);
  });

  it('recomputeMonth aggregates and upserts month totals', async () => {
    txRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ gasto: '-300.50', entrada: '1000.00' }),
    } as any);

    await service.recomputeMonth(4, 2026, 'user-1');

    expect(monthRepo.upsert).toHaveBeenCalledWith(
      { mes: 4, ano: 2026, userId: 'user-1', totalGasto: -300.5, totalEntrada: 1000 },
      ['mes', 'ano', 'userId'],
    );
  });
});
