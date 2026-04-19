import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tx_rules')
export class TxRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') pattern: string;
  @Column('text') categoria: string;
  @Column({ type: 'integer', default: 0 }) priority: number;
  @Column({ type: 'integer', default: 1, transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 } })
  active: boolean;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
