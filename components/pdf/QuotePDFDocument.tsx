/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  // ❌ 移除 Font，不要在這裡引入
} from "@react-pdf/renderer";

// ❌ 移除所有 Font.register 的程式碼
// ❌ 移除 process.env.NEXT_PUBLIC_APP_URL 相關的變數

const colors = {
  slate900: "#0f172a",
  slate600: "#475569",
  slate500: "#64748b",
  slate100: "#f1f5f9",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Noto Sans TC", // ✅ 這裡保留名字就好，API Route 已經幫你載入檔案了
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingBottom: 10,
    alignItems: "flex-start",
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logoPlaceholder: {
    width: 30,
    height: 30,
    backgroundColor: colors.slate900,
    marginRight: 10,
    borderRadius: 2,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.slate900,
  },
  brandSub: {
    fontSize: 8,
    color: colors.slate500,
  },
  contactInfo: {
    marginTop: 4,
    fontSize: 8,
    color: colors.slate500,
    lineHeight: 1.2,
  },
  titleSection: {
    alignItems: "flex-end",
    maxWidth: "40%",
  },
  docTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.slate900,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  docNumber: {
    fontSize: 10,
    color: colors.slate500,
    marginTop: 0,
  },
  statusBadge: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: colors.slate100,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 8,
    color: colors.slate600,
    textTransform: "uppercase",
  },
  infoSection: {
    backgroundColor: "#F8FAFC",
    padding: 10,
    flexDirection: "row",
    marginBottom: 15,
    borderRadius: 4,
  },
  billToCol: { width: "55%" },
  detailsCol: { width: "45%", flexDirection: "row", flexWrap: "wrap" },
  sectionTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: colors.slate500,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clientName: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 2,
  },
  detailItem: { width: "50%", marginBottom: 6 },
  detailValue: { fontSize: 9, fontWeight: "bold", color: colors.slate900 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate900,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 8, fontWeight: "bold", color: colors.slate900 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingVertical: 6,
  },
  colDesc: { width: "50%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colAmount: { width: "20%", textAlign: "right" },
  itemTitle: { fontSize: 9, color: colors.slate900 },
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    marginBottom: 10,
  },
  totalsBox: { width: "40%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  separator: { height: 1, backgroundColor: colors.slate900, marginVertical: 4 },
  finalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  finalTotalLabel: { fontSize: 10, fontWeight: "bold", color: colors.slate900 },
  finalTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.slate900,
  },
  footerSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    flexDirection: "row",
  },
  footerLeft: { width: "60%", paddingRight: 20 },
  footerRight: {
    width: "40%",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  notesTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 2,
  },
  bankInfo: { marginTop: 6 },
  signatureLine: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate900,
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.slate900,
    textAlign: "center",
    width: 150,
  },
  copyright: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 7,
    color: "#cbd5e1",
  },
});

const fmtMoney = (cents: number) => {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const fmtDate = (d: Date | string) => {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const QuotePDFDocument = ({ quote }: { quote: any }) => {
  const subtotalCents = quote.items.reduce(
    (acc: number, item: any) => acc + item.quantity * item.unitPrice,
    0
  );
  const taxAmountCents = quote.totalAmount - subtotalCents;
  const taxRateDisplay = (Number(quote.taxRate) || 0) / 100;
  const isExpired = new Date(quote.validUntil) < new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandSection}>
            <View style={styles.logoPlaceholder} />
            <View>
              <Text style={styles.brandName}>Shangda Inc.</Text>
              <Text style={styles.brandSub}>聖大國際有限公司</Text>
              <View style={styles.contactInfo}>
                <Text>Taipei City, Taiwan</Text>
                <Text>VAT: 50990180</Text>
                <Text>+886 2 2345 6789</Text>
              </View>
            </View>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.docNumber}>#{quote.quotationNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {isExpired ? "EXPIRED" : "VALID"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.billToCol}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.clientName}>{quote.customer?.companyName}</Text>
            <Text>Attn: {quote.customer?.contactPerson}</Text>
            <Text>{quote.customer?.address}</Text>
            <Text>{quote.customer?.email}</Text>
            {quote.customer?.vatNumber ? (
              <Text>VAT: {quote.customer.vatNumber}</Text>
            ) : null}
          </View>
          <View style={styles.detailsCol}>
            <View style={styles.detailItem}>
              <Text style={styles.sectionTitle}>Issued Date</Text>
              <Text style={styles.detailValue}>
                {fmtDate(quote.issuedDate)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.sectionTitle}>Valid Until</Text>
              <Text style={[styles.detailValue, { color: "#dc2626" }]}>
                {fmtDate(quote.validUntil)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.sectionTitle}>Salesperson</Text>
              <Text style={styles.detailValue}>{quote.salesperson || "-"}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.sectionTitle}>Currency</Text>
              <Text style={styles.detailValue}>TWD (NT$)</Text>
            </View>
          </View>
        </View>

        <View>
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
              <Text style={[styles.colDesc, styles.itemTitle]}>
                {item.productName}
              </Text>
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
              <Text>Subtotal</Text>
              <Text style={{ fontWeight: "bold", color: colors.slate900 }}>
                {fmtMoney(subtotalCents)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Tax ({taxRateDisplay}%)</Text>
              <Text style={{ fontWeight: "bold", color: colors.slate900 }}>
                {fmtMoney(taxAmountCents)}
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalLabel}>Total Amount</Text>
              <Text style={styles.finalTotalValue}>
                {fmtMoney(quote.totalAmount)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerSection}>
          <View style={styles.footerLeft}>
            {quote.notes ? (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text>{quote.notes}</Text>
              </View>
            ) : null}

            <View style={styles.bankInfo}>
              <Text style={styles.notesTitle}>Payment Details</Text>
              <Text>Bank: CTBC Bank (822)</Text>
              <Text>Account: Shangda Inc.</Text>
              <Text>No: 1234-5678-9012</Text>
            </View>
          </View>
          <View style={styles.footerRight}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorized Signature</Text>
          </View>
        </View>

        <Text style={styles.copyright}>
          Thank you for your business! If you have any questions, please contact
          us.
        </Text>
      </Page>
    </Document>
  );
};
