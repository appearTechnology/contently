import { GOOGLE_FONT_FAMILIES } from "@/lib/branding/google-fonts";
import { emptyTypographySlot, type TypographySlot } from "@/lib/branding/types";

/** Map a font family name from a site or brand guide to a typography slot. */
export function typographySlotForFamily(family: string): TypographySlot {
  const name = family.trim();
  if (!name) return emptyTypographySlot();
  const match = GOOGLE_FONT_FAMILIES.find(
    (f) => f.toLowerCase() === name.toLowerCase(),
  );
  if (match) {
    return {
      kind: "google",
      manual: "",
      googleFamily: match,
      customFamily: "",
    };
  }
  return {
    kind: "manual",
    manual: name,
    googleFamily: "",
    customFamily: "",
  };
}
