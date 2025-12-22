/* eslint-disable jsx-a11y/alt-text */
// components/pdf/QuotePDFServer.tsx

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ❌ 注意：這裡不要再 import path, fs, process 了
// ❌ 也不要在這裡 Font.register，我們移到外面去控管

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Noto Sans TC",
    lineHeight: 1.4,
  },

  // ... (原本的 header, table, footer 樣式全部保留，完全不用動) ...
  // 為了節省版面，請保留你原本貼上的那些 styles，這裡我就不重複貼了，
  // 重點是上面的 import 和 Font.register 要拿掉。

  // 下面為了完整性我還是貼出關鍵的幾個 style，確保你複製不會錯
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  companyInfo: { width: "60%" },
  companyName: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  titleContainer: { width: "40%", alignItems: "flex-end" },
  docTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 5,
  },
  clientSection: { marginBottom: 10 },
  clientLabel: { fontWeight: "bold", marginBottom: 2 },
  table: {
    width: "100%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    minHeight: 24,
  },
  tableCol: {
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 4,
    height: "100%",
    justifyContent: "center",
  },
  infoHeader: {
    backgroundColor: "#eee",
    textAlign: "center",
    fontWeight: "bold",
  },
  infoContent: { textAlign: "center" },
  itemsHeader: {
    backgroundColor: "#eee",
    fontWeight: "bold",
    textAlign: "center",
  },
  colQty: { width: "10%", textAlign: "center" },
  colDesc: { width: "45%", textAlign: "left" },
  colPrice: { width: "15%", textAlign: "right" },
  colTax: { width: "10%", textAlign: "center" },
  colAmount: { width: "20%", textAlign: "right" },
  footerContainer: { flexDirection: "row", marginTop: 5 },
  footerLeft: { width: "60%", paddingRight: 20, paddingTop: 10 },
  footerRight: { width: "40%" },
  bankRow: { flexDirection: "row", marginBottom: 2 },
  totalRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 4,
  },
  totalLabel: { flex: 1, textAlign: "right", paddingRight: 10 },
  totalValue: { width: 100, textAlign: "right", fontWeight: "bold" },
  finalTotal: {
    borderTopWidth: 2,
    borderColor: "#000",
    borderBottomWidth: 2,
    marginTop: 5,
  },
});

// Helper
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("zh-TW") : "";
const fmtMoney = (n: number) => Math.round(n / 100).toLocaleString();

export const QuotePDFServer = ({ quote }: { quote: any }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ... 這裡面的內容保持不變，維持你上次改好的 JSX ... */}

        <View style={styles.headerContainer}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>聖大國際有限公司</Text>
            <Text>公司地址：新北市土城區亞洲路11巷1弄17號</Text>
            <Text>郵遞區號：236</Text>
            <Text>電話：0931330086</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.docTitle}>報價單</Text>
            <Text>日期：{fmtDate(quote.issuedDate)}</Text>
            <Text style={{ fontSize: 9, marginTop: 5 }}>
              有效期限：{fmtDate(quote.validUntil)}
            </Text>
          </View>
        </View>

        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>特為下列客戶報價</Text>
          <Text>姓名：{quote.customer?.contactPerson}</Text>
          <Text>公司名稱：{quote.customer?.companyName}</Text>
          <Text>統一編號：{quote.customer?.vatNumber}</Text>
          <Text>公司地址：{quote.customer?.address}</Text>
          <Text>公司電話：{quote.customer?.phone}</Text>
          <Text style={{ marginTop: 2 }}>特別注意事項：無</Text>
        </View>

        <View style={[styles.table, { marginBottom: 0, borderBottomWidth: 0 }]}>
          <View style={styles.tableRow}>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoHeader]}
            >
              <Text>售貨員</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoHeader]}
            >
              <Text>發貨日期</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoHeader]}
            >
              <Text>發貨方式</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoHeader]}
            >
              <Text>付款方式</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoContent]}
            >
              <Text>{quote.salesperson}</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoContent]}
            >
              <Text>{fmtDate(quote.issuedDate)}</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoContent]}
            >
              <Text>其他貨運公司</Text>
            </View>
            <View
              style={[styles.tableCol, { width: "25%" }, styles.infoContent]}
            >
              <Text>匯款</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.tableCol, styles.colQty, styles.itemsHeader]}>
              <Text>數量</Text>
            </View>
            <View style={[styles.tableCol, styles.colDesc, styles.itemsHeader]}>
              <Text>說明</Text>
            </View>
            <View
              style={[styles.tableCol, styles.colPrice, styles.itemsHeader]}
            >
              <Text>單價</Text>
            </View>
            <View style={[styles.tableCol, styles.colTax, styles.itemsHeader]}>
              <Text>應稅</Text>
            </View>
            <View
              style={[styles.tableCol, styles.colAmount, styles.itemsHeader]}
            >
              <Text>金額</Text>
            </View>
          </View>
          {quote.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.tableCol, styles.colQty]}>
                <Text>{item.quantity}</Text>
              </View>
              <View style={[styles.tableCol, styles.colDesc]}>
                <Text>{item.productName}</Text>
              </View>
              <View style={[styles.tableCol, styles.colPrice]}>
                <Text>{fmtMoney(item.unitPrice)}</Text>
              </View>
              <View style={[styles.tableCol, styles.colTax]}>
                <Text>T</Text>
              </View>
              <View style={[styles.tableCol, styles.colAmount]}>
                <Text>{fmtMoney(item.quantity * item.unitPrice)}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.tableRow, { height: 100 }]}>
            <View style={[styles.tableCol, styles.colQty]}>
              <Text> </Text>
            </View>
            <View style={[styles.tableCol, styles.colDesc]}>
              <Text> </Text>
            </View>
            <View style={[styles.tableCol, styles.colPrice]}>
              <Text> </Text>
            </View>
            <View style={[styles.tableCol, styles.colTax]}>
              <Text> </Text>
            </View>
            <View style={[styles.tableCol, styles.colAmount]}>
              <Text> </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerContainer}>
          <View style={styles.footerLeft}>
            <View style={styles.bankRow}>
              <Text style={{ width: 60 }}>銀行</Text>
              <Text>中國信託銀行 土城分行</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={{ width: 60 }}>戶名</Text>
              <Text>聖大國際有限公司</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={{ width: 60 }}>帳號</Text>
              <Text>369 54040269 2</Text>
            </View>
            <Text style={{ marginTop: 15 }}>聯絡人：陳聖尹 , 0931330086</Text>
            <Text>Email: teching_chen2000@yahoo.com.tw</Text>
          </View>
          <View style={styles.footerRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>小計</Text>
              <Text style={styles.totalValue}>${fmtMoney(quote.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>稅率</Text>
              <Text style={styles.totalValue}>5.00%</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>稅額</Text>
              <Text style={styles.totalValue}>{fmtMoney(quote.taxAmount)}</Text>
            </View>
            <View style={[styles.totalRow, styles.finalTotal]}>
              <Text style={styles.totalLabel}>總計</Text>
              <Text style={styles.totalValue}>
                ${fmtMoney(quote.totalAmount)}
              </Text>
            </View>
          </View>
        </View>
        <Text
          style={{
            textAlign: "center",
            marginTop: 30,
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          祝事業興旺！
        </Text>
      </Page>
    </Document>
  );
};
