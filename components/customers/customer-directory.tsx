import { Mail, Phone, Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialOf } from "@/components/app-shell/format";
import { cn } from "@/lib/utils";
import { CopyButton, CustomerActionsMenu } from "./customer-actions";

/** One directory row, formatted on the server. */
export type CustomerRowView = {
  key: string;
  companyName: string;
  vatNumber: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  quoteCount: number;
  /** formatted money; null when nothing was accepted */
  acceptedTotal: string | null;
  lastQuoteLabel: string;
  lastQuoteId: number | null;
};

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-base font-semibold text-accent-foreground",
        className
      )}
    >
      {initialOf(name)}
    </span>
  );
}

function NewQuoteButton({ name, className }: { name: string; className?: string }) {
  const t = useTranslations("Customers");
  return (
    <Button asChild variant="outline" size="sm" className={cn("rounded-lg bg-card", className)}>
      <Link
        href={{ pathname: "/quotes/new", query: { customer: name } }}
        aria-label={t("newQuoteFor", { name })}
      >
        <Plus aria-hidden="true" />
        {t("newQuote")}
      </Link>
    </Button>
  );
}

function ContactLines({ row, compact = false }: { row: CustomerRowView; compact?: boolean }) {
  const t = useTranslations("Customers");
  if (!row.contactPerson && !row.email && !row.phone) {
    return <p className="text-sm text-muted-foreground">{t("noContact")}</p>;
  }
  // Table: every line as tall as its copy button. Cards: every line a full
  // 44px touch row, the contact name too, so the rows keep one rhythm.
  const line = cn("flex min-w-0 items-center text-sm", compact ? "min-h-7 gap-2" : "min-h-11 gap-2.5");
  const link = cn(
    "truncate text-muted-foreground underline-offset-4 hover:text-primary hover:underline",
    !compact && "min-w-0 flex-1 py-3 text-foreground/80"
  );
  return (
    <div className={cn("min-w-0", compact && "max-w-[16rem]")}>
      {row.contactPerson ? (
        <p className={cn(line, "font-medium text-foreground")}>
          <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{row.contactPerson}</span>
        </p>
      ) : null}
      {row.email ? (
        <p className={cn(line, "group/contact")}>
          <Mail aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <a
            href={`mailto:${row.email}`}
            title={t("emailTo", { email: row.email })}
            className={link}
          >
            {row.email}
          </a>
          <CopyButton
            value={row.email}
            label={t("copyEmail")}
            copiedMessage={t("emailCopied")}
            className="hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/contact:opacity-100"
          />
        </p>
      ) : null}
      {row.phone ? (
        <p className={cn(line, "group/contact")}>
          <Phone aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <a
            href={`tel:${row.phone.replace(/[^\d+#*,;]/g, "")}`}
            title={t("callTo", { phone: row.phone })}
            className={cn(link, "tabular-nums")}
          >
            {row.phone}
          </a>
          <CopyButton
            value={row.phone}
            label={t("copyPhone")}
            copiedMessage={t("phoneCopied")}
            className="hidden md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover/contact:opacity-100"
          />
        </p>
      ) : null}
    </div>
  );
}

/** Desktop (lg+) customer table. */
export function CustomerTable({ rows }: { rows: CustomerRowView[] }) {
  const t = useTranslations("Customers");
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card lg:block">
      <Table>
        <TableCaption className="sr-only">{t("table.caption")}</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="h-11 pl-5 text-xs font-medium">{t("table.company")}</TableHead>
            <TableHead className="h-11 text-xs font-medium">{t("table.contact")}</TableHead>
            <TableHead className="h-11 text-right text-xs font-medium">{t("table.quotes")}</TableHead>
            <TableHead className="h-11 text-right text-xs font-medium">{t("table.accepted")}</TableHead>
            <TableHead className="hidden h-11 pl-8 text-xs font-medium xl:table-cell">
              {t("table.lastQuote")}
            </TableHead>
            <TableHead className="h-11 pr-3 text-right text-xs font-medium">
              <span className="sr-only">{t("table.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="align-top hover:bg-muted/40">
              {/* w-full + max-w-0: the company column takes the space left and truncates. */}
              <TableCell className="w-full max-w-0 py-4 pl-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={row.companyName} />
                  <div className="min-w-0">
                    <p title={row.companyName} className="truncate font-medium text-foreground">
                      {row.companyName}
                    </p>
                    {row.vatNumber ? (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {t("vat", { vat: row.vatNumber })}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-4">
                <ContactLines row={row} compact />
              </TableCell>
              <TableCell className="py-4 text-right tabular-nums">
                <Link
                  href={{ pathname: "/quotes", query: { customer: row.companyName } }}
                  className="rounded font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                  title={t("viewQuotes")}
                >
                  {row.quoteCount}
                </Link>
              </TableCell>
              <TableCell className="money whitespace-nowrap py-4 text-right font-medium text-foreground">
                {row.acceptedTotal ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap py-4 pl-8 tabular-nums text-muted-foreground xl:table-cell">
                {row.lastQuoteId !== null ? (
                  <Link
                    href={`/quotes/${row.lastQuoteId}`}
                    title={t("openLastQuote")}
                    className="underline-offset-4 hover:text-primary hover:underline"
                  >
                    {row.lastQuoteLabel || "—"}
                  </Link>
                ) : (
                  row.lastQuoteLabel || "—"
                )}
              </TableCell>
              <TableCell className="py-3 pr-3">
                <div className="flex items-center justify-end gap-1">
                  <NewQuoteButton name={row.companyName} className="h-8" />
                  <CustomerActionsMenu
                    name={row.companyName}
                    email={row.email}
                    phone={row.phone}
                    lastQuoteId={row.lastQuoteId}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Phone and tablet (< lg) customer cards, two columns from md. */
export function CustomerCards({ rows }: { rows: CustomerRowView[] }) {
  const t = useTranslations("Customers");
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:hidden">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <Avatar name={row.companyName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold leading-snug text-foreground">
                {row.companyName}
              </p>
              {row.vatNumber ? (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("vat", { vat: row.vatNumber })}
                </p>
              ) : null}
            </div>
            <CustomerActionsMenu
              name={row.companyName}
              email={row.email}
              phone={row.phone}
              lastQuoteId={row.lastQuoteId}
              className="-mr-2 self-start"
            />
          </div>
          <div className="mb-3 mt-2">
            <ContactLines row={row} />
          </div>
          <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-5 border-t pt-3 text-xs">
            <div className="min-w-0">
              <dt className="text-muted-foreground">{t("table.quotes")}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{row.quoteCount}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">{t("acceptedTotal")}</dt>
              <dd className="money mt-0.5 truncate text-sm font-semibold text-foreground">
                {row.acceptedTotal ?? "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">{t("lastQuote")}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
                {row.lastQuoteLabel || "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NewQuoteButton name={row.companyName} className="h-11" />
            <Button asChild variant="secondary" size="sm" className="h-11 rounded-lg">
              <Link href={{ pathname: "/quotes", query: { customer: row.companyName } }}>
                {t("viewQuotes")}
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
