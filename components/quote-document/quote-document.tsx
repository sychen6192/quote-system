// The quote as an A4 sheet of paper. Client-safe (no server-only imports, no
// hooks): rendered by the quote detail page (server) and the live preview
// (client). It stays white with dark ink in dark mode, like paper; every
// colour inside is fixed and reaches 4.5:1 on white.
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { pickCompanyName } from "@/lib/company-name";
import type { QuoteView } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";
import { cn } from "@/lib/utils";
import { documentAccent } from "./accent";
import {
  amountInWords,
  formatAmount,
  formatDocumentDate,
  formatQuantity,
  formatRate,
  formatTotal,
  present,
  type DocumentMoney,
} from "./format";
import { fillLabel, type QuoteDocumentLabels } from "./label-keys";

export type { QuoteDocumentLabels } from "./label-keys";

export type QuoteDocumentProps = {
  view: QuoteView;
  /** getDocumentBranding("html") on the server; the client gets it via props */
  branding: DocumentBranding;
  labels: QuoteDocumentLabels;
  /** UI locale, used for date formatting */
  locale: string;
  /** Live preview: adds data-edit-field targets + hover affordances */
  interactive?: boolean;
  /** Called with a form field path (e.g. "items.2.productName") when an editable region is clicked */
  onEditField?: (field: string) => void;
  /** e.g. "printable-content" on the detail page (globals.css print rules) */
  id?: string;
  className?: string;
};

const EDITABLE =
  "cursor-pointer rounded-[3px] outline-offset-2 transition-colors hover:bg-sky-50 hover:outline hover:outline-1 hover:outline-dashed hover:outline-sky-600";

function editTarget(event: { target: EventTarget | null; currentTarget: HTMLElement }): string | null {
  const element = (event.target as Element | null)?.closest?.("[data-edit-field]");
  if (!element || !event.currentTarget.contains(element)) return null;
  return element.getAttribute("data-edit-field");
}

