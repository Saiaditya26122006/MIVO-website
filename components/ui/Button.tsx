import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 hover:scale-[1.02] active:scale-[0.98]';

  const variants = {
    primary: 'bg-ink text-cream hover:bg-ink/90 shadow-md hover:shadow-lg focus:ring-ink/50',
    secondary: 'bg-cream text-ink border-2 border-ink hover:bg-ink hover:text-cream focus:ring-ink/50',
    accent: 'bg-lime text-ink hover:bg-lime/90 shadow-md hover:shadow-xl focus:ring-lime/50',
    ghost: 'bg-transparent text-ink hover:bg-ink/5 focus:ring-ink/30',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
