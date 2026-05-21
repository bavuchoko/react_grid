export type RowSelectionKey = string;

export type ResolveRowSelectionKeyOptions = {
    row: unknown;
    rowIndex: number;
    pageNumber: number;
    /** 기본 `id` */
    idKey?: string;
    getRowSelectionId?: (row: unknown, rowIndex: number) => string | number | null | undefined;
};

function normalizeSelectionId(raw: string | number): RowSelectionKey | null {
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    if (typeof raw === "string" && raw.length > 0) return raw;
    return null;
}

/** 체크박스 선택 키. 식별자가 없으면 페이지·인덱스 fallback(데이터 바뀌면 시그니처로 초기화). */
export function resolveRowSelectionKey(opts: ResolveRowSelectionKeyOptions): RowSelectionKey {
    const { row, rowIndex, pageNumber, idKey = "id", getRowSelectionId } = opts;

    if (getRowSelectionId) {
        const custom = normalizeSelectionId(getRowSelectionId(row, rowIndex) as string | number);
        if (custom != null) return custom;
    }

    const o = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
    if (o) {
        const fromField = normalizeSelectionId(o[idKey] as string | number);
        if (fromField != null) return fromField;
    }

    return `__row:${pageNumber}:${rowIndex}`;
}

/** 현재 페이지 `content`·페이지 메타가 바뀌면 선택을 비울 때 사용 */
export function buildRowSelectionDataSignature(args: {
    data: unknown[];
    pageNumber: number;
    totalElements?: number;
    totalPages?: number;
    idKey?: string;
    getRowSelectionId?: (row: unknown, rowIndex: number) => string | number | null | undefined;
}): string {
    const keys = args.data.map((row, i) =>
        resolveRowSelectionKey({
            row,
            rowIndex: i,
            pageNumber: args.pageNumber,
            idKey: args.idKey,
            getRowSelectionId: args.getRowSelectionId,
        }),
    );
    return [
        String(args.pageNumber),
        String(args.totalElements ?? ""),
        String(args.totalPages ?? ""),
        keys.join("\u0001"),
    ].join("\u0000");
}
