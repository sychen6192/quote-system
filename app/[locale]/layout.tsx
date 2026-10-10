import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import NextTopLoader from "nextjs-toploader";
import { routing } from "@/navigation";
import { getPublicConfig } from "@/services/settings";
import { isAuthenticated } from "@/lib/auth/guard";
import { brandColorCss, brandHex } from "@/lib/brand-color";
import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { signedOutConfig } from "@/components/providers/signed-out-config";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppToaster } from "@/components/providers/app-toaster";
import { AppShell } from "@/components/app-shell/app-shell";
import { appDisplayName, brandDisplayName, shortAppName } from "@/components/app-shell/brand-name";
import { appIconLinks } from "@/components/app-shell/icon-links";
import { PwaRoot } from "@/components/pwa/pwa-root";
import { THEME_COLORS } from "@/lib/pwa/platform";
import { getIconVersion } from "@/lib/pwa/render-icon";

// Self-hosted (OFL, @fontsource-variable/inter latin subset): builds must not
// depend on reaching Google Fonts — air-gapped / firewalled self-hosters.
const inter = localFont({
  src: "../fonts/InterVariable-latin.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

// Only the configured locales exist: anything else in the first segment
// (/foo, /sw.js, /manifest.webmanifest) is a 404, never the dashboard.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, config, iconVersion] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getPublicConfig(),
    getIconVersion(),
  ]);
  const appName = appDisplayName(config, t("title"));
  const brand = brandDisplayName(config, locale, t("title"));

  return {
    title: { default: brand, template: `%s | ${appName}` },
    description: t("description"),
    applicationName: appName,
    robots: { index: false, follow: false },
    icons: appIconLinks(iconVersion),
    appleWebApp: { capable: true, title: shortAppName(appName), statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

// The top bar's colours, not the brand colour: PwaRoot keeps theme-color in
// sync with the theme actually shown, so starting from the brand colour would
// flash it in the status bar on every load. (The manifest keeps the brand
// colour for the splash screen.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Params;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [messages, config, signedIn] = await Promise.all([
    getMessages(),
    getPublicConfig(),
    // Always true without APP_PASSWORD.
    isAuthenticated(),
  ]);
  // The config is serialised into every page, the sign-in page included.
  const clientConfig = signedIn ? config : signedOutConfig(config);
  const brandCss = brandColorCss(config.brandColor);
  const brand = brandHex(config.brandColor);

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Not Next's metadata manifest, which is linked without crossorigin:
            with credentials, a login proxy in front of the app lets it through
            (app/manifest.webmanifest/route.ts). */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        {/* Numbers only (lib/brand-color.ts), so inlining is safe. */}
        {brandCss ? <style id="brand-color" dangerouslySetInnerHTML={{ __html: brandCss }} /> : null}
      </head>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextTopLoader color={brand} height={3} showSpinner={false} shadow={false} zIndex={1600} />
          <NextIntlClientProvider messages={messages}>
            <AppConfigProvider value={clientConfig}>
              <AppShell>{children}</AppShell>
              <AppToaster />
              <PwaRoot />
            </AppConfigProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
