import type { Header } from "../app/type/Type.ts";

export const PERF_TEST_ROWS = 2000;
export const PERF_TEST_COLS = 100;

const COL_WIDTH = 120;

export function buildPerfTestHeader(colCount = PERF_TEST_COLS): Header[] {
    const headers: Header[] = [];
    for (let c = 0; c < colCount; c++) {
        headers.push({
            key: `col_${c}`,
            label: `컬럼 ${c + 1}`,
            type: "string",
            width: COL_WIDTH,
            filterable: c === 0,
        });
    }
    return headers;
}

export function buildPerfTestRows(
    rowCount = PERF_TEST_ROWS,
    colCount = PERF_TEST_COLS,
): Record<string, unknown>[] {
    const rows = new Array<Record<string, unknown>>(rowCount);
    for (let r = 0; r < rowCount; r++) {
        const row: Record<string, unknown> = { id: r + 1 };
        for (let c = 0; c < colCount; c++) {
            row[`col_${c}`] = `R${r + 1}-C${c + 1}`;
        }
        rows[r] = row;
    }
    return rows;
}
