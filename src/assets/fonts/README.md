# Material Symbols Outlined

The full variable icon font is bundled locally to support every module without
requiring access to Google Fonts from the SAP network.

Source: Google Fonts, Material Symbols Outlined, version 377:
https://fonts.gstatic.com/s/materialsymbolsoutlined/v377/kJEhBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oFsI.woff2

License: Apache 2.0, included in public/licenses/LICENSE.material-symbols.txt from
https://github.com/google/material-design-icons/blob/master/LICENSE

Keep the complete font when adding icons; a subset may omit dynamic icon names.

Production builds embed this complete font in CSS via the Vite assetsInlineLimit
callback. There is no separate WOFF2 upload or request. Keep font-src data: allowed
if the host enforces Content Security Policy. BSP tests verify the decoded embedded
bytes exactly match this source font.
