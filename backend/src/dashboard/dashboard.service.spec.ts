import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService.summary', () => {
  it('returns totals from months and aggregates by categoria', async () => {
    const monthRepo = { findOne: jest.fn().mockResolvedValue({ totalGasto: -300, totalEntrada: 1000 }) };
    const txRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { categoria: 'Alimentação', total: '-200' },
          { categoria: 'Transporte', total: '-100' },
        ]),
      }),
    };
    const mod = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(Month), useValue: monthRepo },
      ],
    }).compile();
    const svc = mod.get(DashboardService);
    const res = await svc.summary(4, 2026);
    expect(res).toEqual({
      totalGasto: -300, totalEntrada: 1000, saldo: 700,
      porCategoria: [{ categoria: 'Alimentação', total: -200 }, { categoria: 'Transporte', total: -100 }],
    });
  });
});
