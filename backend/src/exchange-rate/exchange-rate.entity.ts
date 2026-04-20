import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  @Column({ type: 'numeric', precision: 16, scale: 6, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  rate: number;

  @Column({ type: 'date' })
  date: string;
}
