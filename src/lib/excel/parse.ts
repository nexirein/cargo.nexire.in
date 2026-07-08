import ExcelJS from "exceljs";

export interface ParsedExcelRow {
  /** 1-based row number, matching the spreadsheet, for error reporting. */
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedExcel {
  headers: string[];
  rows: ParsedExcelRow[];
}

export async function parseExcelBuffer(
  buffer: ArrayBuffer,
): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("The uploaded file has no worksheets.");
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value).trim();
  });

  const rows: ParsedExcelRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    let hasAnyValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const raw = cellToString(row.getCell(index + 1).value);
      values[header] = raw;
      if (raw) hasAnyValue = true;
    });
    if (hasAnyValue) {
      rows.push({ rowNumber, values });
    }
  });

  return { headers: headers.filter(Boolean), rows };
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("result" in value) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
    return "";
  }
  return String(value).trim();
}
