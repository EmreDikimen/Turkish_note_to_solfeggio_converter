/**
 * THE LOGO'S MARKS — one source for the header and every icon (owner, 2026-10-01).
 *
 * A koma bemolü, a koma diyezi and an 8'lik, scattered: the owner's pick, candidate C with the
 * angles 27 / -25 / -173. ⚠ The POSITIONS were measured off the owner's screenshot of the review
 * page (each mark's ink box, to 0.25 unit), not taken from a layout seed — the seed on screen
 * was not visible, and seed 31 put the koma diyezi 2 units too close to the note. The outlines are Bravura's own glyphs (SMuFL, OFL), read out of
 * `public/fonts/Bravura.woff2` with fontTools, in font units, placed on a 100-unit tile.
 *
 * Read by `BrandMark.tsx` (the header, coloured by theme tokens so the night palette applies) and
 * by `tools/browser/make-icons.ts` (favicon + install icons, in the fixed `fill` below — an icon
 * has no theme). Change a mark here, then re-run make-icons.
 */
export type LogoRole = "eighth" | "flat" | "sharp";

export const LOGO_MARKS: { role: LogoRole; fill: string; transform: string; d: string }[] = [
  // noteEighthUp U+E1D7
  { role: "eighth", fill: "#1f3a6b", transform: "translate(71.07 49.25) rotate(27) scale(0.072 -0.072) translate(-283 -367.5)", d: "M451 594Q412 653 383 716Q355 779 342 851Q340 863 333 868Q326 873 312 873Q308 873 306 871Q303 869 302 864V118Q288 131 267 137Q247 144 222 144Q127 141 65 86Q2 31 0 -44Q1 -89 32 -113Q62 -138 109 -138Q189 -135 258 -80Q327 -24 332 50V611Q380 579 427 514Q474 448 499 390Q510 364 517 324Q523 285 523 240Q523 206 517 172Q512 137 499 103Q496 94 496 88Q496 76 502 69Q507 62 512 59L514 58Q521 57 529 61Q536 66 540 78Q542 82 553 135Q564 189 566 251Q565 345 532 432Q500 519 451 594Z" },
  // accidentalKomaFlat U+E443
  { role: "flat", fill: "#276e69", transform: "translate(29.96 33.22) rotate(-25) scale(0.062 -0.062) translate(-113.983 -132)", d: "M215 -170Q221 -127 224 124Q227 376 227 411Q226 425 216 432Q207 439 196 439Q188 439 183 435Q177 430 177 422Q177 393 180 282Q183 170 184 140Q184 135 181 130Q178 125 173 123Q172 122 171 122Q169 122 168 122Q164 122 157 127Q151 132 146 136Q135 143 120 148Q104 153 91 153Q55 150 29 126Q2 101 1 59Q0 23 28 -21Q55 -65 121 -112Q140 -125 159 -142Q178 -160 200 -173Q200 -173 202 -174Q204 -175 206 -175Q211 -175 215 -170ZM180 -81Q180 -85 178 -90Q176 -96 169 -96Q165 -96 159 -93Q125 -72 98 -36Q72 1 70 42Q70 62 80 80Q89 99 111 100Q130 99 152 83Q174 67 181 51Q182 48 182 40Q183 31 183 19Q183 -13 182 -46Q180 -78 180 -81Z" },
  // accidentalKomaSharp U+E444
  { role: "sharp", fill: "#9e2b25", transform: "translate(24.89 72.85) rotate(-173) scale(0.054 -0.054) translate(-114.5 7.5)", d: "M217 105Q222 107 226 112Q229 117 229 122V193Q229 201 222 201Q220 201 217 200Q212 198 179 186Q145 173 139 171Q132 172 129 178Q126 185 126 191V311Q126 316 122 319Q118 322 113 322Q101 322 99 317Q96 312 96 306V176Q95 169 93 162Q90 154 85 149Q68 142 48 133Q27 124 12 123Q7 121 3 116Q0 111 0 106V35Q0 31 2 29Q4 27 7 27Q8 27 10 27Q11 27 12 28L89 56Q94 56 95 49Q96 43 96 36V-63Q96 -71 93 -77Q91 -84 86 -86Q77 -89 47 -102Q16 -114 12 -116Q7 -118 3 -123Q0 -128 0 -133V-204Q0 -208 2 -210Q4 -212 7 -212Q8 -212 10 -212Q11 -212 12 -211Q16 -209 48 -197Q79 -184 89 -181L90 -180Q94 -180 95 -184Q96 -187 96 -192V-326Q96 -331 100 -334Q104 -337 109 -337Q120 -337 123 -332Q126 -328 126 -321V-182Q126 -178 127 -175Q128 -170 131 -166Q133 -163 137 -161Q147 -157 180 -144Q213 -132 217 -130Q222 -128 226 -123Q229 -118 229 -113V-42Q229 -34 222 -34Q220 -34 217 -35L139 -65Q136 -66 134 -66Q129 -66 127 -61Q126 -56 126 -47V46Q126 59 130 66Q133 73 139 75Z" },
];

/** The marks' own ink box on the 100-unit tile (measured from the outlines, a hair of margin). */
export const LOGO_INK_VIEWBOX = "17.0 13.2 74.2 77.7";
