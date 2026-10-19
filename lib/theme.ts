export const THEME_KEY = "anorix-theme";

export type MapTheme = "dark" | "light";

export const THEME_BOOT_SCRIPT = `(function(){try{var k="anorix-theme";var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export function readTheme(): MapTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: MapTheme, persist: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (persist) localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new Event("anorix-theme"));
}
