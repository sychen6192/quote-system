export type VatCompany = {
  companyName: string;
  address: string;
  responsibleName: string;
  status: string;
};

// 經濟部商業司 — 公司登記基本資料(公開資料,免金鑰)
const DATASET = "5F64D864-61CB-4D0D-8AD9-492047CC1EA6";

export function gcisUrl(vat: string): string {
  const filter = encodeURIComponent(`Business_Accounting_NO eq ${vat}`);
  return `https://data.gcis.nat.gov.tw/od/data/api/${DATASET}?$format=json&$filter=${filter}&$skip=0&$top=1`;
}

export function parseGcisResponse(json: unknown): VatCompany | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const record = json[0] as Record<string, unknown>;
  const companyName =
    typeof record.Company_Name === "string" ? record.Company_Name : "";
  if (!companyName) return null;

  return {
    companyName,
    address:
      typeof record.Company_Location === "string" ? record.Company_Location : "",
    responsibleName:
      typeof record.Responsible_Name === "string" ? record.Responsible_Name : "",
    status:
      typeof record.Company_Status_Desc === "string"
        ? record.Company_Status_Desc
        : "",
  };
}
