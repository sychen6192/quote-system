import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { DEFAULT_TAB, HASH_TAB_ATTRIBUTE, SETTINGS_TABS } from "@/components/settings/model";
import { SettingsView } from "@/components/settings/settings-view";
import { routing } from "@/navigation";
import { loadSettingsPageData } from "./load-settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Settings" });
  return { title: t("title") };
}

const OTHER_TABS = SETTINGS_TABS.filter((tab) => tab !== DEFAULT_TAB);

// A hard load of /settings#branding would first paint the Company section,
// since the server never sees the hash. This runs while the HTML is parsed:
// it flags the wanted section on <html>, and the CSS below shows only that
// panel until React takes over (settings-view.tsx removes the flag).
const HASH_SCRIPT = `(function(){try{if(document.readyState!=="loading")return;var h=decodeURIComponent(location.hash.slice(1)).toLowerCase();if(${JSON.stringify(
  OTHER_TABS
)}.indexOf(h)>=0)document.documentElement.setAttribute(${JSON.stringify(HASH_TAB_ATTRIBUTE)},h)}catch(e){}})();`;

const HASH_CSS = [
  `html[${HASH_TAB_ATTRIBUTE}] [data-settings-panel]{display:none}`,
  ...OTHER_TABS.map(
    (tab) => `html[${HASH_TAB_ATTRIBUTE}=${tab}] [data-settings-panel=${tab}]{display:block}`
  ),
  // Indeterminate progress bar of the branding uploads.
  "@keyframes settings-progress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}",
].join("");

export default async function SettingsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireSession(locale, pagePath(locale, "/settings"));
  setRequestLocale(locale);
  const t = await getTranslations("Settings");
  const data = await loadSettingsPageData();

  return (
    <PageContainer>
      <style dangerouslySetInnerHTML={{ __html: HASH_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: HASH_SCRIPT }} />
      <PageHeader title={t("title")} />
      <SettingsView data={data} />
    </PageContainer>
  );
}
