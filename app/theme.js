/**
 * theme.js - applies kiosk theme config to CSS custom properties.
 */

import { CONFIG } from './config.js';

const THEME_VARIABLES = Object.freeze({
  primary:           '--ft-blue',
  primaryLight:      '--ft-blue-light',
  primaryDark:       '--ft-blue-dark',
  primarySoft:       '--ft-primary-soft',
  primarySoftStrong: '--ft-primary-soft-strong',
  accent:            '--ft-accent',
  background:        '--ft-gray-bg',
  surface:           '--ft-surface',
  text:              '--ft-text',
  muted:             '--ft-gray-text',
  success:           '--ft-green',
  warning:           '--ft-amber',
  danger:            '--ft-red',
  border:            '--ft-border',
  onPrimary:         '--ft-on-primary',
  onPrimaryMuted:    '--ft-on-primary-muted',
  onPrimarySoft:     '--ft-on-primary-soft',
});

export function applyTheme(theme = CONFIG.KIOSK_THEME) {
  const root = document.documentElement;
  if (!root || !theme) return;

  for (const [key, cssVar] of Object.entries(THEME_VARIABLES)) {
    const value = theme[key];
    if (value) root.style.setProperty(cssVar, value);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && theme.primary) {
    themeMeta.setAttribute('content', theme.primary);
  }
}
