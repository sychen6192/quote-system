import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { LOCALES } from "@/i18n/locales";
import { safeNextPath } from "@/lib/auth/paths";
import { authEnabled } from "@/lib/auth/session";
import { pickCompanyName } from "@/lib/company-name";
import { getPublicConfig } from "@/services/settings";
import { Card } from "@/components/ui/card";
import { LoginForm, type LoginError } from "@/components/auth/login-form";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
  en: "English",
  "zh-TW": "繁體中文",
};

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

async function displayName(locale: string, fallback: string): Promise<string> {
  try {
    const config = await getPublicConfig();
    if (config.isDefaultCompany) return fallback;
    return pickCompanyName(config.companyName, config.companyNameLocal, locale);
  } catch {
    // The sign-in page must keep working while the settings store is unreachable.
    return fallback;
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
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next), `/${locale}`);

  if (!authEnabled()) redirect(next);

  const t = await getTranslations("Auth");
  const tMeta = await getTranslations("Metadata");
  const name = await displayName(locale, tMeta("title"));

  const rawError = first(sp.error);
  const error: LoginError | null =
    rawError === "throttled" || rawError === "invalid" ? rawError : null;
  const retry = Number(first(sp.retry));
  const retryMinutes = Number.isInteger(retry) && retry > 0 && retry <= 60 ? retry : undefined;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/api/branding-icon"
            alt=""
            width={64}
            height={64}
            unoptimized
            priority
            className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-sm ring-1 ring-border"
          />
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("description", { name })}</p>
        </div>

        <Card className="p-6 shadow-md">
          <LoginForm locale={locale} next={next} error={error} retryMinutes={retryMinutes} />
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          {t("hint")}
        </p>

        <nav aria-label={t("language")} className="mt-4 flex justify-center gap-1 text-sm">
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={{ pathname: "/login", query: { next: withLocale(next, locale, l) } }}
              locale={l}
              lang={l}
              aria-current={l === locale ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                l === locale
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {LOCALE_NAMES[l]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
