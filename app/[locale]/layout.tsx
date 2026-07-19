import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Toaster } from "sonner";
import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import NextTopLoader from "nextjs-toploader";
import { getAppConfig, toPublicConfig } from "@/lib/config";
import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TopNav } from "@/components/app-shell/top-nav";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const config = getAppConfig();
  const title = config.company.isDefault
    ? t("title")
    : `${config.company.name} | ${t("title")}`;

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
            color="#6366f1"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #6366f1,0 0 5px #6366f1"
          />
          <AppConfigProvider value={publicConfig}>
            <NextIntlClientProvider messages={messages}>
              <TopNav />
              <main className="app-bg min-h-[calc(100vh-3.5rem)]">
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
