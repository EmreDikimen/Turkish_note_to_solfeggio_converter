/**
 * The Tezhip look, for the phone — the same colours as the web app, copied from
 * `apps/web/src/styles/tokens.css` (DECISIONS 2026-09-30: ivory paper, lapis as the one working
 * colour, gold for ornament only, EB Garamond + Inter). ⚠ A COPY: when a token changes there, change
 * it here; there is no shared file, because CSS variables cannot be read by React Native.
 *
 * Night follows the system, like the web. ⭐ The SCORE never goes dark (the web's `.kv-paper`): the
 * notes sit on `scorePaper` in both themes.
 */
import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  paper: string;
  paperRaised: string;
  paperSunken: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  accent: string;
  accentSoft: string;
  accentOn: string;
  gold: string;
  goldInk: string;
  danger: string;
  /** the score's own paper and ink — light in both themes */
  scorePaper: string;
  scoreInk: string;
  scoreInkFaint: string;
}

const light: Theme = {
  dark: false,
  paper: '#faf1e1',
  paperRaised: '#fffcf4',
  paperSunken: '#f0e6d2',
  ink: '#1b1f2e',
  inkSoft: '#3e4354',
  inkFaint: '#636774',
  rule: '#e2dccd',
  ruleStrong: '#c9c0ab',
  accent: '#1f3a6b',
  accentSoft: '#e4eaf4',
  accentOn: '#ffffff',
  gold: '#b08a3e',
  goldInk: '#8c6a2a',
  danger: '#9e2b25',
  scorePaper: '#f7f4ec',
  scoreInk: '#1b1f2e',
  scoreInkFaint: '#6b6f7c',
};

const dark: Theme = {
  dark: true,
  paper: '#0c1426',
  paperRaised: '#131d35',
  paperSunken: '#080e1b',
  ink: '#ece4d0',
  inkSoft: '#c9bfa8',
  inkFaint: '#958c78',
  rule: '#23304d',
  ruleStrong: '#34446a',
  accent: '#d9b56a',
  accentSoft: '#2a2416',
  accentOn: '#1a1407',
  gold: '#c9a55a',
  goldInk: '#e2c27c',
  danger: '#e0706a',
  // at night the web's paper island is ivory #edeae0 rather than white (DECISIONS 2026-09-30)
  scorePaper: '#edeae0',
  scoreInk: '#1b1f2e',
  scoreInkFaint: '#6b6f7c',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Font family names as `useFonts` registers them in App.tsx. */
export const fonts = {
  display: 'EBGaramond_500Medium',
  displayItalic: 'EBGaramond_500Medium_Italic',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemiBold: 'Inter_600SemiBold',
};
