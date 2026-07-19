import { parseGcisResponse, gcisUrl } from "@/lib/gcis";

const SAMPLE = [
  {
    Business_Accounting_NO: "22099131",
    Company_Name: "台灣積體電路製造股份有限公司",
    Company_Location: "新竹科學園區新竹市力行六路8號",
    Responsible_Name: "魏哲家",
    Company_Status_Desc: "核准設立",
  },
];

describe("parseGcisResponse", () => {
  it("maps the first record's fields", () => {
    expect(parseGcisResponse(SAMPLE)).toEqual({
      companyName: "台灣積體電路製造股份有限公司",
      address: "新竹科學園區新竹市力行六路8號",
      responsibleName: "魏哲家",
      status: "核准設立",
    });
  });

  it("returns null for an empty array", () => {
    expect(parseGcisResponse([])).toBeNull();
  });

  it("returns null for non-array / missing company name", () => {
    expect(parseGcisResponse(null)).toBeNull();
    expect(parseGcisResponse({})).toBeNull();
    expect(parseGcisResponse([{ Company_Location: "x" }])).toBeNull();
  });
});

describe("gcisUrl", () => {
  it("builds an OData query filtering by the VAT number", () => {
    const url = gcisUrl("22099131");
    expect(url).toContain("5F64D864-61CB-4D0D-8AD9-492047CC1EA6");
    expect(url).toContain("Business_Accounting_NO");
    expect(url).toContain("22099131");
    expect(url).toContain("$format=json");
  });
});
