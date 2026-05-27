import type {JsGridTableColumn} from "../type/Type.ts";
import {
    formatCellDisplayValue,
    getValue,
    resolveChildrenCellValue,
} from "../hook/CommonMethod.ts";

/**
 * 필터 후보값 추출 — `getFilterValue` → `children` resolver → `getValue(row, key)` 순.
 * 표시·매칭에 모두 같은 결과를 쓰기 위해 분리.
 */
export function resolveColumnFilterValue(
    row: unknown,
    column: Pick<JsGridTableColumn, "key" | "type" | "getFilterValue">,
): unknown {
    if (typeof column.getFilterValue === "function") {
        return column.getFilterValue(row);
    }
    if (column.type === "children") {
        return resolveChildrenCellValue(row, column.key);
    }
    return getValue(row, column.key);
}

/** 필터 메뉴/매칭에서 사용하는 표시 문자열. `null/undefined/''`는 `__JSGRID_BLANK__` 토큰으로 통일. */
export const FILTER_BLANK_TOKEN = "__JSGRID_BLANK__";

export function toFilterToken(value: unknown): string {
    if (value == null) return FILTER_BLANK_TOKEN;
    const text = formatCellDisplayValue(value);
    return text === "" ? FILTER_BLANK_TOKEN : text;
}

export type ColumnFilterOption = {
    token: string;
    /** 사용자에게 보일 라벨. `__JSGRID_BLANK__`는 `(비어 있음)`. */
    label: string;
    count: number;
};

/** 현재 행 집합에서 컬럼의 고유 값 목록을 추출(정렬·카운트 포함). */
export function buildColumnFilterOptions(
    rows: readonly unknown[],
    column: Pick<JsGridTableColumn, "key" | "type" | "getFilterValue">,
): ColumnFilterOption[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const value = resolveColumnFilterValue(row, column);
        if (Array.isArray(value) && value.length > 0) {
            // 배열은 각 원소를 옵션으로 펼친다(엑셀에서 다중 태그 셀과 비슷한 사용성).
            for (const v of value) {
                const t = toFilterToken(v);
                counts.set(t, (counts.get(t) ?? 0) + 1);
            }
            continue;
        }
        const t = toFilterToken(value);
        counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    const list: ColumnFilterOption[] = [];
    for (const [token, count] of counts) {
        list.push({
            token,
            label: token === FILTER_BLANK_TOKEN ? "(비어 있음)" : token,
            count,
        });
    }
    list.sort((a, b) => {
        if (a.token === FILTER_BLANK_TOKEN) return 1;
        if (b.token === FILTER_BLANK_TOKEN) return -1;
        return a.label.localeCompare(b.label, undefined, {numeric: true, sensitivity: "base"});
    });
    return list;
}

/** 행이 컬럼 필터(허용 토큰 집합)에 매칭되는지. */
export function rowMatchesColumnFilter(
    row: unknown,
    column: Pick<JsGridTableColumn, "key" | "type" | "getFilterValue">,
    allowedTokens: ReadonlySet<string>,
): boolean {
    const value = resolveColumnFilterValue(row, column);
    if (Array.isArray(value) && value.length > 0) {
        return value.some((v) => allowedTokens.has(toFilterToken(v)));
    }
    return allowedTokens.has(toFilterToken(value));
}

/** 모든 활성 필터를 행 배열에 적용. 비어있으면 원본 배열을 그대로 반환. */
export function applyColumnFilters(
    rows: readonly unknown[],
    columns: readonly Pick<JsGridTableColumn, "key" | "type" | "getFilterValue">[],
    filters: Record<string, ReadonlySet<string>>,
): readonly unknown[] {
    const activeEntries = Object.entries(filters).filter(([, set]) => set && set.size > 0);
    if (activeEntries.length === 0) return rows;

    const colByKey = new Map(columns.map((c) => [c.key, c] as const));
    return rows.filter((row) =>
        activeEntries.every(([key, set]) => {
            const col = colByKey.get(key);
            if (!col) return true;
            return rowMatchesColumnFilter(row, col, set);
        }),
    );
}
