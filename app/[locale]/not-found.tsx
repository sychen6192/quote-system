import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("Errors");

  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted" aria-hidden="true">
        <FileQuestion className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold tabular-nums text-muted-foreground">404</p>
      <h1 id="not-found-title" className="text-2xl font-bold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="text-muted-foreground">{t("notFound.description")}</p>
      <Button asChild className="mt-2">
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
          {t("backToDashboard")}
        </Link>
      </Button>
    </section>
  );
}
