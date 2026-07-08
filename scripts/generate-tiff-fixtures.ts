import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as UTIF from "utif2";

// Generates a tiny real TIFF fixture and a deliberately corrupt file for
// the conversion pipeline's e2e test, so the test doesn't depend on a
// checked-in binary of unknown provenance.
const outDir = path.join(__dirname, "..", "test-fixtures", "tiff");
mkdirSync(outDir, { recursive: true });

function solidRgba(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

const width = 4;
const height = 4;
const page = solidRgba(width, height, 255, 0, 0);

const tiffBuffer = UTIF.encodeImage(page, width, height);
writeFileSync(path.join(outDir, "sample-valid.tiff"), Buffer.from(tiffBuffer));

writeFileSync(
  path.join(outDir, "corrupt.tiff"),
  Buffer.from("this is not a real tiff file"),
);

console.log("Wrote TIFF fixtures to", outDir);
