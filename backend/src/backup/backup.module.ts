import { BadRequestException, Controller, Get, Header, Module, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function dbPath(): string {
  return resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/financeai.db');
}

@Controller('backup')
export class BackupController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  @Header('Content-Type', 'application/octet-stream')
  @Header('Content-Disposition', `attachment; filename="financeai-backup-${new Date().toISOString().slice(0, 10)}.db"`)
  async download(@Res() res: Response) {
    // Força flush do SQLite
    try { await this.ds.query('PRAGMA wal_checkpoint(FULL)'); } catch {}
    const buf = readFileSync(dbPath());
    res.send(buf);
  }

  @Post('restore')
  @UseInterceptors(FileInterceptor('file'))
  async restore(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente');
    // Validação SQLite: primeiros 16 bytes devem ser "SQLite format 3\0"
    const magic = file.buffer.slice(0, 16).toString('utf8');
    if (!magic.startsWith('SQLite format 3')) {
      throw new BadRequestException('Arquivo inválido. Precisa ser um backup .db do FinanceAi.');
    }
    // Fecha a conexão antes de substituir
    if (this.ds.isInitialized) {
      await this.ds.destroy();
    }
    writeFileSync(dbPath(), file.buffer);
    await this.ds.initialize();
    return { ok: true, message: 'Banco restaurado. Recarregue a página para ver os dados.' };
  }
}

@Module({
  controllers: [BackupController],
})
export class BackupModule {}
