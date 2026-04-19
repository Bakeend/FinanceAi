export type BankId = 'nubank' | 'itau' | 'bradesco' | 'caixa' | 'generic';

export function detectBank(text: string): BankId {
  const head = text.slice(0, 800).toLowerCase();
  if (/nubank|nu pagamentos|nu bank/.test(head)) return 'nubank';
  if (/ita[uú]|itau unibanco/.test(head)) return 'itau';
  if (/bradesco/.test(head)) return 'bradesco';
  if (/caixa econ[oô]mica|caixa\b/.test(head)) return 'caixa';
  return 'generic';
}

export const BANK_LABELS: Record<BankId, string> = {
  nubank: 'Nubank',
  itau: 'Itaú',
  bradesco: 'Bradesco',
  caixa: 'Caixa Econômica',
  generic: 'Genérico',
};
