export type ConversionStage =
  | "scanning"
  | "validating"
  | "converting"
  | "generating"
  | "packaging"
  | "complete";

export interface ConversionProgress {
  totalFiles: number;
  completedFiles: number;
  currentBatch: number;
  totalBatches: number;
  stage: ConversionStage;
}

export interface ConversionFileResult {
  fileName: string;
  status: "success" | "error";
  pdfBytes?: Uint8Array;
  pageCount?: number;
  errorMessage?: string;
}

const BATCH_SIZE = 25;
const WORKER_COUNT = 4;

interface WorkerMessage {
  type: "done" | "error";
  requestId: string;
  pdfBytes?: ArrayBuffer;
  pageCount?: number;
  message?: string;
}

export class TiffConversionPool {
  private workers: Worker[] = [];

  constructor() {
    for (let i = 0; i < WORKER_COUNT; i++) {
      this.workers.push(
        new Worker(new URL("../../workers/tiff-worker.ts", import.meta.url), {
          type: "module",
        }),
      );
    }
  }

  async convertAll(
    files: File[],
    onProgress: (
      progress: ConversionProgress,
      results: ConversionFileResult[],
    ) => void,
  ): Promise<ConversionFileResult[]> {
    const totalBatches = Math.max(1, Math.ceil(files.length / BATCH_SIZE));
    const allResults: ConversionFileResult[] = [];

    const report = (stage: ConversionStage, currentBatch: number) =>
      onProgress(
        {
          totalFiles: files.length,
          completedFiles: allResults.length,
          currentBatch,
          totalBatches,
          stage,
        },
        allResults,
      );

    report("scanning", 0);
    report("validating", 0);

    for (let b = 0; b < totalBatches; b++) {
      const batchFiles = files.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      report("converting", b + 1);

      await this.convertBatch(batchFiles, (result) => {
        allResults.push(result);
        report("converting", b + 1);
      });
    }

    report("generating", totalBatches);
    report("packaging", totalBatches);
    report("complete", totalBatches);

    return allResults;
  }

  /** Re-runs a single previously-failed file through the pool. */
  convertOne(file: File): Promise<ConversionFileResult> {
    return this.runOnWorker(this.workers[0], file);
  }

  private convertBatch(
    files: File[],
    onFileDone: (result: ConversionFileResult) => void,
  ): Promise<void> {
    if (files.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let nextIndex = 0;
      let remaining = files.length;

      const pullNext = (worker: Worker) => {
        if (nextIndex >= files.length) return;
        const file = files[nextIndex++];

        this.runOnWorker(worker, file).then((result) => {
          onFileDone(result);
          remaining -= 1;
          if (remaining === 0) {
            resolve();
          } else {
            pullNext(worker);
          }
        });
      };

      for (const worker of this.workers) {
        pullNext(worker);
      }
    });
  }

  private runOnWorker(worker: Worker, file: File): Promise<ConversionFileResult> {
    return new Promise((resolve) => {
      const requestId = `${file.name}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.requestId !== requestId) return;
        worker.removeEventListener("message", handleMessage);

        if (event.data.type === "done" && event.data.pdfBytes) {
          resolve({
            fileName: file.name,
            status: "success",
            pdfBytes: new Uint8Array(event.data.pdfBytes),
            pageCount: event.data.pageCount,
          });
        } else {
          resolve({
            fileName: file.name,
            status: "error",
            errorMessage: event.data.message ?? "Conversion failed.",
          });
        }
      };

      worker.addEventListener("message", handleMessage);
      file.arrayBuffer().then((buffer) => {
        worker.postMessage({ type: "convert", requestId, buffer }, [buffer]);
      });
    });
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
  }
}
