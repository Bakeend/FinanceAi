import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') nome: string;
  @Column({ type: 'varchar', length: 16 }) tipo: 'conta' | 'cartao' | 'dinheiro' | 'investimento';
  @Column({ type: 'varchar', length: 16, default: '#38bdf8' }) cor: string;
  @Column({ type: 'text', nullable: true }) banco: string | null;
  @Column({ type: 'integer', name: 'is_default', default: 0, transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 } })
  isDefault: boolean;
  @Column({ type: 'integer', name: 'closing_day', nullable: true }) closingDay: number | null;
  @Column({ type: 'integer', name: 'due_day', nullable: true }) dueDay: number | null;
  @Column({ type: 'numeric', nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
  limite: number | null;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
