import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text', unique: true }) username: string;
  @Column({ type: 'text', name: 'password_hash' }) passwordHash: string;
  @Column({ type: 'text', name: 'password_salt' }) passwordSalt: string;
  @Column({ type: 'text', name: 'pin_hash', nullable: true }) pinHash: string | null;
  @Column({ type: 'text', name: 'pin_salt', nullable: true }) pinSalt: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
