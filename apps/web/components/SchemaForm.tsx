import React from "react";
import { ParameterField } from "../lib/types";
import { Badge } from "./ui/Badge";

export interface SchemaFormProps {
  parameters: Record<string, number | string | boolean>;
  schemaFields: ParameterField[];
  assumptions: string[];
  suggestedFields?: string[];
  onChange: (paramName: string, value: any) => void;
  onRunSimulation?: () => void;
  isSubmitting?: boolean;
}

export function SchemaForm({
  parameters,
  schemaFields,
  assumptions,
  suggestedFields = [],
  onChange,
  onRunSimulation,
  isSubmitting = false,
}: SchemaFormProps) {
  // Group fields into logical sections based on names/types
  const resourceFields = schemaFields.filter((f) =>
    f.name.includes("num_") || f.name.includes("count") || f.name.includes("beds")
  );
  const durationFields = schemaFields.filter((f) =>
    f.name.includes("duration") || f.name.includes("time") || f.name.includes("hours")
  );
  const otherFields = schemaFields.filter(
    (f) => !resourceFields.includes(f) && !durationFields.includes(f)
  );

  const renderField = (field: ParameterField) => {
    const value = parameters[field.name] ?? field.default;
    const isSuggested = suggestedFields.includes(field.name);

    return (
      <div key={field.name} className="space-y-1.5 p-3 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
            <span>{field.name.replace(/_/g, " ")}</span>
            {field.unit && (
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                ({field.unit})
              </span>
            )}
          </label>
          {isSuggested && (
            <Badge label="SUGGESTED" variant="accent" title="Value suggested by AI" />
          )}
        </div>

        {field.description && (
          <p className="text-xs text-[var(--text-muted)]">
            {field.description}
          </p>
        )}

        <div className="pt-1">
          {field.type === "int" || field.type === "float" ? (
            <div className="flex items-center gap-3">
              <input
                type="number"
                step={field.type === "float" ? "0.1" : "1"}
                min={field.min_value ?? undefined}
                max={field.max_value ?? undefined}
                value={value as number}
                onChange={(e) =>
                  onChange(
                    field.name,
                    field.type === "float"
                      ? parseFloat(e.target.value) || 0
                      : parseInt(e.target.value, 10) || 0
                  )
                }
                className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-sm font-mono text-[var(--text)] focus:outline-none"
              />
              {field.min_value !== undefined && field.max_value !== undefined && (
                <span className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
                  [{field.min_value} - {field.max_value}]
                </span>
              )}
            </div>
          ) : field.type === "bool" ? (
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(field.name, e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span>Enabled</span>
            </label>
          ) : (
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(field.name, e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-[var(--radius)] text-sm text-[var(--text)]"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Schema Fields */}
      <div className="lg:col-span-2 space-y-6">
        {resourceFields.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-1.5">
              Clinical Staffing & Bed Resources
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resourceFields.map(renderField)}
            </div>
          </div>
        )}

        {durationFields.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-1.5">
              Shift Duration & Temporal Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {durationFields.map(renderField)}
            </div>
          </div>
        )}

        {otherFields.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-1.5">
              Additional Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherFields.map(renderField)}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Assumptions Panel */}
      <div className="space-y-4">
        <div className="p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
              Assumptions & Defaults
            </h3>
            <Badge label={`${assumptions.length} FLAGGED`} variant="neutral" />
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Every default populated from pack distribution files or suggested by the AI scenario builder:
          </p>

          <ul className="space-y-2 text-xs">
            {assumptions.map((item, idx) => (
              <li
                key={idx}
                className="p-2 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg)] text-[var(--text)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{item}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                    [DEFAULT]
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
