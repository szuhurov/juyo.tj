import { describe, expect, it } from "vitest";
import {
  checkOwnerName,
  cleanOwnerAddress,
  pictureOwnerName,
  splitOwnerLine,
  withOwnerLine,
  withPostedFor,
} from "@/lib/document-owner";

const NONE = { postedFor: "", ownerName: "", address: "" };

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
    expect(splitOwnerLine(saved)).toEqual({ ...NONE, ownerName: "Алишер Р.", rest: "Дар бозор ёфтам" });
    expect(splitOwnerLine("Владелец: Ivan P.\nНашёл в такси")).toEqual({ ...NONE, ownerName: "Ivan P.", rest: "Нашёл в такси" });
    expect(withOwnerLine(saved, "Самариддин З.", "en")).toBe("Owner: Самариддин З.\nДар бозор ёфтам");
    expect(withOwnerLine(saved, null, "tg")).toBe("Дар бозор ёфтам");
    expect(splitOwnerLine("Ҳамён ёфтам")).toEqual({ ...NONE, rest: "Ҳамён ёфтам" });
  });

  it("keeps the optional address as the next line and reads both back", () => {
    const saved = withOwnerLine("Дар бозор ёфтам", "Алишер Р.", "tg", "  ноҳияи   Сино,\nкӯчаи Рӯдакӣ ");
    expect(saved).toBe("Соҳиб: Алишер Р.\nСуроға: ноҳияи Сино, кӯчаи Рӯдакӣ\nДар бозор ёфтам");
    expect(splitOwnerLine(saved)).toEqual({ ...NONE, ownerName: "Алишер Р.", address: "ноҳияи Сино, кӯчаи Рӯдакӣ", rest: "Дар бозор ёфтам" });
    // an address without a name, and in another language
    expect(splitOwnerLine("Адрес: 82 мкр\nНашёл паспорт")).toEqual({ ...NONE, address: "82 мкр", rest: "Нашёл паспорт" });
    // saving again without an address removes the line
    expect(withOwnerLine(saved, "Алишер Р.", "tg")).toBe("Соҳиб: Алишер Р.\nДар бозор ёфтам");
    expect(withOwnerLine(saved, null, "tg", "")).toBe("Дар бозор ёфтам");
  });

  it("cuts the address to one short line", () => {
    expect(cleanOwnerAddress("a".repeat(100))).toHaveLength(60);
    expect(cleanOwnerAddress(null)).toBe("");
  });

  it("finds the name older listings wrote in the text itself — always word + one initial", () => {
    expect(pictureOwnerName("Соҳиб: Алишер Р.\nНашли паспорт на имя Махмудов М.")).toBe("Алишер Р.");
    expect(pictureOwnerName("Нашли паспорт на имя Махмудов М. Ждём звонка.")).toBe("Махмудов М.");
    expect(pictureOwnerName("#Загран\nна имя Боборачабов А.")).toBe("Боборачабов А.");
    expect(pictureOwnerName("Хучатхо ба номи Носиров Комилчон Таваралиевич.")).toBe("Носиров К.");
    expect(pictureOwnerName("Нурахмадов И.")).toBe("Нурахмадов И.");
  });

  it("draws nothing when the text names nobody", () => {
    expect(pictureOwnerName("Папка-файл, принадлежит некой студентке Алимовой.")).toBe("");
    expect(pictureOwnerName("#Паспорт\nНаш офис по адресу Каххорова 111")).toBe("");
    expect(pictureOwnerName("Студенческий билет нашли.")).toBe("");
    expect(pictureOwnerName("")).toBe("");
  });

  it("keeps who an Instagram listing was posted for as the very first line", () => {
    const saved = withPostedFor(withOwnerLine("Дар бозор ёфтам", "Алишер Раҳимов", "tg", "ноҳияи Сино"), "  Фарҳод   Каримов ");
    expect(saved).toBe("Instagram: Фарҳод Каримов\nСоҳиб: Алишер Раҳимов\nСуроға: ноҳияи Сино\nДар бозор ёфтам");
    expect(splitOwnerLine(saved)).toEqual({
      postedFor: "Фарҳод Каримов",
      ownerName: "Алишер Раҳимов",
      address: "ноҳияи Сино",
      rest: "Дар бозор ёфтам",
    });
    // editing the listing later keeps the line
    expect(withOwnerLine(saved, null, "tg")).toBe("Instagram: Фарҳод Каримов\nДар бозор ёфтам");
    // posting again replaces it instead of stacking
    expect(withPostedFor(saved, "Сино Н.").split("\n")[0]).toBe("Instagram: Сино Н.");
    expect(splitOwnerLine("Instagram: Сино Н.\nКалид гум шуд")).toEqual({ ...NONE, postedFor: "Сино Н.", rest: "Калид гум шуд" });
    expect(pictureOwnerName(saved)).toBe("Алишер Раҳимов");
  });
});
