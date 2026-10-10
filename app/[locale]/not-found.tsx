import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileQuestion, FileText } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { IconIllustration } from "@/components/app-shell/empty-state";

export default async function NotFound() {
  const t = await getTranslations("Errors");

  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-4 py-16 text-center"
    >
      <IconIllustration icon={FileQuestion} />
      <div className="space-y-2">
        <p className="text-sm font-semibold tabular-nums tracking-wider text-primary">404</p>
        <h1 id="not-found-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("notFound.title")}
        </h1>
        <p className="leading-relaxed text-muted-foreground">{t("notFound.description")}</p>
      </div>
      <div className="mt-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button asChild className="h-11 rounded-lg sm:h-10">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            {t("backToDashboard")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-lg bg-card sm:h-10">
          <Link href="/quotes">
            <FileText aria-hidden="true" />
            {t("goToQuotes")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
