import { amountInWordsEn, amountInWordsZhTW } from "@/lib/amount-in-words";

const yuan = (n: number) => n * 100;

describe("amountInWordsZhTW", () => {
  it.each([
    [0, "新台幣零元整"],
    [yuan(1), "新台幣壹元整"],
    [yuan(10), "新台幣壹拾元整"],
    [yuan(11), "新台幣壹拾壹元整"],
    [yuan(20), "新台幣貳拾元整"],
    [yuan(101), "新台幣壹佰零壹元整"],
    [yuan(110), "新台幣壹佰壹拾元整"],
    [yuan(1001), "新台幣壹仟零壹元整"],
    [yuan(1010), "新台幣壹仟零壹拾元整"],
    [yuan(1100), "新台幣壹仟壹佰元整"],
    [yuan(10005), "新台幣壹萬零伍元整"],
    [yuan(10050), "新台幣壹萬零伍拾元整"],
    [yuan(12300), "新台幣壹萬貳仟參佰元整"],
    [yuan(20100), "新台幣貳萬零壹佰元整"],
    [yuan(100000), "新台幣壹拾萬元整"],
    [yuan(100010), "新台幣壹拾萬零壹拾元整"],
    [yuan(101000), "新台幣壹拾萬壹仟元整"],
    [yuan(1000000), "新台幣壹佰萬元整"],
    [yuan(10000000), "新台幣壹仟萬元整"],
    [yuan(100000000), "新台幣壹億元整"],
    [yuan(100000001), "新台幣壹億零壹元整"],
    [yuan(100010000), "新台幣壹億零壹萬元整"],
    [yuan(110000000), "新台幣壹億壹仟萬元整"],
    [yuan(123456789), "新台幣壹億貳仟參佰肆拾伍萬陸仟柒佰捌拾玖元整"],
    [1e12, "新台幣壹佰億元整"],
    [yuan(1_0000_0000_0000), "新台幣壹兆元整"],
    [yuan(1_0000_0001_0000), "新台幣壹兆零壹萬元整"],
  ])("%p cents → %s", (cents, words) => {
    expect(amountInWordsZhTW(cents)).toBe(words);
  });

  it.each([
    [123456, "新台幣壹仟貳佰參拾肆元伍角陸分"],
    [123450, "新台幣壹仟貳佰參拾肆元伍角整"],
    [123405, "新台幣壹仟貳佰參拾肆元零伍分"],
    [50, "新台幣伍角整"],
    [5, "新台幣伍分"],
    [55, "新台幣伍角伍分"],
    [1001, "新台幣壹拾元零壹分"],
  ])("%p cents (with 角/分) → %s", (cents, words) => {
    expect(amountInWordsZhTW(cents)).toBe(words);
  });

  it("supports a custom or empty prefix", () => {
    expect(amountInWordsZhTW(yuan(100), { prefix: "" })).toBe("壹佰元整");
    expect(amountInWordsZhTW(yuan(100), { prefix: "美金" })).toBe("美金壹佰元整");
  });

  it("rounds fractional cents and handles negatives / non-finite input", () => {
    expect(amountInWordsZhTW(99.6)).toBe("新台幣壹元整");
    expect(amountInWordsZhTW(-yuan(5))).toBe("新台幣負伍元整");
    expect(amountInWordsZhTW(NaN)).toBe("新台幣零元整");
  });
});

describe("amountInWordsEn", () => {
  it.each([
    [0, "Zero only"],
    [yuan(1), "One only"],
    [yuan(15), "Fifteen only"],
    [yuan(21), "Twenty-one only"],
    [yuan(100), "One hundred only"],
    [yuan(1234), "One thousand two hundred thirty-four only"],
    [123456, "One thousand two hundred thirty-four and 56/100 only"],
    [5, "Zero and 05/100 only"],
    [yuan(1_000_000), "One million only"],
    [yuan(1_000_001), "One million one only"],
    [1e12, "Ten billion only"],
    [yuan(12_345_678), "Twelve million three hundred forty-five thousand six hundred seventy-eight only"],
  ])("%p cents → %s", (cents, words) => {
    expect(amountInWordsEn(cents)).toBe(words);
  });

  it("handles negatives", () => {
    expect(amountInWordsEn(-yuan(3))).toBe("Minus three only");
  });
});
