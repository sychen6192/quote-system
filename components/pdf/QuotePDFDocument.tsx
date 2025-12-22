/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ✅ 修復 1: 改用 fetch 網路資源的方式載入字體
// 這樣就不用管 process.cwd() 或 path 了
// 注意：請確保你的專案在開發時是用 localhost:3000，上線後要換成真實網域
// 如果你只是本地測試，寫死 http://localhost:3000 沒問題
const fontUrl = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/fonts/NotoSansTC-Regular.ttf`
  : "http://localhost:3000/fonts/NotoSansTC-Regular.ttf";

Font.register({
  family: "Noto Sans TC",
  src: fontUrl,
});

const colors = {
  slate900: "#0f172a",
  slate600: "#475569",
  slate500: "#64748b",
  slate100: "#f1f5f9",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Noto Sans TC", // ✅ 記得把字體加回來
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.5,
  },

  // --- Header 區域 ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingBottom: 20,
    alignItems: "flex-start", // ✅ 修復 2: 確保頂部對齊，避免跑版
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "flex-start", // 確保 Logo 跟文字對齊
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
    marginTop: 8,
    fontSize: 8,
    color: colors.slate500,
    lineHeight: 1.2, // 微調行高
  },

  titleSection: {
    alignItems: "flex-end",
    // ✅ 修復 2: 增加寬度限制或調整，避免擠壓
    maxWidth: "40%",
  },
  docTitle: {
    fontSize: 24, // ✅ 修復 2: 稍微縮小字體 (原本28可能太大)
    fontWeight: "bold", // react-pdf 支援 bold, 不支援 heavy
    color: colors.slate900,
    textTransform: "uppercase",
    marginBottom: 5, // ✅ 修復 2: 增加下方間距，避免跟單號重疊
  },
  docNumber: {
    fontSize: 10,
    color: colors.slate500,
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 5,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: colors.slate100,
    borderRadius: 4, // 稍微方一點比較好看
  },
  statusText: {
    fontSize: 8,
    color: colors.slate600,
    textTransform: "uppercase",
  },

  // ... (中間的 InfoSection, Table, Totals, Footer 樣式保持不變，直接沿用) ...
  // 為了節省篇幅，這裡省略中間沒變的樣式，請保留你原本的程式碼

  // 只要確保 page 的 fontFamily 有設回 "Noto Sans TC" 即可
  infoSection: {
    backgroundColor: "#F8FAFC",
    padding: 15,
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 4,
  },
  billToCol: { width: "55%" },
  detailsCol: { width: "45%", flexDirection: "row", flexWrap: "wrap" },
  sectionTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: colors.slate500,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.slate900,
    marginBottom: 2,
  },
  detailItem: { width: "50%", marginBottom: 10 },
  detailValue: { fontSize: 9, fontWeight: "bold", color: colors.slate900 },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate900,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableHeaderCell: { fontSize: 8, fontWeight: "bold", color: colors.slate900 },
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
  itemTitle: { fontSize: 9, color: colors.slate900 },

  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    marginBottom: 30,
  },
  totalsBox: { width: "40%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  separator: { height: 1, backgroundColor: colors.slate900, marginVertical: 6 },
  finalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  finalTotalLabel: { fontSize: 10, fontWeight: "bold", color: colors.slate900 },
  finalTotalValue: { fontSize: 16, fontWeight: "bold", color: colors.slate900 },

  footerSection: {
    marginTop: "auto",
    paddingTop: 20,
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
  bankInfo: { marginTop: 10 },
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
    marginTop: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#cbd5e1",
  },
});

// ... Helper functions 保持不變 ...
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
  // ... Server 端計算邏輯保持不變 ...
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
        {/* 內容保持不變，因為字體修復了，中文就會正常顯示 */}
        {/* ... JSX 結構省略，與上次一致 ... */}

        <View style={styles.header}>
          <View style={styles.brandSection}>
            <View style={styles.logoPlaceholder} />
            <View>
              <Text style={styles.brandName}>Shangda Inc.</Text>
              <Text style={styles.brandSub}>聖大國際有限公司</Text>{" "}
              {/* 中文測試 */}
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

        {/* 下面都一樣... */}
        <View style={styles.infoSection}>
          <View style={styles.billToCol}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.clientName}>{quote.customer?.companyName}</Text>
            <Text>Attn: {quote.customer?.contactPerson}</Text>
            <Text>{quote.customer?.address}</Text>
            <Text>{quote.customer?.email}</Text>
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
      </Page>
    </Document>
  );
};
