import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`px-4 py-3 bg-cream border-2 border-ink/20 rounded-lg text-ink placeholder:text-ink/40 focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition-all ${className}`}
      {...props}
    />
  );
}
