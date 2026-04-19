import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Injectable, Module, Post, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector, APP_GUARD } from '@nestjs/core';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { hashSecret, rotateSecret, signToken, verifySecret, verifyToken } from './token.util';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as { id: string; username: string } | undefined;
});

class SignupDto {
  @IsString() @MinLength(3) @MaxLength(30) @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'Username inválido (a-z, 0-9, _.-)' }) username: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
  @IsOptional() @IsString() @Matches(/^\d{4,6}$/, { message: 'PIN deve ter 4 a 6 dígitos' }) pin?: string;
}
class LoginDto {
  @IsString() username: string;
  @IsString() password: string;
}
class PinLoginDto {
  @IsString() username: string;
  @IsString() @Matches(/^\d{4,6}$/) pin: string;
}
class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword: string;
}
class SetPinDto {
  @IsString() password: string;
  @IsString() @Matches(/^\d{4,6}$/) pin: string;
}

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async setupStatus(): Promise<{ hasUsers: boolean }> {
    const count = await this.repo.count();
    return { hasUsers: count > 0 };
  }

  async signup(dto: SignupDto) {
    const existing = await this.repo.findOne({ where: { username: dto.username.toLowerCase() } });
    if (existing) throw new ForbiddenException('Nome de usuário já está em uso.');
    const { salt, hash } = hashSecret(dto.password);
    const user: Partial<User> = {
      username: dto.username.toLowerCase(),
      passwordHash: hash, passwordSalt: salt,
    };
    if (dto.pin) {
      const p = hashSecret(dto.pin);
      user.pinHash = p.hash; user.pinSalt = p.salt;
    }
    const saved = await this.repo.save(user as any);
    const token = signToken(saved.id);
    return { token, user: { id: saved.id, username: saved.username, hasPin: !!saved.pinHash } };
  }

  async login(dto: LoginDto) {
    const user = await this.repo.findOne({ where: { username: dto.username.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Usuário ou senha inválidos');
    if (!verifySecret(dto.password, user.passwordSalt, user.passwordHash)) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    return { token: signToken(user.id), user: { id: user.id, username: user.username, hasPin: !!user.pinHash } };
  }

  async pinLogin(dto: PinLoginDto) {
    const user = await this.repo.findOne({ where: { username: dto.username.toLowerCase() } });
    if (!user || !user.pinHash || !user.pinSalt) throw new UnauthorizedException('PIN não configurado');
    if (!verifySecret(dto.pin, user.pinSalt, user.pinHash)) {
      throw new UnauthorizedException('PIN incorreto');
    }
    return { token: signToken(user.id), user: { id: user.id, username: user.username, hasPin: true } };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!verifySecret(dto.currentPassword, user.passwordSalt, user.passwordHash)) {
      throw new BadRequestException('Senha atual incorreta');
    }
    const { salt, hash } = hashSecret(dto.newPassword);
    await this.repo.update(user.id, { passwordHash: hash, passwordSalt: salt });
    return { ok: true };
  }

  async setPin(userId: string, dto: SetPinDto) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!verifySecret(dto.password, user.passwordSalt, user.passwordHash)) {
      throw new BadRequestException('Senha incorreta');
    }
    const { salt, hash } = hashSecret(dto.pin);
    await this.repo.update(user.id, { pinHash: hash, pinSalt: salt });
    return { ok: true };
  }

  async removePin(userId: string) {
    await this.repo.update(userId, { pinHash: null as any, pinSalt: null as any });
    return { ok: true };
  }

  async logoutAllDevices() {
    rotateSecret();
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, username: user.username, hasPin: !!user.pinHash, createdAt: user.createdAt };
  }

  async findById(id: string) { return this.repo.findOne({ where: { id } }); }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = (req.headers?.authorization as string | undefined) ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Token ausente');
    const payload = verifyToken(token);
    if (!payload) throw new UnauthorizedException('Token inválido ou expirado');
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    req.user = { id: user.id, username: user.username };
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Public() @Get('status') status() { return this.svc.setupStatus(); }
  @Public() @Post('signup') signup(@Body() dto: SignupDto) { return this.svc.signup(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.svc.login(dto); }
  @Public() @Post('pin-login') pinLogin(@Body() dto: PinLoginDto) { return this.svc.pinLogin(dto); }

  @Get('me') me(@CurrentUser() u: any) { return this.svc.me(u.id); }

  @Post('change-password') changePassword(@CurrentUser() u: any, @Body() dto: ChangePasswordDto) {
    return this.svc.changePassword(u.id, dto);
  }

  @Post('set-pin') setPin(@CurrentUser() u: any, @Body() dto: SetPinDto) {
    return this.svc.setPin(u.id, dto);
  }

  @Post('remove-pin') removePin(@CurrentUser() u: any) {
    return this.svc.removePin(u.id);
  }

  @Post('logout-all') logoutAll() {
    return this.svc.logoutAllDevices();
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  controllers: [AuthController],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule {}
