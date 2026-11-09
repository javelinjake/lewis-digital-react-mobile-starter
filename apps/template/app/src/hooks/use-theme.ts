import { createUseTheme } from '@ld/react-utils'
import { isAppTheme } from '@/config/theme.config'

export const useTheme = createUseTheme({
  storageKey: 'app-theme',
  defaultTheme: 'cmyk',
  darkTheme: 'dracula',
  isValidTheme: isAppTheme,
})
