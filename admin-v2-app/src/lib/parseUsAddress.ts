// Parses a pasted US name + shipping address block, as copied from an FBM order
// ("Shipping address") or a Reverb order ("Shipping Info"), into form fields:
//
//   David Lynn Anderson Jr.          Joseph Barnet
//   219 North Ave NE                 2012 Grace Church Rd
//   Upstairs                         Silver Spring MD 20910-2115
//   MASSILLON, OH 44646              UNITED STATES
//                                    tel: 3018142012
//
// First line is the name, the "City, ST ZIP" line ends the address, and the lines in
// between are street lines. Headings, country and phone lines are ignored.

export type ParsedUsAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const IGNORED_LINE = /^(shipping (address|info)|ship to|united states( of america)?|usa?|tel:.*|phone:.*|\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})$/i;
const CITY_STATE_ZIP = /^(.+?),?\s+([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/;

// "MASSILLON" -> "Massillon"; mixed-case input is left as typed.
function tidyCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

export function parseUsAddress(text: string): ParsedUsAddress | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !IGNORED_LINE.test(line));

  const cityLineIndex = lines.findIndex((line) => CITY_STATE_ZIP.test(line));
  // Need a name and at least one street line before the city/state/ZIP line.
  if (cityLineIndex < 2) return null;
  const [, city, state, postalCode] = lines[cityLineIndex].match(CITY_STATE_ZIP)!;
  const streetLines = lines.slice(1, cityLineIndex);

  return {
    name: lines[0],
    line1: streetLines[0],
    line2: streetLines.slice(1).join(', '),
    city: tidyCase(city.trim()),
    state: state.toUpperCase(),
    postalCode,
  };
}
