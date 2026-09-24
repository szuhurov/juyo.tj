/**
 * Phase 9F — CSV export. Flattens an analytics summary jsonb object (from
 * get_my_analytics_summary / get_organization_analytics_summary /
 * admin_get_platform_analytics) into metric/value rows. Deliberately
 * generic — the same flattener backs every export, so there is never a
 * second, differently-scoped query written just for CSV.
 */

export interface CsvRow {
  metric: string;
  value: string;
}

export function flattenAnalyticsForCsv(data: Record<string, unknown>, prefix = ""): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const [key, value] of Object.entries(data)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      continue;
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          rows.push(...flattenAnalyticsForCsv(item as Record<string, unknown>, `${label}[${i}]`));
        } else {
          rows.push({ metric: `${label}[${i}]`, value: String(item) });
        }
      });
    } else if (typeof value === "object") {
      rows.push(...flattenAnalyticsForCsv(value as Record<string, unknown>, label));
    } else {
      rows.push({ metric: label, value: String(value) });
    }
  }
  return rows;
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(rows: CsvRow[]): string {
  const header = "metric,value";
  const lines = rows.map((r) => `${escapeCsvField(r.metric)},${escapeCsvField(r.value)}`);
  return [header, ...lines].join("\n");
}
