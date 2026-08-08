import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
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
  const baseStyles = 'inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 dark:bg-blue-500 dark:hover:bg-blue-400 dark:shadow-blue-500/10',
    secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-100',
    outline: 'border border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:hover:bg-zinc-800/60 dark:text-zinc-300',
    ghost: 'hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800/60 dark:text-zinc-400',
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
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
