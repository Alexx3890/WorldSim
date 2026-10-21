import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-[var(--radius-sm)] gap-1.5",
    md: "px-4 py-2 text-sm rounded-[var(--radius)] gap-2",
    lg: "px-5 py-2.5 text-base rounded-[var(--radius)] gap-2.5 font-semibold",
  }[size];

  const variantStyles = {
    primary:
      "bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--accent)] hover:bg-[var(--accent-hover)] shadow-sm font-semibold",
    secondary:
      "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-subtle)]",
    tertiary:
      "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] border border-transparent",
    destructive:
      "bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--surface)]",
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
