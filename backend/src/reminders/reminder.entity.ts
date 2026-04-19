import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') descricao: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  valor: number;
  @Column('int') dia: number;
  @Column({ type: 'varchar', length: 32, default: 'Outros' }) categoria: string;
  @Column({ type: 'text', nullable: true, name: 'account_id' }) accountId: string | null;
  @Column({ type: 'integer', default: 1, transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 } })
  active: boolean;
  @Column({ type: 'text', nullable: true, name: 'last_paid' }) lastPaid: string | null;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
