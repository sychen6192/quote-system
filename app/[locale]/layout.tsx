import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Toaster } from "sonner";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/navigation";
import NextTopLoader from "nextjs-toploader";
import { getAppConfig, toPublicConfig } from "@/lib/config";
import { pickCompanyName } from "@/lib/company-name";
import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TopNav } from "@/components/app-shell/top-nav";

const inter = Inter({ subsets: ["latin"] });

// Only the configured locales exist: anything else in the first segment
// (/foo, /sw.js, /manifest.webmanifest) is a 404, never the dashboard.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const config = getAppConfig();
  const displayName = pickCompanyName(
    config.company.name,
    config.company.nameLocal,
    locale
  );
  const title = config.company.isDefault
    ? t("title")
    : `${displayName} | ${t("title")}`;

  return {
    title,
    description: t("description"),
    icons: { icon: "/api/branding-icon" },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const publicConfig = toPublicConfig(getAppConfig());

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextTopLoader
            color="#1D4ED8"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #1D4ED8,0 0 5px #1D4ED8"
          />
          <AppConfigProvider value={publicConfig}>
            <NextIntlClientProvider messages={messages}>
              <TopNav />
              <main className="min-h-[calc(100vh-3.5rem)] bg-muted/30">
                {children}
              </main>
            </NextIntlClientProvider>
          </AppConfigProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
