/* eslint-disable jsx-a11y/alt-text -- react-pdf's <Image> has no alt */
// The quote as a PDF (react-pdf). Same information architecture as the HTML
// document (components/quote-document): both render a QuoteView with the
// same labels and formatters, so the page, the preview and the PDF agree.
// Call registerPdfFonts() before rendering.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ComponentProps } from "react";
import { documentAccent, DOCUMENT_INK } from "@/components/quote-document/accent";
import {
  amountInWords,
  formatAmount,
  formatDocumentDate,
  formatQuantity,
  formatRate,
  formatTotal,
  present,
  type DocumentMoney,
} from "@/components/quote-document/format";
import { fillLabel, type QuoteDocumentLabels } from "@/components/quote-document/label-keys";
import { pickCompanyName } from "@/lib/company-name";
import { PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import type { QuoteView } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";
import { pdfWrapSyllables } from "./line-wrap";
import { estimateLineCount } from "./text-metrics";

export type QuotePDFDocumentProps = {
  view: QuoteView;
  /** getDocumentBranding("pdf"): images are data URIs */
  branding: DocumentBranding;
  labels: QuoteDocumentLabels;
  /** document language (dates, amount in words) */
  lang: string;
};

const SLATE = {
  900: DOCUMENT_INK,
  700: "#334155",
  600: "#475569",
  500: "#64748B",
  400: "#94A3B8",
  300: "#CBD5E1",
  200: "#E2E8F0",
};

const PAGE_BOTTOM = 50;
const PAGE_PADDING_X = 42;
// The footer text (Settings) is reserved on every page but only printed on the last.
const FOOTER_FONT_SIZE = 7.5;
const FOOTER_LINE = 11;
// A4 is 595.28pt wide.
const FOOTER_WIDTH_EM = (595.28 - 2 * PAGE_PADDING_X) / FOOTER_FONT_SIZE;

// Longer descriptions may split across pages instead of pushing the whole
// row over (a row taller than a page must be allowed to break).
const KEEP_ROW_TOGETHER_MAX_CHARS = 600;

// On every <Text> that holds user content: long codes and URLs wrap instead of overprinting.
const WRAP = { hyphenationCallback: pdfWrapSyllables };

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: SLATE[900],
    paddingTop: 34,
    paddingHorizontal: PAGE_PADDING_X,
  },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  // Line height lives here, not on the Page: on the Page it stops the
  // absolutely positioned fixed footer from rendering at all.
  body: { fontSize: 9, lineHeight: 1.45 },

  header: { flexDirection: "row", justifyContent: "space-between" },
  brand: { flexDirection: "row", flexShrink: 1, paddingRight: 16 },
  logo: { height: 42, maxWidth: 110, objectFit: "contain", marginRight: 12 },
  companyName: { fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 },
  companyAlt: { fontSize: 8.5, color: SLATE[600], marginTop: 1 },
  companyLines: { marginTop: 4, fontSize: 7.5, color: SLATE[600], lineHeight: 1.5 },
  lineParts: { flexDirection: "row", flexWrap: "wrap" },
  linePart: { marginRight: 9 },
  titleBlock: { alignItems: "flex-end", flexShrink: 0 },
  title: { fontSize: 21, fontWeight: 700, lineHeight: 1.1 },
  titleAlt: { marginTop: 3, fontSize: 7, fontWeight: 700, letterSpacing: 2.4, color: SLATE[500] },
  numberRow: { flexDirection: "row", marginTop: 8, fontSize: 8.5 },
  numberLabel: { color: SLATE[500], marginRight: 6 },
  numberValue: { fontWeight: 700 },

  rule: { height: 0.75, backgroundColor: SLATE[200], marginTop: 14 },

  parties: { flexDirection: "row", marginTop: 14 },
  billTo: { flex: 1, paddingRight: 22 },
  sectionLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase" },
  customerName: { marginTop: 4, fontSize: 11.5, fontWeight: 700, lineHeight: 1.35 },
  customerLine: { marginTop: 1.5, fontSize: 8.5, color: SLATE[700] },
  muted: { color: SLATE[500] },
  meta: {
    flex: 1.1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 0.75,
    borderColor: SLATE[200],
    borderRadius: 4,
    paddingTop: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  metaCell: { width: "50%", paddingBottom: 6, paddingRight: 6 },
  metaLabel: { fontSize: 7, color: SLATE[500], lineHeight: 1.4 },
  metaValue: { fontSize: 8.5, fontWeight: 700, lineHeight: 1.4 },

  subject: { flexDirection: "row", marginTop: 16, fontSize: 10 },
  subjectLabel: { color: SLATE[500], marginRight: 8 },
  subjectValue: { fontWeight: 700, flexShrink: 1 },

  table: { marginTop: 10 },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1.25,
    fontSize: 7.5,
    fontWeight: 700,
    color: SLATE[700],
    letterSpacing: 0.4,
  },
  th: { paddingVertical: 5, paddingHorizontal: 5 },
  row: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: SLATE[200] },
  td: { paddingVertical: 4, paddingHorizontal: 5 },
  colIndex: { width: 26 },
  colItem: { flex: 1 },
  colQty: { width: 64, textAlign: "right" },
  colPrice: { width: 78, textAlign: "right" },
  colAmount: { width: 84, textAlign: "right" },
  itemName: { fontWeight: 700 },
  itemHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  taxExempt: {
    marginLeft: 5,
    fontSize: 6.5,
    lineHeight: 1.25,
    color: SLATE[600],
    borderWidth: 0.6,
    borderColor: SLATE[300],
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingTop: 1,
    paddingBottom: 0.5,
  },
  description: { marginTop: 1.5, fontSize: 8, color: SLATE[600], lineHeight: 1.5 },
  unit: { fontSize: 7.5, color: SLATE[500] },
  emptyItems: { paddingVertical: 18, textAlign: "center", color: SLATE[500], width: "100%" },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-start", marginTop: 12 },
  totalsAside: { flex: 1, paddingRight: 28 },
  totals: { width: 236 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 8 },
  totalLabel: { color: SLATE[600] },
  totalValue: { fontWeight: 700 },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderTopWidth: 1.25,
    borderRadius: 3,
  },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontSize: 14, fontWeight: 700 },
  words: { flexDirection: "row", marginTop: 4, paddingHorizontal: 8, fontSize: 7.5, lineHeight: 1.45 },
  wordsLabel: { color: SLATE[500], flexShrink: 0, marginRight: 10 },
  wordsValue: { flex: 1, color: SLATE[700], textAlign: "right" },

  closing: { flexDirection: "row", marginTop: 14 },
  closingText: { flex: 1 },
  closingGap: { width: 24 },
  blockSpaced: { marginTop: 10 },
  blockBody: { marginTop: 4, fontSize: 8, color: SLATE[700], lineHeight: 1.6 },

  payment: {
    borderWidth: 0.75,
    borderColor: SLATE[200],
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  paymentGrid: { marginTop: 4 },
  paymentRow: { flexDirection: "row", paddingVertical: 1.5, fontSize: 8.5 },
  paymentLabel: { width: 70, flexShrink: 0, color: SLATE[500] },
  paymentValue: { fontWeight: 700, flexShrink: 1 },

  signatures: { flex: 1, flexDirection: "row", alignSelf: "flex-end" },
  signature: { flex: 1 },
  signatureGap: { width: 16 },
  signatureTitle: { fontSize: 8, fontWeight: 700, color: SLATE[700] },
  signatureBox: { height: 54, borderBottomWidth: 0.75, borderBottomColor: SLATE[400], position: "relative" },
  signatureHint: { marginTop: 4, fontSize: 7.5, color: SLATE[500] },
  stamp: { position: "absolute", right: 4, bottom: 3, width: 48, height: 48, objectFit: "contain" },

  // Sits just above the page footer on the last page.
  footerText: {
    position: "absolute",
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    bottom: 40,
    textAlign: "center",
    fontSize: FOOTER_FONT_SIZE,
    color: SLATE[500],
  },
  pageFooter: {
    position: "absolute",
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: SLATE[500],
  },
});

