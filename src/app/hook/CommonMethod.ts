/** 그리드 행 삭제/선택용. `row.id`가 유한한 number일 때만 반환한다. */
export const gridRowNumericId = (row: unknown): number | null => {
    const v = (row as { id?: unknown })?.id;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const getValue = (obj: any, key: string | undefined | null) => {
    if (!obj || key == null || key === "") return undefined;

    return key.split(".").reduce((acc, k) => acc?.[k], obj);
};

function keyStringMatchesToken(token: string, itemKey: unknown): boolean {
    if (itemKey == null) return token === "" || token === "null";
    if (typeof itemKey === "number" && token.trim() !== "" && !Number.isNaN(Number(token))) {
        return itemKey === Number(token);
    }
    return String(itemKey) === token;
}

function childrenItemMatchKey(el: Record<string, unknown>): unknown {
    if ("keyString" in el) return el.keyString;
    const customCode = el.customCode;
    if (customCode && typeof customCode === "object" && "id" in customCode) {
        return (customCode as Record<string, unknown>).id;
    }
    if ("key" in el) return el.key;
    return undefined;
}

function childrenItemDisplayValue(el: Record<string, unknown>): unknown {
    if ("valueString" in el) return el.valueString;
    if ("value" in el) return el.value;
    return undefined;
}

/**
 * `Header.type === 'children'` 용.
 * `columnKey`는 첫 번째 `_` 앞을 `getValue` 경로(`.` 중첩 가능), 뒤를 `keyString`과 비교할 토큰으로 쓴다.
 * 예: `assetCustomStrings_7` → `row.assetCustomStrings` 배열에서 `keyString === 7`인 항목의 `valueString`.
 */
function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return;
    let cur: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        const next = cur[k];
        if (next == null || typeof next !== "object" || Array.isArray(next)) {
            cur[k] = {};
        }
        cur = cur[k] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
}

/** `type: "children"` 컬럼 붙여넣기 — `valueString` 갱신 */
export function applyChildrenPasteValue(
    row: Record<string, unknown>,
    columnKey: string,
    value: unknown,
): boolean {
    const u = columnKey.indexOf("_");
    if (u <= 0 || u >= columnKey.length - 1) return false;
    const fieldPath = columnKey.slice(0, u);
    const keyToken = columnKey.slice(u + 1);
    const arr = getValue(row, fieldPath);
    if (!Array.isArray(arr)) return false;

    let found = false;
    const nextArr = arr.map((el) => {
        if (!el || typeof el !== "object") return el;
        const rec = el as Record<string, unknown>;
        if (!keyStringMatchesToken(keyToken, childrenItemMatchKey(rec))) return el;
        found = true;
        return { ...rec, valueString: String(value ?? "") };
    });
    if (!found) return false;
    setValueAtPath(row, fieldPath, nextArr);
    return true;
}

/**
 * 붙여넣기 값을 행 객체에 반영한다.
 * @param columnType `Header.type` — `children`이면 배열 항목 `valueString` 수정
 */
export function applyPasteValueToRow(
    row: unknown,
    columnKey: string,
    value: unknown,
    columnType?: string,
): boolean {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const record = row as Record<string, unknown>;
    if (columnType === "children") {
        return applyChildrenPasteValue(record, columnKey, value);
    }
    record[columnKey] = value;
    return true;
}

export function resolveChildrenCellValue(row: unknown, columnKey: string | undefined | null): unknown {
    if (!row || typeof row !== "object" || columnKey == null || columnKey === "") return undefined;
    const u = columnKey.indexOf("_");
    if (u <= 0 || u >= columnKey.length - 1) return undefined;
    const fieldPath = columnKey.slice(0, u);
    const keyToken = columnKey.slice(u + 1);
    const arr = getValue(row, fieldPath);
    if (!Array.isArray(arr)) return undefined;
    const found = arr.find((el) => {
        if (!el || typeof el !== "object") return false;
        return keyStringMatchesToken(keyToken, childrenItemMatchKey(el as Record<string, unknown>));
    });
    if (!found || typeof found !== "object") return undefined;
    return childrenItemDisplayValue(found as Record<string, unknown>) ?? undefined;
}

/**
 * `render`가 없을 때 셀에 넣을 문자열.
 * - 배열·객체(예: operator/handler 유저 목록)는 React 자식으로 직접 넣을 수 없어 여기서 평문으로 만든다.
 */
export function formatCellDisplayValue(value: unknown): string {
    if (value == null) return "";
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return String(value);
    if (t === "bigint") return String(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return "";
        return value
            .map((v) => formatCellDisplayValue(v))
            .filter((s) => s.length > 0)
            .join(", ");
    }
    if (t === "object") {
        const o = value as Record<string, unknown>;
        if (typeof o.name === "string" && o.name.trim()) return o.name;
        if (typeof o.label === "string" && o.label.trim()) return o.label;
        if (typeof o.title === "string" && o.title.trim()) return o.title;
        try {
            const s = JSON.stringify(value);
            return s.length > 130 ? `${s.slice(0, 117)}...` : s;
        } catch {
            return "";
        }
    }
    return String(value);
}