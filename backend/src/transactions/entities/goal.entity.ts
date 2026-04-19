import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('goals')
@Unique(['categoria', 'mes', 'ano', 'userId'])
export class Goal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32 }) categoria: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  valor: number;
  @Column('int') mes: number;
  @Column('int') ano: number;
  @Column({ type: 'varchar', length: 16, default: 'limite' }) tipo: 'limite' | 'poupanca';
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
