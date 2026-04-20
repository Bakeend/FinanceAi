import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const tagsTransformer = {
  to: (v: string[] | null | undefined): string | null => (v && v.length ? JSON.stringify(v) : null),
  from: (v: string | null): string[] => {
    if (!v) return [];
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  },
};

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'date' }) data: string;
  @Column({ type: 'text' }) descricao: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  valor: number;
  @Column({ type: 'varchar', length: 8, default: 'BRL' })
  currency: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, name: 'original_amount',
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
  originalAmount: number | null;
  @Column({ type: 'varchar', length: 32, default: 'Outros' }) categoria: string;
  @Column({ type: 'text', nullable: true }) subcategoria: string | null;
  @Column({ type: 'text', nullable: true, transformer: tagsTransformer, default: null })
  tags: string[];
  @Column({ type: 'integer', name: 'is_transfer', default: 0, transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 } })
  isTransfer: boolean;

  @Index() @Column({ type: 'text', nullable: true, name: 'account_id' })
  accountId: string | null;

  @Index() @Column({ type: 'text', nullable: true, name: 'installment_group' })
  installmentGroup: string | null;
  @Column({ type: 'integer', nullable: true, name: 'installment_num' })
  installmentNum: number | null;
  @Column({ type: 'integer', nullable: true, name: 'installment_total' })
  installmentTotal: number | null;

  @Column({ type: 'text', nullable: true, name: 'split_parent_id' })
  splitParentId: string | null;

  @Column({ type: 'text', nullable: true })
  attachment: string | null;

  @Index() @Column({ type: 'text', nullable: true, name: 'transfer_pair_id' })
  transferPairId: string | null;

  @Column({ type: 'integer', name: 'is_recurring', default: 0, transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 } })
  isRecurring: boolean;

  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
