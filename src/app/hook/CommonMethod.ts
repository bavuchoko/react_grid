/** 그리드 행 삭제/선택용. `row.id`가 유한한 number일 때만 반환한다. */
export const gridRowNumericId = (row: unknown): number | null => {
    const v = (row as { id?: unknown })?.id;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const getValue = (obj: any, key: string) => {
    if (!obj || !key) return undefined;

    return  key.split(".").reduce((acc, k) => acc?.[k], obj);
};

function keyStringMatchesToken(token: string, itemKey: unknown): boolean {
    if (itemKey == null) return token === "" || token === "null";
    if (typeof itemKey === "number" && token.trim() !== "" && !Number.isNaN(Number(token))) {
        return itemKey === Number(token);
    }
    return String(itemKey) === token;
}

/**
 * `Header.type === 'children'` 용.
 * `columnKey`는 첫 번째 `_` 앞을 `getValue` 경로(`.` 중첩 가능), 뒤를 `keyString`과 비교할 토큰으로 쓴다.
 * 예: `assetCustomStrings_7` → `row.assetCustomStrings` 배열에서 `keyString === 7`인 항목의 `valueString`.
 */
export function resolveChildrenCellValue(row: unknown, columnKey: string): unknown {
    if (!row || typeof row !== "object" || !columnKey) return undefined;
    const u = columnKey.indexOf("_");
    if (u <= 0 || u >= columnKey.length - 1) return undefined;
    const fieldPath = columnKey.slice(0, u);
    const keyToken = columnKey.slice(u + 1);
    const arr = getValue(row, fieldPath);
    if (!Array.isArray(arr)) return undefined;
    const found = arr.find((el) => {
        if (!el || typeof el !== "object") return false;
        const ks = (el as Record<string, unknown>).keyString;
        return keyStringMatchesToken(keyToken, ks);
    });
    if (!found || typeof found !== "object") return undefined;
    const vs = (found as Record<string, unknown>).valueString;
    return vs ?? undefined;
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
            return s.length > 120 ? `${s.slice(0, 117)}...` : s;
        } catch {
            return "";
        }
    }
    return String(value);
}