import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe, KeyRound } from "lucide-react";
import { Link, routing } from "@/navigation";
import { LOCALES } from "@/i18n/locales";
import { safeNextPath } from "@/lib/auth/paths";
import { authEnabled } from "@/lib/auth/session";
import { pickCompanyName } from "@/lib/company-name";
import { getPublicConfig } from "@/services/settings";
import { LoginForm, type LoginError } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
  en: "English",
  "zh-TW": "繁體中文",
};

const FALLBACK_LOGO = "/api/branding/logo";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Switching language on the sign-in page should also switch where it leads.
function withLocale(path: string, from: string, to: string): string {
  const prefix = `/${from}`;
  if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
    return `/${to}${path.slice(prefix.length)}`;
  }
  return path;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function branding(locale: string, fallbackName: string): Promise<{ name: string; logoUrl: string }> {
  try {
    const config = await getPublicConfig();
    return {
      name: config.isDefaultCompany
        ? fallbackName
        : pickCompanyName(config.companyName, config.companyNameLocal, locale),
      logoUrl: config.logoUrl || FALLBACK_LOGO,
    };
  } catch {
    // The sign-in page must keep working while the settings store is unreachable.
    return { name: fallbackName, logoUrl: FALLBACK_LOGO };
  }
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next), `/${locale}`);

  if (!authEnabled()) redirect(next);

  const t = await getTranslations("Auth");
  const tMeta = await getTranslations("Metadata");
  const { name, logoUrl } = await branding(locale, tMeta("title"));

  const rawError = first(sp.error);
  const error: LoginError | null =
    rawError === "throttled" || rawError === "invalid" ? rawError : null;
  const retry = Number(first(sp.retry));
  const retryMinutes = Number.isInteger(retry) && retry > 0 && retry <= 60 ? retry : undefined;

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden pb-safe-8 pl-safe-4 pr-safe-4 pt-safe-3">
      {/* A soft wash of the brand colour behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.16),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.22),transparent_65%)]"
      />

      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border bg-card p-6 text-card-foreground shadow-elevated sm:p-8">
            <div className="mb-7 flex flex-col items-center gap-5 text-center">
              <div className="flex h-16 min-w-16 max-w-[13rem] items-center justify-center rounded-2xl bg-paper px-3 shadow-card ring-1 ring-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- cache-busted branding route, no optimisation */}
                <img
                  src={logoUrl}
                  alt=""
                  width={160}
                  height={40}
                  fetchPriority="high"
                  className="h-10 w-auto max-w-full object-contain"
                />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  {t.rich("description", {
                    name,
                    b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                  })}
                </p>
              </div>
            </div>

            <LoginForm locale={locale} next={next} error={error} retryMinutes={retryMinutes} />

            <p className="mt-6 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              <KeyRound aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("hint")}</span>
            </p>
          </div>

          <nav aria-label={t("language")} className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border bg-card/70 p-1 text-sm shadow-card backdrop-blur">
              <Globe aria-hidden="true" className="ml-2 size-4 text-muted-foreground" />
              {LOCALES.map((l) => (
                <Link
                  key={l}
                  href={{ pathname: "/login", query: { next: withLocale(next, locale, l) } }}
                  locale={l}
                  lang={l}
                  aria-current={l === locale ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-3.5 font-medium transition-colors sm:h-9",
                    l === locale
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {LOCALE_NAMES[l]}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
