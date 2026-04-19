import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AiAuthError, AiUnavailableError } from './errors';

@Catch(AiAuthError, AiUnavailableError)
export class AiErrorsFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AiAuthError) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'API key inválida, verifique OPENROUTER_API_KEY.' });
    }
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ message: 'Limite da IA atingido (200/dia grátis). Tente novamente mais tarde.' });
  }
}
