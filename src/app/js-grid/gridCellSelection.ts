import type { GridCellPasteBatch, GridCellPasteItem } from "../type/Type.ts";

export type GridCellRange = {
    columnKey: string;
    rowStart: number;
    rowEnd: number;
};

export function normalizeCellRange(
    columnKey: string,
    rowA: number,
    rowB: number,
): GridCellRange {
    return {
        columnKey,
        rowStart: Math.min(rowA, rowB),
        rowEnd: Math.max(rowA, rowB),
    };
}

export function isCellInRange(
    range: GridCellRange | null,
    rowIndex: number,
    columnKey: string,
): boolean {
    if (!range) return false;
    return (
        range.columnKey === columnKey
        && rowIndex >= range.rowStart
        && rowIndex <= range.rowEnd
    );
}

/** 붙여넣기 대상 행 `i`(0-based)에 쓸 값. 한 줄이면 전 행 동일, 여러 줄이면 순환(A,B,C → A,B,C,A,B,…). */
export function pasteLineForRowIndex(lines: string[], rowOffset: number): string {
    if (lines.length === 0) return "";
    if (lines.length === 1) return lines[0];
    return lines[rowOffset % lines.length] ?? "";
}

export function parseClipboardLines(text: string): string[] {
    if (!text) return [""];
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

function pasteValueGroupKey(columnKey: string, value: unknown): string {
    return `${columnKey}\u0000${String(value ?? "")}`;
}

/** `GridCellPasteItem[]` → API 호출 단위(`columnKey`+`value` 동일 시 `rowIds` 묶음) */
export function groupPasteItemsIntoBatches(items: GridCellPasteItem[]): GridCellPasteBatch[] {
    const map = new Map<string, GridCellPasteBatch>();

    for (const item of items) {
        const rowId = item.rowId;
        if (rowId == null) continue;
        if (typeof rowId !== "string" && typeof rowId !== "number") continue;

        const groupKey = pasteValueGroupKey(item.columnKey, item.value);
        let batch = map.get(groupKey);
        if (!batch) {
            batch = {
                columnKey: item.columnKey,
                value: item.value,
                rowIds: [],
                items: [],
            };
            map.set(groupKey, batch);
        }
        batch.rowIds.push(rowId);
        batch.items.push(item);
    }

    return Array.from(map.values());
}

export function resolveRowId(
    row: unknown,
    rowIdKey: string,
): string | number | null | undefined {
    if (row == null || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[rowIdKey];
    if (v == null) return undefined;
    if (typeof v === "string" || typeof v === "number") return v;
    return String(v);
}
