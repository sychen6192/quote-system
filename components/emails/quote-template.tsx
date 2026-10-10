// The quote email. Nothing remote: email clients block or proxy external
// images and cannot resolve relative URLs, so the brand is a coloured
// wordmark rather than the logo. Inline styles only (no <style> support in
// several clients); colours are fixed and reach 4.5:1 on white.
import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { Fragment, type CSSProperties } from "react";
import { documentAccent, DOCUMENT_INK } from "@/components/quote-document/accent";
import { fillLabel } from "@/components/quote-document/label-keys";
import type { AppLocale } from "@/i18n/locales";
import type { QuoteEmailLabels } from "./labels";

export type QuoteEmailProps = {
  lang: AppLocale;
  labels: QuoteEmailLabels;
  brandColor: string;
  company: {
    /** in the email's language */
    name: string;
    altName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  quote: {
    number: string;
    title: string | null;
    /** formatted */
    validUntil: string;
    /** formatted with the currency */
    total: string;
    /** who the greeting addresses: contact person, else the company */
    recipientName: string | null;
  };
  /** the sender's personal note (plain text) */
  message?: string | null;
  payment: { label: string; value: string }[];
  footerText: string | null;
  attachmentName: string;
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const MUTED = "#475569";
const SUBTLE = "#64748B";
const RULE = "#E2E8F0";

const text: CSSProperties = { margin: "0 0 14px", fontSize: "15px", lineHeight: "24px", color: DOCUMENT_INK };
const small: CSSProperties = { margin: 0, fontSize: "13px", lineHeight: "20px", color: MUTED };
const label: CSSProperties = { margin: 0, fontSize: "13px", lineHeight: "20px", color: SUBTLE };
const value: CSSProperties = {
  margin: 0,
  fontSize: "14px",
  lineHeight: "20px",
  color: DOCUMENT_INK,
  fontWeight: 600,
  textAlign: "right",
};

export function QuoteEmail(props: QuoteEmailProps) {
  const { labels, company, quote, message, payment, footerText } = props;
  const accent = documentAccent(props.brandColor);
  const greeting = quote.recipientName
    ? fillLabel(labels.greeting, { name: quote.recipientName })
    : labels.greetingFallback;
  const intro = quote.title
    ? fillLabel(labels.introWithTitle, { number: quote.number, title: quote.title })
    : fillLabel(labels.intro, { number: quote.number });
  const contact = [company.phone, company.email, company.website].filter(Boolean).join("  ·  ");
  const summary = [
    { label: labels.number, value: quote.number },
    ...(quote.title ? [{ label: labels.title, value: quote.title }] : []),
    { label: labels.validUntil, value: quote.validUntil },
  ];

  return (
    <Html lang={props.lang}>
      <Head />
      <Preview>
        {fillLabel(labels.preview, { number: quote.number, total: quote.total, date: quote.validUntil })}
      </Preview>
      <Body style={{ margin: 0, padding: "24px 12px", backgroundColor: "#F1F5F9", fontFamily: FONT }}>
        <Container
          style={{
            maxWidth: "600px",
            width: "100%",
            margin: "0 auto",
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: `1px solid ${RULE}`,
            overflow: "hidden",
          }}
        >
          <Section style={{ height: "4px", lineHeight: "4px", fontSize: "1px", backgroundColor: accent.color }}>
            &nbsp;
          </Section>

          <Section style={{ padding: "28px 32px 8px" }}>
            <Text style={{ margin: 0, fontSize: "20px", lineHeight: "28px", fontWeight: 700, color: accent.text }}>
              {company.name}
            </Text>
            {company.altName ? <Text style={{ ...small, color: SUBTLE }}>{company.altName}</Text> : null}
          </Section>

          <Section style={{ padding: "16px 32px 0" }}>
            <Text style={text}>{greeting}</Text>
            <Text style={text}>{intro}</Text>
            {message ? (
              <Text
                style={{
                  ...text,
                  margin: "4px 0 18px",
                  padding: "12px 16px",
                  backgroundColor: "#F8FAFC",
                  borderLeft: `3px solid ${accent.color}`,
                  borderRadius: "4px",
                }}
              >
                <Lines text={message} />
              </Text>
            ) : null}
          </Section>

          <Section style={{ padding: "4px 32px 0" }}>
            <Section style={{ border: `1px solid ${RULE}`, borderRadius: "10px", padding: "16px 18px" }}>
              <Text
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  lineHeight: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: accent.text,
                }}
              >
                {labels.summary}
              </Text>
              {summary.map((row) => (
                <Row key={row.label} style={{ marginBottom: "6px" }}>
                  <Column style={{ width: "40%", verticalAlign: "top" }}>
                    <Text style={label}>{row.label}</Text>
                  </Column>
                  <Column style={{ verticalAlign: "top" }}>
                    <Text style={value}>{row.value}</Text>
                  </Column>
                </Row>
              ))}
              <Hr style={{ borderColor: RULE, margin: "10px 0" }} />
              <Row>
                <Column style={{ width: "40%", verticalAlign: "middle" }}>
                  <Text style={{ ...label, fontWeight: 600, color: DOCUMENT_INK }}>{labels.total}</Text>
                </Column>
                <Column style={{ verticalAlign: "middle" }}>
                  <Text style={{ ...value, fontSize: "22px", lineHeight: "28px", fontWeight: 700, color: accent.text }}>
                    {quote.total}
                  </Text>
                </Column>
              </Row>
            </Section>
            <Text style={{ ...small, margin: "10px 0 0", color: SUBTLE }}>
              {fillLabel(labels.attachment, { filename: props.attachmentName })}
            </Text>
          </Section>

          {payment.length ? (
            <Section style={{ padding: "18px 32px 0" }}>
              <Text style={{ ...small, fontWeight: 700, color: DOCUMENT_INK, marginBottom: "6px" }}>
                {labels.paymentDetails}
              </Text>
              {payment.map((row) => (
                <Row key={row.label}>
                  <Column style={{ width: "40%", verticalAlign: "top" }}>
                    <Text style={label}>{row.label}</Text>
                  </Column>
                  <Column style={{ verticalAlign: "top" }}>
                    <Text style={{ ...small, color: DOCUMENT_INK, fontWeight: 600 }}>{row.value}</Text>
                  </Column>
                </Row>
              ))}
            </Section>
          ) : null}

          <Section style={{ padding: "22px 32px 28px" }}>
            <Text style={text}>{labels.closing}</Text>
            <Text style={{ ...text, margin: 0 }}>{labels.signOff}</Text>
            <Text style={{ ...text, margin: "2px 0 0", fontWeight: 700 }}>{company.name}</Text>
            {contact ? <Text style={{ ...small, marginTop: "2px" }}>{contact}</Text> : null}
            {company.address ? <Text style={small}>{company.address}</Text> : null}
          </Section>

          {footerText ? (
            <Section style={{ padding: "14px 32px 18px", backgroundColor: "#F8FAFC", borderTop: `1px solid ${RULE}` }}>
              <Text style={{ ...small, fontSize: "12px", lineHeight: "18px", color: SUBTLE }}>
                <Lines text={footerText} />
              </Text>
            </Section>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

/** Line breaks as <br>: white-space is unreliable in email clients and lost in the plain-text part. */
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split(/\r?\n/).map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}
