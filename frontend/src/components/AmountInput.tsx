import { useState, useEffect } from 'react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  defaultSign?: '+' | '-';
  placeholder?: string;
  wrapperClassName?: string;
  inputClassName?: string;
}

function parseDisplayToAbs(display: string): number {
  let raw = display.replace(/[^\d,.]/g, '');
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  }
  return parseFloat(raw) || 0;
}

export function AmountInput({
  value,
  onChange,
  defaultSign = '-',
  placeholder = '0,00',
  wrapperClassName,
  inputClassName,
}: AmountInputProps) {
  const [sign, setSign] = useState<'+' | '-'>(() =>
    value < 0 ? '-' : value > 0 ? '+' : defaultSign
  );
  const [display, setDisplay] = useState(() =>
    value !== 0 ? Math.abs(value).toFixed(2).replace('.', ',') : ''
  );

  useEffect(() => {
    if (value === 0) {
      setDisplay('');
      setSign(defaultSign);
      return;
    }
    setSign(value < 0 ? '-' : '+');
    setDisplay(Math.abs(value).toFixed(2).replace('.', ','));
  }, [value, defaultSign]);

  const emit = (disp: string, s: '+' | '-') => {
    const abs = parseDisplayToAbs(disp);
    onChange(s === '-' ? -abs : abs);
  };

  return (
    <div className={`flex items-center gap-2 ${wrapperClassName ?? ''}`}>
      <button
        type="button"
        onClick={() => {
          const next: '+' | '-' = sign === '-' ? '+' : '-';
          setSign(next);
          emit(display, next);
        }}
        title={sign === '-' ? 'Gasto — clique para mudar para entrada' : 'Entrada — clique para mudar para gasto'}
        className={`w-9 h-9 rounded-lg font-bold text-base flex items-center justify-center border-2 transition-colors shrink-0 ${
          sign === '-'
            ? 'bg-rose-500/20 border-rose-500/60 text-rose-400 hover:bg-rose-500/30'
            : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/30'
        }`}
      >
        {sign}
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          setDisplay(e.target.value);
          emit(e.target.value, sign);
        }}
        className={`flex-1 min-w-0 bg-transparent outline-none tabular-nums ${inputClassName ?? ''}`}
      />
    </div>
  );
}
