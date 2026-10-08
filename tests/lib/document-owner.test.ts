import { describe, expect, it } from "vitest";
import { checkOwnerName, splitOwnerLine, withOwnerLine } from "@/lib/document-owner";

describe("document owner name: first name + first letter of the surname", () => {
  it("accepts and normalizes the short form", () => {
    expect(checkOwnerName("алишер р")).toEqual({ ok: true, value: "Алишер Р." });
    expect(checkOwnerName("  Самариддин   З. ")).toEqual({ ok: true, value: "Самариддин З." });
    expect(checkOwnerName("ivan p")).toEqual({ ok: true, value: "Ivan P." });
    expect(checkOwnerName("Ҷамшед Қ.")).toEqual({ ok: true, value: "Ҷамшед Қ." });
  });

  it("refuses a full surname", () => {
    expect(checkOwnerName("Самариддин Зуҳуров")).toEqual({ ok: false, reason: "full_surname" });
    expect(checkOwnerName("Алишер Раҳимов Ҷ.")).toEqual({ ok: false, reason: "full_surname" });
  });

  it("refuses anything else, and an empty field is fine", () => {
    expect(checkOwnerName("Зуҳуров")).toEqual({ ok: false, reason: "format" });
    expect(checkOwnerName("123 4")).toEqual({ ok: false, reason: "format" });
    expect(checkOwnerName("   ")).toBeNull();
  });

  it("saves the name as the first line of the description and reads it back in any language", () => {
    const saved = withOwnerLine("Дар бозор ёфтам", "Алишер Р.", "tg");
    expect(saved).toBe("Соҳиб: Алишер Р.\nДар бозор ёфтам");
    expect(splitOwnerLine(saved)).toEqual({ ownerName: "Алишер Р.", rest: "Дар бозор ёфтам" });
    expect(splitOwnerLine("Владелец: Ivan P.\nНашёл в такси")).toEqual({ ownerName: "Ivan P.", rest: "Нашёл в такси" });
    expect(withOwnerLine(saved, "Самариддин З.", "en")).toBe("Owner: Самариддин З.\nДар бозор ёфтам");
    expect(withOwnerLine(saved, null, "tg")).toBe("Дар бозор ёфтам");
    expect(splitOwnerLine("Ҳамён ёфтам")).toEqual({ ownerName: "", rest: "Ҳамён ёфтам" });
  });
});
