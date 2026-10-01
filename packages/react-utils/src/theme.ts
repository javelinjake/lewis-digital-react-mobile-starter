import { useEffect, useState } from 'react'

export interface UseThemeOptions<TTheme extends string> {
  storageKey: string
  defaultTheme: TTheme
  darkTheme: TTheme
  isValidTheme: (value: string | null) => value is TTheme
}

export function createUseTheme<TTheme extends string>(options: UseThemeOptions<TTheme>) {
  const { storageKey, defaultTheme, darkTheme, isValidTheme } = options

  return function useTheme() {
    const [theme, setThemeState] = useState<TTheme>(defaultTheme)

    function setTheme(value: TTheme) {
      setThemeState(value)
      localStorage.setItem(storageKey, value)
      document.documentElement.dataset.theme = value
    }

    function toggleTheme() {
      setTheme(theme === darkTheme ? defaultTheme : darkTheme)
    }

    useEffect(() => {
      const stored = localStorage.getItem(storageKey)
      setTheme(isValidTheme(stored) ? stored : defaultTheme)
    }, [])

    return { theme, setTheme, toggleTheme }
  }
}
