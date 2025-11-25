import React, { useEffect } from 'react';
import { useTheme } from 'react18-themes';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

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
      {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
    </button>
  );
} 