// Generate PWA icons from an inline SVG (brand colors + "PK" monogram).
// Run: npx tsx scripts/generate-pwa-icons.ts
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1c1917"/>
  <rect width="512" height="512" rx="96" fill="none" stroke="#b08d57" stroke-width="16"/>
  <text x="256" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="220" font-weight="700" fill="#f5f0e8">PK</text>
  <rect x="150" y="368" width="212" height="14" rx="7" fill="#b08d57"/>
</svg>`;

const sizes = [192, 512];
mkdirSync("public/icons", { recursive: true });

for (const size of sizes) {
  await sharp(Buffer.from(SVG))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`public/icons/icon-${size}.png`);
}

// Maskable icon: same art with extra safe-zone padding
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1c1917"/>
  <g transform="translate(51.2,51.2) scale(0.8)">
    <rect width="512" height="512" rx="96" fill="#1c1917"/>
    <text x="256" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="220" font-weight="700" fill="#f5f0e8">PK</text>
    <rect x="150" y="368" width="212" height="14" rx="7" fill="#b08d57"/>
  </g>
</svg>`;
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");
console.log("public/icons/icon-maskable-512.png");

// Favicon
await sharp(Buffer.from(SVG)).resize(32, 32).png().toFile("src/app/favicon.ico.png");
console.log("done");
