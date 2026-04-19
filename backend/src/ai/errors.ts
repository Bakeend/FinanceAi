export class AiAuthError extends Error {
  constructor() {
    super('OpenRouter API key inválida');
  }
}

export class AiUnavailableError extends Error {
  constructor() {
    super('Todos os modelos AI esgotados');
  }
}
