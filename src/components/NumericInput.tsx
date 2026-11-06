import React, { useState, useEffect } from 'react';
import { fmt, pn } from '../engine/calc';

interface NumericInputProps {
  value: number | undefined | null;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * Robust number input for Brazilian currency & numeric values (e.g. 1.250,50).
 * Prevents cursor jumping and keystroke corruption by allowing freeform typing while focused,
 * and formatting on blur or Enter.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  disabled = false,
  title,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState<string>(() => (value != null && value !== 0 ? fmt(value) : ''));

  useEffect(() => {
    if (!isFocused) {
      setText(value != null && value !== 0 ? fmt(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const num = pn(text);
    onChange(num);
    setText(num ? fmt(num) : '');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      value={isFocused ? text : (value != null && value !== 0 ? fmt(value) : '')}
      onChange={handleChange}
      onFocus={() => {
        setIsFocused(true);
        setText(value != null && value !== 0 ? fmt(value) : '');
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      style={style}
      className={className}
    />
  );
};
