import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('months')
@Unique(['mes', 'ano', 'userId'])
export class Month {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('int') mes: number;
  @Column('int') ano: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'total_gasto', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  totalGasto: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'total_entrada', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  totalEntrada: number;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
}
