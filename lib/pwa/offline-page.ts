// The offline fallback page (/offline.html). Pure: it must render with no
// network at all, so everything (CSS, script, icon) is inline and both
// languages ship in the markup; a head script picks one before first paint.
import { LOCALES, DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";

export type OfflinePageText = {
  title: string;
  description: string;
  retry: string;
  checking: string;
  stillOffline: string;
  autoReload: string;
  whileOffline: string;
  tipDrafts: string;
  tipConnection: string;
};

export type ColorPair = { background: string; foreground: string };

export type OfflinePageInput = {
  text: Record<AppLocale, OfflinePageText>;
  /** The brand name shown in each language. */
  names: Record<AppLocale, string>;
  /** Small PNG data URI of the app icon, or null. */
  iconDataUri: string | null;
  /** Primary button colours (CSS colour values) for each theme. */
  primary: { light: ColorPair; dark: ColorPair };
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Only colour syntax we generate ourselves (hex / hsl() with digits) reaches the CSS. */
export function safeCssColor(value: string, fallback: string): string {
  return /^(#[0-9a-fA-F]{3,8}|hsl\(\s*[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%\s*\))$/.test(value.trim())
    ? value.trim()
    : fallback;
}

// Lucide (https://lucide.dev, ISC License) paths.
const ICONS = {
  wifiOff:
    '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  draft:
    '<path d="m18.226 5.226-2.52-2.52A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.351"/><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><path d="M8 18h1"/>',
  cloudOff:
    '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
} as const;

function svg(name: keyof typeof ICONS, className = "icon"): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

type TextKey = keyof OfflinePageText;

export function renderOfflinePage(input: OfflinePageInput): string {
  const both = (pick: (locale: AppLocale) => string) =>
    LOCALES.map((locale) => `<span lang="${locale}">${escapeHtml(pick(locale))}</span>`).join("");
  const t = (key: TextKey) => both((locale) => input.text[locale][key]);

  const light = {
    bg: safeCssColor(input.primary.light.background, "#1d4ed8"),
    fg: safeCssColor(input.primary.light.foreground, "#ffffff"),
  };
  const dark = {
    bg: safeCssColor(input.primary.dark.background, "#4b8df8"),
    fg: safeCssColor(input.primary.dark.foreground, "#090e1a"),
  };

  const darkVars = `--bg:hsl(222 47% 4%);--card:hsl(221 39% 13%);--fg:hsl(210 40% 96%);--muted:hsl(215 20% 68%);--border:hsl(217 33% 21%);--tile:hsl(217 33% 19%);--warn:hsl(38 92% 56%);--warn-bg:hsl(38 92% 56% / .14);--primary:${dark.bg};--primary-fg:${dark.fg};--shadow:0 1px 2px hsl(0 0% 0% / .4),0 16px 40px -16px hsl(0 0% 0% / .6);color-scheme:dark;`;

  const titles = Object.fromEntries(
    LOCALES.map((locale) => [locale, `${input.text[locale].title} · ${input.names[locale]}`])
  );

  // Locale: the URL being opened (/zh-TW/…), then the app's cookie, then the
  // browser. Theme: next-themes' stored choice, then the system.
  const headScript = `(function(){var d=document.documentElement,l=${JSON.stringify(DEFAULT_LOCALE)},L=${JSON.stringify(LOCALES)},T=${JSON.stringify(titles).replace(/</g, "\\u003c")};try{var p=location.pathname.split("/")[1],c=(document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)||[])[1],n=(navigator.languages&&navigator.languages[0])||navigator.language||"";if(L.indexOf(p)>=0)l=p;else if(L.indexOf(c)>=0)l=c;else if(/^zh/i.test(n))l="zh-TW";}catch(e){}d.lang=l;document.title=T[l]||document.title;try{var s=localStorage.getItem("theme");if(s==="dark"||s==="light")d.classList.add(s);}catch(e){}})();`;

  const bodyScript = `(function(){var b=document.getElementById("retry"),s=document.getElementById("status");function done(){b.removeAttribute("data-busy");b.removeAttribute("aria-busy");b.disabled=false;}function check(){if(b.hasAttribute("data-busy"))return;b.setAttribute("data-busy","");b.setAttribute("aria-busy","true");b.disabled=true;s.hidden=true;var t=Date.now();fetch("/api/health",{cache:"no-store"}).then(function(r){if(r.status>=500)throw new Error(String(r.status));location.reload();}).catch(function(){setTimeout(function(){done();s.hidden=false;b.focus();},Math.max(0,700-(Date.now()-t)));});}b.addEventListener("click",check);window.addEventListener("online",function(){location.reload();});})();`;

  const icon = input.iconDataUri
    ? `<img class="brand-icon" src="${escapeHtml(input.iconDataUri)}" width="32" height="32" alt="">`
    : "";

  const localeHide = LOCALES.map(
    (locale) => `html[lang="${locale}"] [lang]:not([lang="${locale}"])`
  ).join(",");

  return `<!doctype html>
<html lang="${DEFAULT_LOCALE}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(titles[DEFAULT_LOCALE])}</title>
<script>${headScript}</script>
<style>
:root{--bg:hsl(220 14% 94%);--card:#fff;--fg:hsl(222 47% 11%);--muted:hsl(220 9% 40%);--border:hsl(220 13% 89%);--tile:hsl(220 14% 96%);--warn:hsl(25 90% 35%);--warn-bg:hsl(25 90% 35% / .1);--primary:${light.bg};--primary-fg:${light.fg};--shadow:0 1px 2px hsl(222 47% 11% / .05),0 16px 40px -16px hsl(222 47% 11% / .18);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not(.light){${darkVars}}}
:root.dark{${darkVars}}
${localeHide}{display:none}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:420px;background:var(--card);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow);padding:28px 24px 24px;text-align:center}
@media (min-width:480px){main{padding:36px 36px 28px}}
.brand{display:flex;align-items:center;justify-content:center;gap:10px;min-height:32px;margin:0 0 28px;font-size:14px;font-weight:600;color:var(--muted)}
.brand-icon{width:32px;height:32px;flex:none;border-radius:8px;box-shadow:0 0 0 1px var(--border),0 1px 2px hsl(222 47% 11% / .06)}
.brand-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.badge{width:64px;height:64px;margin:0 auto 18px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--warn-bg);color:var(--warn)}
.badge .icon{width:30px;height:30px}
h1{margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:650;letter-spacing:-.01em}
.lead{margin:0 auto 24px;max-width:34ch;color:var(--muted)}
button{appearance:none;width:100%;min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;background:var(--primary);color:var(--primary-fg);font:inherit;font-weight:600;cursor:pointer;transition:filter .15s,transform .15s}
button:hover{filter:brightness(1.06)}
button:active{transform:scale(.99)}
button:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
button[disabled]{cursor:progress;opacity:.85}
button .icon{width:18px;height:18px}
button[data-busy] .icon{animation:spin 1s linear infinite}
button[data-busy] .idle,button:not([data-busy]) .busy{display:none}
@keyframes spin{to{transform:rotate(360deg)}}
.status{margin:12px 0 0;font-size:14px;font-weight:500;color:var(--warn)}
.status[hidden]{display:none}
.hint{display:flex;align-items:center;justify-content:center;gap:8px;margin:14px 0 0;font-size:13px;color:var(--muted)}
.dot{width:8px;height:8px;flex:none;border-radius:999px;background:var(--warn);animation:pulse 2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.35}}
section{margin:24px 0 0;padding:20px 0 0;border-top:1px solid var(--border);text-align:left}
h2{margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
li{display:flex;gap:12px;align-items:flex-start;font-size:14px}
.tile{width:32px;height:32px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--tile);color:var(--muted)}
.tile .icon{width:16px;height:16px}
.tip{margin:0;padding-top:5px}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<main>
<div class="brand">${icon}<span class="brand-name">${both((locale) => input.names[locale])}</span></div>
<div class="badge">${svg("wifiOff")}</div>
<h1>${t("title")}</h1>
<p class="lead">${t("description")}</p>
<button id="retry" type="button">${svg("refresh")}<span class="idle">${t("retry")}</span><span class="busy">${t("checking")}</span></button>
<p id="status" class="status" role="status" aria-live="polite" hidden>${t("stillOffline")}</p>
<p class="hint"><span class="dot" aria-hidden="true"></span>${t("autoReload")}</p>
<section>
<h2>${t("whileOffline")}</h2>
<ul>
<li><span class="tile">${svg("draft")}</span><p class="tip">${t("tipDrafts")}</p></li>
<li><span class="tile">${svg("cloudOff")}</span><p class="tip">${t("tipConnection")}</p></li>
</ul>
</section>
</main>
<script>${bodyScript}</script>
</body>
</html>
`;
}
