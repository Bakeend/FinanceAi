import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') nome: string;
  @Column({ type: 'text', unique: true }) tag: string;
  @Column({ type: 'text' }) inicio: string;
  @Column({ type: 'text' }) fim: string;
  @Column({ type: 'numeric', nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
  orcamento: number | null;
  @Column({ type: 'text', default: '#22d3ee' }) cor: string;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
