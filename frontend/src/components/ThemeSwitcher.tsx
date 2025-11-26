import React, { useEffect } from 'react';
import { useTheme } from 'react18-themes';
import { Moon, Sun } from '@phosphor-icons/react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Manually set the data-theme attribute as a workaround
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-md bg-transparent text-foreground hover:bg-muted"
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
} 