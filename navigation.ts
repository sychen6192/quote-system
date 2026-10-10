import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  LOCALES,
} from './i18n/locales';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Persistent (next-intl defaults to a session cookie), so the language
  // picked in the switcher survives browser and app restarts. Set by the
  // proxy on page loads and by the client router on a language switch.
  localeCookie: { name: LOCALE_COOKIE_NAME, maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS },
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
