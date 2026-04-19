import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 16 }) role: 'user' | 'assistant';
  @Column('text') content: string;
  @Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
  @Index() @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
