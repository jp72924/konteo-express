# Branding And Theme

RetailOps Kiosk can be branded per station by editing `config.local.js`.

## Logo

Use `BRAND_LOGO_URL` for a local asset or public HTTPS URL.

```js
BRAND_LOGO_URL: "./assets/logo.svg",
BRAND_LOGO_ALT: "My Store",
BRAND_SUBTITLE: "self-checkout",
BRAND_SHOW_TEXT: true,
```

Recommended logo formats:

- SVG for crisp app marks and wordmarks.
- PNG/WebP for raster artwork.
- Transparent background when possible.
- Square icon for compact marks.
- Wide wordmark is fine when `BRAND_SHOW_TEXT` is `false`.

Keep local brand assets inside a public folder such as:

```text
assets/branding/
```

## Theme

Theme values are CSS colors. Supported formats include hex, `rgb()`, `rgba()`,
`hsl()`, and `hsla()`.

```js
KIOSK_THEME: {
  primary: "#0057A8",
  primaryLight: "#1A72C8",
  primaryDark: "#003D7A",
  primarySoft: "#EEF5FF",
  primarySoftStrong: "#D6E8FF",
  accent: "#00CFFF",
  background: "#F4F6FA",
  surface: "#FFFFFF",
  text: "#1A2033",
  muted: "#6B7280",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
  border: "rgba(0, 87, 168, 0.15)",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "rgba(255,255,255,0.72)",
  onPrimarySoft: "rgba(255,255,255,0.86)",
}
```

## Practical Guidelines

- Keep high contrast between `primary` and `onPrimary`.
- Keep `success`, `warning`, and `danger` visually distinct from `primary`.
- Avoid using the same color family for every state.
- Test mobile portrait first; the kiosk UI is optimized for touch screens.
- Increment `APP_VERSION` after changing assets so installed PWAs refresh.
