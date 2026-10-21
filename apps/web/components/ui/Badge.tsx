import React from "react";

export interface BadgeProps {
  label: string;
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
  title?: string;
}

export function Badge({
  label,
  variant = "neutral",
  className = "",
  title,
}: BadgeProps) {
  const variantStyles = {
    neutral: "text-[var(--text-muted)] border-[var(--border)] bg-[var(--surface)]",
    accent: "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-subtle)] font-semibold",
    success: "text-[var(--success)] border-[var(--success)] bg-[var(--surface)] font-semibold",
    warning: "text-[var(--warning)] border-[var(--warning)] bg-[var(--surface)] font-semibold",
    danger: "text-[var(--danger)] border-[var(--danger)] bg-[var(--surface)] font-semibold",
  }[variant];

  return (
    <span
      title={title}
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-mono tracking-wider border rounded-[var(--radius-sm)] uppercase select-none ${variantStyles} ${className}`}
    >
      {label}
    </span>
  );
}
