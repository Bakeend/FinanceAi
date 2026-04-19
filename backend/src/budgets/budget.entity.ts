import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('budgets')
@Unique(['categoria', 'mes', 'ano', 'userId'])
export class Budget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') categoria: string;
  @Column('integer') mes: number;
  @Column('integer') ano: number;
  @Column({ type: 'numeric', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  valor: number;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
