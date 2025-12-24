import { COMPANY_INFO, PAYMENT_INFO } from "@/lib/company-info";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Tailwind,
  Link,
} from "@react-email/components";

// 金額格式化
const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);

interface QuoteTemplateProps {
  quote: any;
}

export const QuoteEmail = ({ quote }: QuoteTemplateProps) => {
  if (!quote) return null;

  const customerName =
    quote.customer?.contactPerson ||
    quote.customer?.companyName ||
    "Valued Customer";
  const quoteNumber = quote.quotationNumber;
  const totalAmount = quote.totalAmount;

  return (
    <Html>
      <Head />
      <Preview>
        Quotation #{quoteNumber} from {COMPANY_INFO.logoBase64}
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
            {/* Header: Logo & Title */}
            <Section className="text-center mb-8">
              <Img
                src={COMPANY_INFO.logoBase64}
                width="48"
                height="48"
                alt="Logo"
                className="mx-auto mb-4"
              />
              <Heading className="text-2xl font-bold text-slate900 m-0">
                Quotation #{quoteNumber}
              </Heading>
              <Text className="text-sm text-slate500 mt-2">
                {COMPANY_INFO.name}
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
              <div className="mb-6 text-xs text-slate-500">
                <Text className="font-bold m-0 uppercase mb-2">
                  Payment Details
                </Text>
                <Text className="m-0">Bank: {PAYMENT_INFO.bankName}</Text>
                <Text className="m-0">Account: {PAYMENT_INFO.accountName}</Text>
                <Text className="m-0">No: {PAYMENT_INFO.accountNumber}</Text>
              </div>

              <Text className="text-xs text-slate400 leading-relaxed m-0">
                <strong>{COMPANY_INFO.name}</strong>
                <br />
                {COMPANY_INFO.address}
                <br />
                <Link
                  href={COMPANY_INFO.email}
                  className="text-slate400 underline"
                >
                  {COMPANY_INFO.email}
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
