/** Curated families for the picker (matches fonts served from Google Fonts). */
export const GOOGLE_FONT_FAMILIES: string[] = [
  "Bebas Neue",
  "DM Sans",
  "EB Garamond",
  "Fira Sans",
  "Instrument Sans",
  "Inter",
  "JetBrains Mono",
  "Lato",
  "Lexend",
  "Libre Baskerville",
  "Libre Franklin",
  "Manrope",
  "Merriweather",
  "Montserrat",
  "Noto Sans",
  "Nunito",
  "Open Sans",
  "Oswald",
  "Outfit",
  "Playfair Display",
  "Plus Jakarta Sans",
  "Poppins",
  "PT Serif",
  "Raleway",
  "Roboto",
  "Roboto Condensed",
  "Roboto Flex",
  "Roboto Mono",
  "Rubik",
  "Source Sans 3",
  "Source Serif 4",
  "Space Grotesk",
  "Space Mono",
  "Syne",
  "Ubuntu",
  "Work Sans",
].sort((a, b) => a.localeCompare(b));

export function googleFontStylesheetHref(family: string): string {
  const q = family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${q}:wght@400;600;700&display=swap`;
}
