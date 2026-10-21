import React from "react";

export interface BannerProps {
  title: string;
  message?: string;
  variant?: "neutral" | "warning" | "danger" | "accent";
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function Banner({
  title,
  message,
  variant = "warning",
  actionText,
  onAction,
  className = "",
}: BannerProps) {
  const variantStyles = {
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
    warning: "border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)]",
    danger: "border-[var(--danger)] bg-[var(--surface)] text-[var(--danger)]",
    accent: "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)]",
  }[variant];

  return (
    <div
      role="alert"
      className={`w-full p-3 border rounded-[var(--radius)] flex flex-wrap items-center justify-between gap-3 text-sm ${variantStyles} ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wider text-xs">
          [{title}]
        </span>
        {message && (
          <span className="text-[var(--text)] font-normal">{message}</span>
        )}
      </div>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="text-xs font-medium underline hover:opacity-80 cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
