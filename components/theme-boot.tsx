"use client";

import { useLayoutEffect } from "react";
import { THEME_KEY, applyTheme } from "@/lib/theme";

export function ThemeBoot() {
  useLayoutEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    applyTheme(theme, false);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onMedia = () => {
      if (localStorage.getItem(THEME_KEY)) return;
      applyTheme(media.matches ? "light" : "dark", false);
    };
    media.addEventListener("change", onMedia);
    return () => media.removeEventListener("change", onMedia);
  }, []);

  return null;
}
