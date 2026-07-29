/**
 * Escape a value for CSV and neutralize spreadsheet formula injection.
 * Cells starting with =, +, -, @, tab, or CR are prefixed with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  let text = value == null ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text) || text.startsWith("'")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
