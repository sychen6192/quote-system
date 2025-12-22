import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface QuoteTemplateProps {
  quoteNumber: string;
  customerName: string;
  // items 拿掉了，因為明細都在 PDF 裡
  totalAmount: number; // 我們保留總金額讓客戶一眼看到
}

export const QuoteEmailTemplate = ({
  quoteNumber,
  customerName,
  totalAmount,
}: QuoteTemplateProps) => (
  <Html>
    <Head />
    <Preview>Your quotation #{quoteNumber} is attached.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Quotation #{quoteNumber}</Heading>

        <Text style={text}>Hi {customerName},</Text>

        <Text style={text}>
          Please find the attached quotation (PDF) for your review.
        </Text>

        <Text style={text}>
          If you have any questions or need to make any adjustments, please feel
          free to reply to this email.
        </Text>

        <Hr style={hr} />

        {/* 只顯示總金額作為摘要，並確保是整數 */}
        <Section>
          <Text style={total}>
            Total Amount: ${Math.round(totalAmount / 100).toLocaleString()}
          </Text>
        </Section>

        <Text style={footer}>
          Shangda Int'l Co., Inc.
          <br />
          Taipei, Taiwan
        </Text>
      </Container>
    </Body>
  </Html>
);

// Styles
const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  width: "580px",
};

const h1 = {
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const total = {
  fontSize: "20px",
  fontWeight: "bold",
  textAlign: "right" as const,
  marginTop: "10px",
  color: "#333",
};

const footer = {
  color: "#898989",
  fontSize: "12px",
  lineHeight: "22px",
  marginTop: "20px",
  textAlign: "center" as const,
};
