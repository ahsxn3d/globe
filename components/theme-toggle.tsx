"use client";

import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, type MapTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<MapTheme>("dark");

  useLayoutEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener("anorix-theme", sync);
    return () => window.removeEventListener("anorix-theme", sync);
  }, []);

  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--fg-2)] transition-colors duration-150 hover:bg-[var(--row)] hover:text-[var(--fg-0)]"
      aria-label={next === "light" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => applyTheme(next, true)}
    >
      {theme === "light" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
