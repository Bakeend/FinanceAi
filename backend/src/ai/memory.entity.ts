import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_memory')
export class AiMemoryEntity {
  @PrimaryColumn({ type: 'text', name: 'user_id' }) userId: string;
  @Column({ type: 'text', default: '' }) content: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
