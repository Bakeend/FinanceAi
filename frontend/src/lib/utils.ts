export function parseCurrency(val: string | undefined | null): number {
  if (!val) return 0;
  let raw = val.replace(/[^\d,.-]/g, '');
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  }
  return Number(raw) || 0;
}
