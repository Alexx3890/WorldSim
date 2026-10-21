"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "./ui/Badge";
import { SunIcon, MoonIcon, ActivityIcon } from "./ui/Icons";

export interface HeaderProps {
  activeTitle?: string;
  selectedPackId?: string;
  onSelectPackId?: (id: string) => void;
  isBackendConnected?: boolean;
}

export default function Header({
  activeTitle = "New simulation",
  selectedPackId = "hospital",
  onSelectPackId,
  isBackendConnected = true,
}: HeaderProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("worldsim_theme") as "dark" | "light" | null;
    const initialTheme = saved || "dark";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("worldsim_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-40 h-16 flex items-center px-8 justify-between select-none">
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm tracking-tight text-[var(--text)]">
          {activeTitle}
        </span>
        <span className="text-[var(--text-dim)]">/</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">Pack:</span>
          {onSelectPackId ? (
            <select
              value={selectedPackId}
              onChange={(e) => onSelectPackId(e.target.value)}
              className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs px-2.5 py-1 rounded-[var(--radius-sm)] font-mono font-medium focus:border-[var(--accent)]"
            >
              <option value="hospital">Hospital ED (hospital v1.0.0)</option>
              <option value="college">College Admissions (college v1.0.0)</option>
              <option value="office">Office Workspace (office v1.0.0)</option>
              <option value="policy">Municipal Permitting (policy v1.0.0)</option>
              <option value="social">Event Crowd Ingress (social v1.0.0)</option>
            </select>
          ) : (
            <span className="font-mono text-[var(--text)] px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded text-xs">
              {selectedPackId} v1.0.0
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend status chip with green dot */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          />
          <span className="text-[var(--text)] font-medium">
            {isBackendConnected ? "ENGINE ONLINE" : "ENGINE OFFLINE"}
          </span>
          <span className="text-[var(--text-dim)] font-normal hidden md:inline">
            (:8000)
          </span>
        </div>

        {/* Theme Toggle Button with Vector Icon */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
          title="Toggle color theme"
        >
          {theme === "dark" ? (
            <>
              <SunIcon className="w-3.5 h-3.5 text-[var(--warning)]" />
              <span>Light</span>
            </>
          ) : (
            <>
              <MoonIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
