import * as UTIF from "utif2";
import { PDFDocument } from "pdf-lib";

// Runs entirely inside a dedicated Web Worker: TIFF decode, canvas-based
// JPEG re-encode, and PDF assembly all happen off the main thread so large
// scans never freeze the UI. `self` is typed as `unknown as Worker` below
// because the project's shared tsconfig compiles against the DOM lib
// (Window's postMessage/onmessage signatures), not the WorkerGlobalScope
// lib — casting once here avoids a second, conflicting tsconfig just for
// this file.
const ctx = self as unknown as Worker;

interface ConvertRequest {
  type: "convert";
  requestId: string;
  buffer: ArrayBuffer;
}

ctx.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  const { type, requestId, buffer } = event.data;
  if (type !== "convert") return;

  try {
    const { buffer: pdfBuffer, pageCount } = await convertTiffToPdf(buffer);
    ctx.postMessage(
      { type: "done", requestId, pdfBytes: pdfBuffer, pageCount },
      [pdfBuffer],
    );
  } catch (error) {
    ctx.postMessage({
      type: "error",
      requestId,
      message:
        error instanceof Error ? error.message : "Unknown conversion error.",
    });
  }
};

async function convertTiffToPdf(
  buffer: ArrayBuffer,
): Promise<{ buffer: ArrayBuffer; pageCount: number }> {
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error("Could not read any pages from this TIFF file.");
  }

  const pdfDoc = await PDFDocument.create();

  for (const ifd of ifds) {
    UTIF.decodeImage(buffer, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const { width, height } = ifd;

    if (!width || !height) {
      throw new Error("A page in this TIFF is missing dimensions.");
    }

    const canvas = new OffscreenCanvas(width, height);
    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) {
      throw new Error("Could not create a canvas context for conversion.");
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      width,
      height,
    );
    canvasCtx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });
    const jpegBytes = new Uint8Array(await blob.arrayBuffer());

    const jpegImage = await pdfDoc.embedJpg(jpegBytes);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(jpegImage, { x: 0, y: 0, width, height });
  }

  const pdfBytes = await pdfDoc.save();
  // .slice() copies into a tightly-sized buffer so the transferred
  // ArrayBuffer contains exactly the PDF bytes, nothing more.
  const exact = pdfBytes.slice();
  return { buffer: exact.buffer, pageCount: ifds.length };
}

export {};
