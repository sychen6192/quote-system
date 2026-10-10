// Detail page side panels. No client state: rendered on the server.
import type { ReactNode } from "react";
import { Mail, MapPin, Phone, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuoteViewCustomer } from "@/lib/quote-view";
import { cn } from "@/lib/utils";
import { Link } from "@/navigation";

export function SideCard({
  title,
  titleId,
  children,
  className,
}: {
  title: string;
  titleId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn("rounded-xl border bg-card p-4 text-card-foreground shadow-card sm:p-5 print:hidden", className)}
    >
      <h2 id={titleId} className="mb-3 text-sm font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const linkClass =
  "-my-2.5 inline-flex min-h-11 items-center break-all rounded-sm text-primary underline-offset-4 hover:underline md:-my-1 md:min-h-8";

export function CustomerCard({ customer }: { customer: QuoteViewCustomer }) {
  const t = useTranslations("QuoteDetail.customer");
  const company = customer.companyName;
  const hasContact = Boolean(customer.contactPerson || customer.email || customer.phone || customer.address);

  return (
    <SideCard title={t("title")} titleId="quote-customer-title">
      {company ? <p className="font-semibold leading-snug text-foreground">{company}</p> : null}
      {customer.vatNumber ? (
        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
          {t("vatNumber")} {customer.vatNumber}
        </p>
      ) : null}
      {hasContact ? (
        <dl className="mt-3 space-y-2.5 text-sm">
          {customer.contactPerson ? (
            <ContactRow icon={<UserRound />} label={t("contact")}>
              {customer.contactPerson}
            </ContactRow>
          ) : null}
          {customer.email ? (
            <ContactRow icon={<Mail />} label={t("email")}>
              <a href={`mailto:${customer.email}`} className={linkClass}>
                {customer.email}
              </a>
            </ContactRow>
          ) : null}
          {customer.phone ? (
            <ContactRow icon={<Phone />} label={t("phone")}>
              <a href={`tel:${customer.phone.replace(/[^\d+#*,;]/g, "")}`} className={linkClass}>
                {customer.phone}
              </a>
            </ContactRow>
          ) : null}
          {customer.address ? (
            <ContactRow icon={<MapPin />} label={t("address")}>
              <span className="whitespace-pre-line text-foreground">{customer.address}</span>
            </ContactRow>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("noContact")}</p>
      )}
      {company ? (
        <div className="mt-4 border-t pt-3">
          <Link
            href={{ pathname: "/quotes", query: { customer: company } }}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-8"
          >
            <Search aria-hidden="true" className="size-4" />
            {t("viewQuotes")}
          </Link>
        </div>
      ) : null}
    </SideCard>
  );
}

export type DetailsRow = { label: string; value: string | null };

export function DetailsCard({ rows }: { rows: DetailsRow[] }) {
  const t = useTranslations("QuoteDetail.details");
  const shown = rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
  return (
    <SideCard title={t("title")} titleId="quote-details-title">
      <dl className="divide-y text-sm">
        {shown.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SideCard>
  );
}

export function ActivityCard({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations("QuoteDetail.activity");
  return (
    <SideCard title={t("title")} titleId="quote-activity-title" className={className}>
      {children}
    </SideCard>
  );
}
