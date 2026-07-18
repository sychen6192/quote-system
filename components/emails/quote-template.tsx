import { formatCurrency } from "@/lib/utils";
import type { QuoteBranding } from "@/lib/config";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview, // 移除 Img 引用
  Section,
  Text,
  Hr,
  Tailwind,
  Link,
} from "@react-email/components";

interface QuoteTemplateProps {
  quote: any;
  branding: QuoteBranding;
}

export const QuoteEmail = ({ quote, branding }: QuoteTemplateProps) => {
  if (!quote) return null;

  const fmtMoney = (cents: number) => formatCurrency(cents, branding.money);

  const customerName =
    quote.customer?.contactPerson ||
    quote.customer?.companyName ||
    "Valued Customer";
  const quoteNumber = quote.quotationNumber;
  const totalAmount = quote.totalAmount;

  return (
    <Html>
      <Head />
      {/* ✅ 修正 Preview：只顯示文字，不放 Base64 亂碼 */}
      <Preview>
        Quotation #{quoteNumber} from {branding.company.name}
      </Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                slate900: "#0f172a",
                slate600: "#475569",
                slate500: "#64748b",
                slate100: "#e2e8f0",
              },
            },
          },
        }}
      >
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[40px] max-w-[500px]">
            {/* Header: Title Only (No Logo) */}
            <Section className="text-center mb-8">
              <Heading className="text-2xl font-bold text-slate900 m-0">
                Quotation #{quoteNumber}
              </Heading>
              <Text className="text-sm text-slate500 mt-2">
                {branding.company.name}
              </Text>
            </Section>

            {/* Content */}
            <Section className="mb-6">
              <Text className="text-base text-slate900 leading-relaxed">
                Hi <strong>{customerName}</strong>,
              </Text>
              <Text className="text-base text-slate600 leading-relaxed">
                Please find the attached quotation (PDF) for your review.
              </Text>
              <Text className="text-base text-slate600 leading-relaxed">
                If you have any questions or need to make any adjustments,
                please feel free to reply to this email.
              </Text>
            </Section>

            <Hr className="border border-solid border-slate100 my-6 mx-0 w-full" />

            {/* Total Amount Highlight */}
            <Section className="bg-slate100 rounded-lg p-4 text-center mb-6">
              <Text className="text-xs font-bold text-slate500 uppercase m-0 mb-1">
                Total Amount
              </Text>
              <Text className="text-2xl font-bold text-slate900 m-0">
                {fmtMoney(totalAmount)}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="text-center mt-8">
              {branding.payment ? (
                <div className="mb-6 text-xs text-slate-500">
                  <Text className="font-bold m-0 uppercase mb-2">
                    Payment Details
                  </Text>
                  {branding.payment.bankName ? (
                    <Text className="m-0">
                      Bank: {branding.payment.bankName}
                    </Text>
                  ) : null}
                  {branding.payment.accountName ? (
                    <Text className="m-0">
                      Account: {branding.payment.accountName}
                    </Text>
                  ) : null}
                  {branding.payment.accountNumber ? (
                    <Text className="m-0">
                      No: {branding.payment.accountNumber}
                    </Text>
                  ) : null}
                </div>
              ) : null}

              <Text className="text-xs text-slate400 leading-relaxed m-0">
                <strong>{branding.company.name}</strong>
                {branding.company.address ? (
                  <>
                    <br />
                    {branding.company.address}
                  </>
                ) : null}
                {branding.company.email ? (
                  <>
                    <br />
                    <Link
                      href={`mailto:${branding.company.email}`}
                      className="text-slate400 underline"
                    >
                      {branding.company.email}
                    </Link>
                  </>
                ) : null}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
