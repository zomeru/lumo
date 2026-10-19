import { Monitor, Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./menu";

type Theme = "light" | "dark" | "system";
const storageKey = "lumo.theme.v1";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* Preferences may be unavailable. */
  }
  return "system";
}
function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
export function initializeTheme() {
  applyTheme(readTheme());
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(readTheme);
  const setTheme = (next: Theme) => {
    updateTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Session preference still works. */
    }
  };
  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const change = () => {
      if (theme === "system") applyTheme(theme);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === storageKey) updateTheme(readTheme());
    };
    media?.addEventListener("change", change);
    window.addEventListener("storage", storage);
    return () => {
      media?.removeEventListener("change", change);
      window.removeEventListener("storage", storage);
    };
  }, [theme]);
  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}
export function ThemeMenu() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeMenu requires ThemeProvider");
  const { theme, setTheme } = context;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change appearance">
          <Sun className="dark:hidden" aria-hidden="true" />
          <Moon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {(
          [
            { value: "light", label: "Light", Icon: Sun },
            { value: "dark", label: "Dark", Icon: Moon },
            { value: "system", label: "System", Icon: Monitor },
          ] as const
        ).map(({ value, label, Icon }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={theme === value}
            onSelect={() => setTheme(value)}
          >
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
