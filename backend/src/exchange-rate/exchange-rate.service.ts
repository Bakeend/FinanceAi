import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';

const AWESOME_API = 'https://economia.awesomeapi.com.br/json/last';
const SUPPORTED = ['USD', 'EUR', 'GBP', 'ARS'];

@Injectable()
export class ExchangeRateService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly repo: Repository<ExchangeRate>,
  ) {}

  async getRate(currency: string): Promise<number> {
    if (currency === 'BRL') return 1;
    const today = new Date().toISOString().slice(0, 10);
    const cached = await this.repo.findOne({ where: { currency, date: today } });
    if (cached) return cached.rate;
    return this.fetchAndCache(currency, today);
  }

  private async fetchAndCache(currency: string, date: string): Promise<number> {
    try {
      const pair = `${currency}-BRL`;
      const res = await fetch(`${AWESOME_API}/${pair}`);
      const json = await res.json();
      const key = `${currency}BRL`;
      const rate = Number(json[key]?.bid ?? json[key]?.ask ?? 0);
      if (rate > 0) {
        await this.repo.upsert({ currency, rate, date }, ['currency', 'date']);
        return rate;
      }
    } catch {
      // fall through to fallback
    }
    const latest = await this.repo.findOne({ where: { currency }, order: { date: 'DESC' } });
    return latest?.rate ?? 1;
  }

  async convertToBrl(amount: number, currency: string): Promise<number> {
    if (currency === 'BRL') return amount;
    const rate = await this.getRate(currency);
    return amount * rate;
  }

  getSupportedCurrencies(): string[] {
    return ['BRL', ...SUPPORTED];
  }
}
