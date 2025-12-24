/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Image,
} from "@react-pdf/renderer";
import { COMPANY_INFO, PAYMENT_INFO } from "@/lib/company-info";
import { calculateQuoteTotals } from "@/lib/calculations";

const colors = {
  slate900: "#0f172a",
  slate600: "#475569",
  slate500: "#64748b",
  slate100: "#e2e8f0",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Noto Sans TC",
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.5,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingBottom: 20,
    alignItems: "flex-start",
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "center", // Logo 與文字垂直置中
  },

  // 品牌文字區
  brandInfoColumn: {
    flexDirection: "column",
    marginLeft: 4, // 讓文字離 Icon 稍微遠一點點
  },
  brandName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 10, // ✅ 關鍵修正：增加間距 (原本是 4 -> 10)
    lineHeight: 1,
  },
  brandSub: {
    fontSize: 9,
    color: colors.slate500,
    marginBottom: 6,
  },
  contactInfo: {
    fontSize: 8,
    color: colors.slate500,
    lineHeight: 1.4,
  },

  // Title Section
  titleSection: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.slate900,
    textTransform: "uppercase",
    marginBottom: 10,
    lineHeight: 1,
  },
  docNumber: {
    fontSize: 10,
    color: colors.slate500,
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.slate100,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.slate600,
    textTransform: "uppercase",
  },

  // Info Grid
  infoSection: {
    flexDirection: "row",
    marginBottom: 30,
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 6,
  },
  colLeft: { width: "55%" },
  colRight: { width: "45%", flexDirection: "row", flexWrap: "wrap" },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    color: colors.slate500,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 10,
  },
  valueLarge: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 4,
  },
  textSmall: { fontSize: 9, color: colors.slate600, lineHeight: 1.4 },

  // Table
  tableContainer: { marginBottom: 20 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: colors.slate900,
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.slate900,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingVertical: 8,
  },
  colDesc: { width: "50%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colAmount: { width: "20%", textAlign: "right" },

  // Totals
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 40,
  },
  totalsBox: { width: "40%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 2,
    borderTopColor: colors.slate900,
  },
  totalLabel: { fontSize: 9, color: colors.slate600 },
  totalValue: { fontSize: 9, fontWeight: "bold", color: colors.slate900 },
  finalLabel: { fontSize: 12, fontWeight: "bold", color: colors.slate900 },
  finalValue: { fontSize: 16, fontWeight: "bold", color: colors.slate900 },

  // Footer
  footer: {
    marginTop: "auto",
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerCol: { width: "48%" },
  stampImage: {
    width: 80, // 依據你的圖片實際大小調整
    height: "auto",
    marginBottom: -35, // ✅ 重要：使用負邊距讓印章「壓」在橫線上，看起來更真實
    zIndex: -1, // 確保在文字下方
    opacity: 0.9, // 稍微透明一點點更有質感
  },
  signatureLine: {
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate900,
    width: "80%",
    alignSelf: "flex-end",
  },
  copyright: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
  },
});

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
  }).format(cents / 100);

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const QuotePDFDocument = ({ quote }: { quote: any }) => {
  const { subtotal, taxAmount, totalAmount } = calculateQuoteTotals(
    quote.items,
    Number(quote.taxRate)
  );
  const taxRateDisplay = (Number(quote.taxRate) || 0) / 100;
  const isExpired = new Date(quote.validUntil) < new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandSection}>
            {/* ✅ 更新：使用 SVG 繪製專業建築圖示 */}
            <Image 
              src={COMPANY_INFO.logoBase64}
              style={{ width: 40, height: 40, marginRight: 8, objectFit: 'contain' }} 
            />
              {/* 主體建築 */}
              <Path
                d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"
                fill={colors.slate900}
              />
              {/* 旁邊的小建築結構 */}
              <Path
                d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
                fill={colors.slate900}
                opacity={0.7} // 稍微淡一點增加層次
              />
              <Path
                d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"
                fill={colors.slate900}
                opacity={0.7}
              />
              {/* 窗戶線條 (白色) */}
              <Rect x="10" y="6" width="4" height="1.5" fill="white" />
              <Rect x="10" y="10" width="4" height="1.5" fill="white" />
              <Rect x="10" y="14" width="4" height="1.5" fill="white" />
              <Rect x="10" y="18" width="4" height="1.5" fill="white" />
            </Svg>

            <View style={styles.brandInfoColumn}>
              <Text style={styles.brandName}>{COMPANY_INFO.name}</Text>
              <Text style={styles.brandSub}>{COMPANY_INFO.chineseName}</Text>
              <View style={styles.contactInfo}>
                <Text>{COMPANY_INFO.address}</Text>
                <Text>VAT: {COMPANY_INFO.vatNumber}</Text>
              </View>
            </View>
          </View>
          <View style={styles.titleSection}>
            <Text style={styles.docTitle}>Quotation</Text>
            <Text style={styles.docNumber}>#{quote.quotationNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {isExpired ? "EXPIRED" : "VALID"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.colLeft}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.valueLarge}>{quote.customer?.companyName}</Text>
            <Text style={styles.textSmall}>
              Attn: {quote.customer?.contactPerson}
            </Text>
            <Text style={styles.textSmall}>{quote.customer?.address}</Text>
            <Text style={styles.textSmall}>{quote.customer?.email}</Text>
            {quote.customer?.vatNumber ? (
              <Text style={styles.textSmall}>
                VAT: {quote.customer.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.colRight}>
            <View style={{ width: "50%", marginBottom: 10 }}>
              <Text style={styles.label}>Issued Date</Text>
              <Text style={styles.value}>{fmtDate(quote.issuedDate)}</Text>
            </View>
            <View style={{ width: "50%", marginBottom: 10 }}>
              <Text style={styles.label}>Valid Until</Text>
              <Text style={[styles.value, { color: "#dc2626" }]}>
                {fmtDate(quote.validUntil)}
              </Text>
            </View>
            <View style={{ width: "50%" }}>
              <Text style={styles.label}>Salesperson</Text>
              <Text style={styles.value}>{quote.salesperson || "-"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>
              Amount
            </Text>
          </View>
          {quote.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDesc}>{item.productName}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{fmtMoney(item.unitPrice)}</Text>
              <Text style={styles.colAmount}>
                {fmtMoney(item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{fmtMoney(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({taxRateDisplay}%)</Text>
              <Text style={styles.totalValue}>{fmtMoney(taxAmount)}</Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text style={styles.finalLabel}>Total</Text>
              <Text style={styles.finalValue}>{fmtMoney(totalAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerCol}>
            {quote.notes ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.label}>Notes</Text>
                <Text style={styles.textSmall}>{quote.notes}</Text>
              </View>
            ) : null}
            <View>
              <Text style={styles.label}>Bank Details</Text>
              <Text style={styles.textSmall}>{PAYMENT_INFO.bankName}</Text>
              <Text style={styles.textSmall}>{PAYMENT_INFO.accountName}</Text>
              <Text style={styles.textSmall}>{PAYMENT_INFO.accountNumber}</Text>
            </View>
          </View>
          <View style={[styles.footerCol, { alignItems: "flex-end" }]}>
            <View style={{ width: "100%", alignItems: "center" }}>
              <Image src={COMPANY_INFO.stampBase64} style={styles.stampImage} />
              <View style={styles.signatureLine} />
              <Text style={[styles.label, { marginTop: 4 }]}>
                Authorized Signature
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.copyright}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
};
