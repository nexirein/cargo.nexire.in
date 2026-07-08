import JSZip from "jszip";
import type { ConversionFileResult } from "./pool";

export async function buildZipFromResults(
  results: ConversionFileResult[],
): Promise<Blob> {
  const zip = new JSZip();
  for (const result of results) {
    if (result.status === "success" && result.pdfBytes) {
      const pdfName = result.fileName.replace(/\.(tif|tiff)$/i, ".pdf");
      zip.file(pdfName, result.pdfBytes);
    }
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
