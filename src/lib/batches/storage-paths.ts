export function batchSourcePath(batchRunId: string): string {
  return `${batchRunId}/original.xlsx`;
}

export function invoicePath(
  batchRunId: string,
  awb: string,
  fileName: string,
): string {
  return `${batchRunId}/${awb}/${fileName}`;
}
