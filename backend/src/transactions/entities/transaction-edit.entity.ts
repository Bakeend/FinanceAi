import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transaction_edits')
export class TransactionEdit {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'text', name: 'transaction_id' }) transactionId: string;
  @Index() @Column({ type: 'text', name: 'user_id' }) userId: string;

  /** Field that was changed (data, descricao, valor, categoria, subcategoria, accountId, attachment, isRecurring, tags). */
  @Column({ type: 'varchar', length: 32 }) field: string;
  @Column({ type: 'text', name: 'before_value', nullable: true }) beforeValue: string | null;
  @Column({ type: 'text', name: 'after_value', nullable: true }) afterValue: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