export function QuoteDocument({
  view,
  branding,
  labels,
  locale,
  interactive = false,
  onEditField,
  id,
  className,
}: QuoteDocumentProps) {
  const accent = documentAccent(branding.brandColor);
  const money: DocumentMoney = {
    currency: branding.currency,
    currencyLocale: branding.currencyLocale,
    fractionDigits: branding.fractionDigits,
  };
  const { company, payment } = branding;
  const { customer, totals } = view;
  const date = (iso: string | null) => formatDocumentDate(iso, locale);

  const companyName = pickCompanyName(company.name, company.nameLocal, locale);
  const companyAltName = [company.name, company.nameLocal]
    .map((name) => name.trim())
    .find((name) => name && name !== companyName);

  // Click-to-edit: one delegated handler, so a server render carries none.
  const editable = (field: string, className?: string) =>
    interactive
      ? {
          "data-edit-field": field,
          role: "button" as const,
          tabIndex: 0,
          title: labels.editField,
          className: cn(EDITABLE, className),
        }
      : { className };
  const rootHandlers =
    interactive && onEditField
      ? {
          onClick: (event: MouseEvent<HTMLElement>) => {
            const field = editTarget(event);
            if (field) onEditField(field);
          },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const field = editTarget(event);
            if (!field || (event.target as Element).getAttribute("data-edit-field") !== field) return;
            event.preventDefault();
            onEditField(field);
          },
        }
      : {};

  // Rows of the letterhead, each a set of parts laid out with a gap.
  const companyLines: string[][] = [
    [present(company.address)],
    [
      present(company.phone) && `${labels.phone} ${company.phone.trim()}`,
      present(company.email),
    ],
    [
      present(company.vatNumber) && `${labels.vatNumber} ${company.vatNumber.trim()}`,
      present(company.website),
    ],
  ]
    .map((parts) => parts.filter((part): part is string => Boolean(part)))
    .filter((parts) => parts.length > 0);

  const meta: { field: string; label: string; value: string | null }[] = [
    { field: "issuedDate", label: labels.issuedDate, value: date(view.issuedDate) || null },
    { field: "validUntil", label: labels.validUntil, value: date(view.validUntil) || null },
    { field: "salesperson", label: labels.salesperson, value: present(view.salesperson) },
    { field: "paymentTerms", label: labels.paymentTerms, value: present(view.paymentTerms) },
    { field: "deliveryMethod", label: labels.deliveryMethod, value: present(view.deliveryMethod) },
    { field: "deliveryDate", label: labels.deliveryDate, value: date(view.deliveryDate) || null },
    { field: "currency", label: labels.currency, value: money.currency },
  ];

  const contactLine = [present(customer.email), present(customer.phone)].filter(Boolean);
  const paymentRows = payment
    ? [
        { label: labels.bankName, value: present(payment.bankName) },
        { label: labels.bankCode, value: present(payment.bankCode) },
        { label: labels.accountName, value: present(payment.accountName) },
        { label: labels.accountNumber, value: present(payment.accountNumber) },
      ].filter((row): row is { label: string; value: string } => row.value !== null)
    : [];
  const notes = present(view.notes);
  const terms = present(view.terms);
  const footer = present(branding.footerText);

  return (
    <article
      id={id}
      aria-label={fillLabel(labels.documentLabel, { number: view.quotationNumber ?? "" }).trim()}
      className={cn(
        "relative flex min-h-[297mm] w-[210mm] flex-col bg-paper text-[12.5px] leading-[1.55] text-paper-foreground antialiased",
        "print:min-h-0 print:w-auto",
        className
      )}
      style={{ "--doc-accent": accent.color } as CSSProperties}
      {...rootHandlers}
    >
      <div aria-hidden="true" className="h-[5px] w-full shrink-0 print:hidden" style={{ background: accent.color }} />

      <div className="flex flex-1 flex-col px-[15mm] pb-[13mm] pt-[11mm] print:px-0 print:pb-0 print:pt-0">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-8">
          <div className="flex min-w-0 items-start gap-4">
            {branding.logoSrc ? (
              // Branding images are served by /api/branding (no next/image optimiser).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoSrc}
                alt=""
                className="mt-0.5 h-auto max-h-[16mm] w-auto max-w-[38mm] shrink-0 object-contain"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-snug tracking-tight text-slate-900">{companyName}</p>
              {companyAltName ? <p className="text-[12px] font-medium text-slate-600">{companyAltName}</p> : null}
              {companyLines.length ? (
                <div className="mt-1.5 space-y-0.5 text-[11px] leading-[1.5] text-slate-600">
                  {companyLines.map((parts) => (
                    <p key={parts.join("|")} className="flex flex-wrap gap-x-3">
                      {parts.map((part) => (
                        <span key={part} className="whitespace-pre-line">
                          {part}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <h2 className="text-[28px] font-bold leading-none tracking-tight" style={{ color: accent.text }}>
              {labels.title}
            </h2>
            {labels.titleAlt ? (
              <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                {labels.titleAlt}
              </p>
            ) : null}
            <dl className="mt-3 inline-grid grid-cols-[auto_auto] items-baseline gap-x-2.5 text-[11.5px]">
              <dt className="text-slate-500">{labels.number}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {view.quotationNumber ?? <span className="font-normal italic text-slate-500">{labels.numberPending}</span>}
              </dd>
            </dl>
          </div>
        </header>

        <div aria-hidden="true" className="mt-6 h-px w-full bg-slate-200" />

        {/* Parties and terms */}
        <section className="mt-6 grid grid-cols-[1fr_1.1fr] gap-8">
          <div className="min-w-0">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: accent.text }}>
              {labels.billTo}
            </h3>
            <div {...editable("customer.companyName", "mt-1.5 text-[15px] font-semibold leading-snug text-slate-900")}>
              {customer.companyName ?? (
                <span className="font-normal italic text-slate-500">{labels.customerPlaceholder}</span>
              )}
            </div>
            <div className="mt-1 space-y-0.5 text-[12px] text-slate-700">
              {customer.contactPerson ? (
                <p {...editable("customer.contactPerson")}>
                  <span className="text-slate-500">{labels.attn}</span> {customer.contactPerson}
                </p>
              ) : null}
              {customer.address ? (
                <p {...editable("customer.address", "whitespace-pre-line")}>{customer.address}</p>
              ) : null}
              {contactLine.length ? (
                <p className="flex flex-wrap gap-x-3">
                  {customer.email ? <span {...editable("customer.email", "break-all")}>{customer.email}</span> : null}
                  {customer.phone ? (
                    <span {...editable("customer.phone", "tabular-nums")}>
                      <span className="text-slate-500">{labels.phone}</span> {customer.phone}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {customer.vatNumber ? (
                <p {...editable("customer.vatNumber", "tabular-nums")}>
                  <span className="text-slate-500">{labels.vatNumber}</span> {customer.vatNumber}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="grid h-fit grid-cols-2 gap-x-5 gap-y-2 rounded-md border border-slate-200 px-4 py-3">
            {meta
              .filter((row) => row.value !== null)
              .map((row) => (
                <div key={row.field} className="min-w-0">
                  <dt className="text-[10.5px] leading-tight text-slate-500">{row.label}</dt>
                  {/* The edit target sits inside the <dd>: a <dd> cannot be a button. */}
                  <dd className="mt-0.5 break-words text-[12px] font-semibold tabular-nums text-slate-900">
                    <span {...editable(row.field)}>{row.value}</span>
                  </dd>
                </div>
              ))}
          </dl>
        </section>

        {view.title ? (
          <p className="mt-6 text-[13.5px] text-slate-900">
            <span className="mr-2 text-slate-500">{labels.subject}</span>
            <span {...editable("title", "font-semibold")}>{view.title}</span>
          </p>
        ) : null}

        {/* Items */}
        <table className={cn("w-full border-collapse text-[12px]", view.title ? "mt-3" : "mt-7")}>
          <colgroup>
            <col className="w-[12mm]" />
            <col />
            <col className="w-[24mm]" />
            <col className="w-[29mm]" />
            <col className="w-[31mm]" />
          </colgroup>
          <thead>
            <tr
              className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-700"
              style={{ background: accent.soft, boxShadow: `inset 0 -1.5px 0 ${accent.color}` }}
            >
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                {labels.colIndex}
              </th>
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                {labels.colItem}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                {labels.colQty}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                {labels.colUnitPrice}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                {labels.colAmount}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="border-b border-slate-200 px-2 py-8 text-center italic text-slate-500">
                  <span {...editable("items")}>{labels.emptyItems}</span>
                </td>
              </tr>
            ) : (
              view.items.map((item, index) => (
                <tr key={index} className="break-inside-avoid border-b border-slate-200 align-top">
                  <td className="px-2 py-2.5 print:py-2 tabular-nums text-slate-500">{index + 1}</td>
                  <td className="px-2 py-2.5 print:py-2">
                    {/* overflow-wrap:anywhere also lowers the cell's min-content width, so a long
                        part number wraps instead of pushing the table past the margin. */}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span
                        {...editable(
                          `items.${index}.productName`,
                          "min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]"
                        )}
                      >
                        {item.productName || (
                          <span className="font-normal italic text-slate-500">{labels.itemPlaceholder}</span>
                        )}
                      </span>
                      {item.isTaxable ? null : (
                        <span
                          {...editable(
                            `items.${index}.isTaxable`,
                            "whitespace-nowrap rounded-full border border-slate-300 px-1.5 text-[9.5px] font-medium leading-[15px] text-slate-600"
                          )}
                        >
                          {labels.taxExempt}
                        </span>
                      )}
                    </div>
                    {item.description ? (
                      <p
                        {...editable(
                          `items.${index}.description`,
                          "mt-0.5 whitespace-pre-wrap text-[11.5px] leading-[1.5] text-slate-600 [overflow-wrap:anywhere]"
                        )}
                      >
                        {item.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 print:py-2 text-right tabular-nums text-slate-900">
                    <span {...editable(`items.${index}.quantity`)}>{formatQuantity(item.quantity, money.currencyLocale)}</span>
                    {item.unit ? (
                      <span {...editable(`items.${index}.unit`, "ml-1 text-[11px] text-slate-500")}>{item.unit}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 print:py-2 text-right tabular-nums text-slate-900">
                    <span {...editable(`items.${index}.unitPrice`)}>{formatAmount(item.unitPrice, money)}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 print:py-2 text-right font-semibold tabular-nums text-slate-900">
                    <span {...editable(`items.${index}.amount`)}>{formatAmount(item.amount, money)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Payment details beside the totals */}
        <div className="mt-4 grid break-inside-avoid grid-cols-[1fr_82mm] items-start gap-8">
          <div className="min-w-0">
            {paymentRows.length ? (
              <section className="rounded-md border border-slate-200 px-4 py-3">
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: accent.text }}>
                  {labels.paymentDetails}
                </h3>
                <dl className="mt-2 space-y-1 text-[12px]">
                  {paymentRows.map((row) => (
                    <div key={row.label} className="flex gap-3">
                      <dt className="w-[25mm] shrink-0 text-slate-500">{row.label}</dt>
                      <dd className="min-w-0 break-words font-semibold tabular-nums text-slate-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
          {/* Editable rows are buttons, which a <dl> may not contain: the preview drops the list semantics. */}
          <TotalsList list={!interactive} className="text-[12px]">
            <TotalRow label={labels.subtotal} value={formatAmount(totals.subtotal, money)} {...editable("totals.subtotal")} />
            {totals.discount > 0 ? (
              <TotalRow
                label={
                  view.discount.type === "percent"
                    ? fillLabel(labels.discountPercent, { percent: formatRate(view.discount.value, locale) })
                    : labels.discount
                }
                value={`−${formatAmount(totals.discount, money)}`}
                {...editable("totals.discount")}
              />
            ) : null}
            <TotalRow
              label={fillLabel(labels.tax, { rate: formatRate(view.taxRate, locale) })}
              value={formatAmount(totals.tax, money)}
              {...editable("totals.tax")}
            />
            {totals.otherFees > 0 ? (
              <TotalRow
                label={labels.otherFees}
                value={formatAmount(totals.otherFees, money)}
                {...editable("totals.otherFees")}
              />
            ) : null}
            <div
              className="mt-2 flex items-baseline justify-between gap-4 rounded-md px-3 py-2.5"
              style={{ background: accent.soft, boxShadow: `inset 0 1.5px 0 ${accent.color}` }}
            >
              <Term list={!interactive} className="text-[13px] font-semibold text-slate-900">
                {labels.total}
              </Term>
              <Desc
                list={!interactive}
                className="whitespace-nowrap text-[19px] font-bold tabular-nums leading-tight"
                style={{ color: accent.text }}
              >
                {formatTotal(totals.total, money)}
              </Desc>
            </div>
            {branding.showAmountInWords ? (
              <div className="mt-1.5 flex justify-between gap-3 px-3 text-[11px] text-slate-600">
                <Term list={!interactive} className="shrink-0 text-slate-500">
                  {labels.amountInWords}
                </Term>
                <Desc list={!interactive} className="text-right font-medium text-slate-700">
                  {amountInWords(totals.total, money, locale)}
                </Desc>
              </div>
            ) : null}
          </TotalsList>
        </div>

        {/* Notes and terms beside the signatures, at the foot of the page */}
        <section className="mt-auto grid grid-cols-2 items-end gap-8 pt-10 print:pt-5">
          <div className="min-w-0 space-y-4">
            {notes ? (
              <TextBlock title={labels.notes} accent={accent.text}>
                <p {...editable("notes", "whitespace-pre-wrap break-words")}>{notes}</p>
              </TextBlock>
            ) : null}
            {terms ? (
              <TextBlock title={labels.terms} accent={accent.text}>
                <p {...editable("terms", "whitespace-pre-wrap break-words")}>{terms}</p>
              </TextBlock>
            ) : null}
          </div>
          <div className="grid break-inside-avoid grid-cols-2 gap-5">
            <SignatureBox title={labels.customerSignature} hint={labels.signatureDate} />
            <SignatureBox title={labels.companySignature} hint={companyName}>
              {branding.stampSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.stampSrc}
                  alt=""
                  className="pointer-events-none absolute bottom-1 right-1 size-[19mm] object-contain opacity-95 mix-blend-multiply"
                />
              ) : null}
            </SignatureBox>
          </div>
        </section>

        {footer ? (
          <p className="mt-6 whitespace-pre-line text-center text-[10.5px] text-slate-500">
            {footer}
          </p>
        ) : null}
      </div>
    </article>
  );
}

type ListPartProps = { list: boolean; className?: string; style?: CSSProperties; children: ReactNode };

function TotalsList({ list, className, children }: Omit<ListPartProps, "style">) {
  return list ? <dl className={className}>{children}</dl> : <div className={className}>{children}</div>;
}

function Term({ list, ...props }: ListPartProps) {
  return list ? <dt {...props} /> : <span {...props} />;
}

function Desc({ list, ...props }: ListPartProps) {
  return list ? <dd {...props} /> : <span {...props} />;
}

function TotalRow({
  label,
  value,
  className,
  ...rest
}: {
  label: string;
  value: string;
} & HTMLAttributes<HTMLDivElement> & { "data-edit-field"?: string }) {
  // An editable row is a button (role set by editable()), so it holds spans, not dt/dd.
  const list = rest.role !== "button";
  return (
    <div {...rest} className={cn("flex items-baseline justify-between gap-4 px-3 py-[5px]", className)}>
      <Term list={list} className="text-slate-600">
        {label}
      </Term>
      <Desc list={list} className="whitespace-nowrap font-medium tabular-nums text-slate-900">
        {value}
      </Desc>
    </div>
  );
}

function TextBlock({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div className="min-w-0 break-inside-avoid">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: accent }}>
        {title}
      </h3>
      <div className="mt-1.5 text-[11.5px] leading-[1.6] text-slate-700">{children}</div>
    </div>
  );
}

function SignatureBox({ title, hint, children }: { title: string; hint: string; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-700">{title}</p>
      <div className="relative h-[21mm] border-b border-slate-400 print:h-[17mm]">{children}</div>
      <p className="mt-1.5 truncate text-[10.5px] text-slate-500">{hint}</p>
    </div>
  );
}