export function QuotePDFDocument({ view, branding, labels, lang }: QuotePDFDocumentProps) {
  const accent = documentAccent(branding.brandColor);
  const money: DocumentMoney = {
    currency: branding.currency,
    currencyLocale: branding.currencyLocale,
    fractionDigits: branding.fractionDigits,
  };
  const { company, payment } = branding;
  const { customer, totals } = view;
  const date = (iso: string | null) => formatDocumentDate(iso, lang);

  const companyName = pickCompanyName(company.name, company.nameLocal, lang);
  const companyAltName = [company.name, company.nameLocal]
    .map((name) => name.trim())
    .find((name) => name && name !== companyName);
  const companyLines: string[][] = [
    [present(company.address)],
    [present(company.phone) && `${labels.phone} ${company.phone.trim()}`, present(company.email)],
    [present(company.vatNumber) && `${labels.vatNumber} ${company.vatNumber.trim()}`, present(company.website)],
  ]
    .map((parts) => parts.filter((part): part is string => Boolean(part)))
    .filter((parts) => parts.length > 0);

  const meta = [
    { label: labels.issuedDate, value: date(view.issuedDate) || null },
    { label: labels.validUntil, value: date(view.validUntil) || null },
    { label: labels.salesperson, value: present(view.salesperson) },
    { label: labels.paymentTerms, value: present(view.paymentTerms) },
    { label: labels.deliveryMethod, value: present(view.deliveryMethod) },
    { label: labels.deliveryDate, value: date(view.deliveryDate) || null },
    { label: labels.currency, value: money.currency },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

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
  // Half a line of slack: the estimate is rough and the box must not reach the page number.
  const footerLines = footer ? estimateLineCount(footer, FOOTER_WIDTH_EM) + 0.5 : 0;
  const number = view.quotationNumber ?? "";
  const docTitle = fillLabel(labels.documentLabel, { number }).trim();
  const contact = [
    customer.email,
    customer.phone && `${labels.phone} ${customer.phone}`,
  ].filter(Boolean);

  return (
    <Document
      title={docTitle}
      author={companyName}
      subject={view.title ?? customer.companyName ?? docTitle}
      creator="Quote System"
      producer="Quote System"
      language={lang}
    >
      <Page size="A4" style={[s.page, { paddingBottom: PAGE_BOTTOM + footerLines * FOOTER_LINE }]} wrap>
        <View fixed style={[s.accentBar, { backgroundColor: accent.color }]} />
        {footer ? (
          <Text
            {...WRAP}
            fixed
            style={[s.footerText, { height: footerLines * FOOTER_LINE }]}
            render={({ pageNumber, totalPages }) => (pageNumber === totalPages ? footer : "")}
          />
        ) : null}
        <View fixed style={s.pageFooter}>
          <Text {...WRAP} style={{ flexShrink: 1, paddingRight: 12 }}>
            {[companyName, number].filter(Boolean).join("  ·  ")}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              fillLabel(labels.page, { current: pageNumber, total: totalPages })
            }
          />
        </View>

        <View style={s.body}>
        {/* Letterhead */}
        <View style={s.header}>
          <View style={s.brand}>
            {branding.logoSrc ? <Image src={branding.logoSrc} style={s.logo} /> : null}
            <View style={{ flexShrink: 1 }}>
              <Text {...WRAP} style={s.companyName}>{companyName}</Text>
              {companyAltName ? <Text {...WRAP} style={s.companyAlt}>{companyAltName}</Text> : null}
              {companyLines.length ? (
                <View style={s.companyLines}>
                  {companyLines.map((parts) => (
                    <View key={parts.join("|")} style={s.lineParts}>
                      {parts.map((part) => (
                        <Text {...WRAP} key={part} style={s.linePart}>
                          {part}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.titleBlock}>
            <Text style={[s.title, { color: accent.text }]}>{labels.title}</Text>
            {labels.titleAlt ? <Text style={s.titleAlt}>{labels.titleAlt}</Text> : null}
            <View style={s.numberRow}>
              <Text style={s.numberLabel}>{labels.number}</Text>
              <Text {...WRAP} style={s.numberValue}>{number || labels.numberPending}</Text>
            </View>
          </View>
        </View>

        <View style={s.rule} />

        {/* Parties and terms */}
        <View style={s.parties} wrap={false}>
          <View style={s.billTo}>
            <Text style={[s.sectionLabel, { color: accent.text }]}>{labels.billTo}</Text>
            <Text {...WRAP} style={s.customerName}>{customer.companyName ?? labels.customerPlaceholder}</Text>
            {customer.contactPerson ? (
              <Text {...WRAP} style={s.customerLine}>
                <Text style={s.muted}>{labels.attn} </Text>
                {customer.contactPerson}
              </Text>
            ) : null}
            {customer.address ? <Lines text={customer.address} style={s.customerLine} /> : null}
            {contact.length ? <Text {...WRAP} style={s.customerLine}>{contact.join("    ")}</Text> : null}
            {customer.vatNumber ? (
              <Text {...WRAP} style={s.customerLine}>
                <Text style={s.muted}>{labels.vatNumber} </Text>
                {customer.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={s.meta}>
            {meta.map((row) => (
              <View key={row.label} style={s.metaCell}>
                <Text style={s.metaLabel}>{row.label}</Text>
                <Text {...WRAP} style={s.metaValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {view.title ? (
          <View style={s.subject} wrap={false}>
            <Text style={s.subjectLabel}>{labels.subject}</Text>
            <Text {...WRAP} style={s.subjectValue}>{view.title}</Text>
          </View>
        ) : null}

        {/* Items: the header row repeats on every page the table spans */}
        <View style={[s.table, view.title ? {} : { marginTop: 18 }]}>
          <View
            fixed
            style={[s.thead, { backgroundColor: accent.soft, borderBottomColor: accent.color }]}
          >
            <Text style={[s.th, s.colIndex]}>{labels.colIndex}</Text>
            <Text style={[s.th, s.colItem]}>{labels.colItem}</Text>
            <Text style={[s.th, s.colQty]}>{labels.colQty}</Text>
            <Text style={[s.th, s.colPrice]}>{labels.colUnitPrice}</Text>
            <Text style={[s.th, s.colAmount]}>{labels.colAmount}</Text>
          </View>
          {view.items.length === 0 ? (
            <View style={s.row}>
              <Text style={s.emptyItems}>{labels.emptyItems}</Text>
            </View>
          ) : (
            view.items.map((item, index) => (
              <View
                key={index}
                style={s.row}
                wrap={(item.description?.length ?? 0) > KEEP_ROW_TOGETHER_MAX_CHARS}
              >
                <Text style={[s.td, s.colIndex, s.muted]}>{index + 1}</Text>
                <View style={[s.td, s.colItem]}>
                  <View style={s.itemHead}>
                    <Text {...WRAP} style={s.itemName}>{item.productName || labels.itemPlaceholder}</Text>
                    {item.isTaxable ? null : <Text style={s.taxExempt}>{labels.taxExempt}</Text>}
                  </View>
                  {item.description ? <Lines text={item.description} style={s.description} /> : null}
                </View>
                <Text style={[s.td, s.colQty]}>
                  {formatQuantity(item.quantity, money.currencyLocale)}
                  {item.unit ? <Text style={s.unit}> {item.unit}</Text> : null}
                </Text>
                <Text style={[s.td, s.colPrice]}>{formatAmount(item.unitPrice, money)}</Text>
                <Text style={[s.td, s.colAmount, s.itemName]}>{formatAmount(item.amount, money)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalsAside}>
            {paymentRows.length ? (
              <View style={s.payment}>
                <Text style={[s.sectionLabel, { color: accent.text }]}>{labels.paymentDetails}</Text>
                <View style={s.paymentGrid}>
                  {paymentRows.map((row) => (
                    <View key={row.label} style={s.paymentRow}>
                      <Text style={s.paymentLabel}>{row.label}</Text>
                      <Text {...WRAP} style={s.paymentValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
          <View style={s.totals}>
            <TotalRow label={labels.subtotal} value={formatAmount(totals.subtotal, money)} />
            {totals.discount > 0 ? (
              <TotalRow
                label={
                  view.discount.type === "percent"
                    ? fillLabel(labels.discountPercent, { percent: formatRate(view.discount.value, lang) })
                    : labels.discount
                }
                value={`-${formatAmount(totals.discount, money)}`}
              />
            ) : null}
            <TotalRow
              label={fillLabel(labels.tax, { rate: formatRate(view.taxRate, lang) })}
              value={formatAmount(totals.tax, money)}
            />
            {totals.otherFees > 0 ? (
              <TotalRow label={labels.otherFees} value={formatAmount(totals.otherFees, money)} />
            ) : null}
            <View style={[s.grandTotal, { backgroundColor: accent.soft, borderTopColor: accent.color }]}>
              <Text style={s.grandLabel}>{labels.total}</Text>
              <Text style={[s.grandValue, { color: accent.text }]}>{formatTotal(totals.total, money)}</Text>
            </View>
            {branding.showAmountInWords ? (
              <View style={s.words}>
                <Text style={s.wordsLabel}>{labels.amountInWords}</Text>
                <Text style={s.wordsValue}>{amountInWords(totals.total, money, lang)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Notes and terms beside the signatures */}
        <View style={s.closing} wrap={(notes?.length ?? 0) + (terms?.length ?? 0) > KEEP_ROW_TOGETHER_MAX_CHARS}>
          <View style={s.closingText}>
            {notes ? <TextBlock title={labels.notes} color={accent.text} text={notes} /> : null}
            {terms ? (
              <TextBlock title={labels.terms} color={accent.text} text={terms} spaced={Boolean(notes)} />
            ) : null}
          </View>
          <View style={s.closingGap} />
          <View style={s.signatures} wrap={false}>
            <View style={s.signature}>
              <Text style={s.signatureTitle}>{labels.customerSignature}</Text>
              <View style={s.signatureBox} />
              <Text style={s.signatureHint}>{labels.signatureDate}</Text>
            </View>
            <View style={s.signatureGap} />
            <View style={s.signature}>
              <Text style={s.signatureTitle}>{labels.companySignature}</Text>
              <View style={s.signatureBox}>
                {branding.stampSrc ? <Image src={branding.stampSrc} style={s.stamp} /> : null}
              </View>
              <Text {...WRAP} style={s.signatureHint}>{companyName}</Text>
            </View>
          </View>
        </View>
        </View>
      </Page>
    </Document>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalRow}>
      <Text style={s.totalLabel}>{label}</Text>
      <Text style={s.totalValue}>{value}</Text>
    </View>
  );
}

function TextBlock({
  title,
  color,
  text,
  spaced = false,
}: {
  title: string;
  color: string;
  text: string;
  spaced?: boolean;
}) {
  return (
    <View style={spaced ? s.blockSpaced : undefined}>
      <Text style={[s.sectionLabel, { color }]} minPresenceAhead={24}>
        {title}
      </Text>
      <Lines text={text} style={s.blockBody} />
    </View>
  );
}

/**
 * One <Text> per line: react-pdf turns each "\n" inside a Text into an empty
 * run in its built-in Helvetica, which then shows up as an extra
 * (unembedded) font in the file.
 */
function Lines({ text, style }: { text: string; style: ComponentProps<typeof View>["style"] }) {
  return (
    <View style={style}>
      {text.split(/\r?\n/).map((line, index) => (
        <Text {...WRAP} key={index}>{line === "" ? " " : line}</Text>
      ))}
    </View>
  );
}
