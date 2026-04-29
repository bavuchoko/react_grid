export function removeRowsFromExcelGridData(args: {
    data: unknown[];
    ids: number[];
}): unknown[] {
    const { data, ids } = args;
    if (ids.length === 0) return data;

    const idSet = new Set(ids);
    return data.filter((row) => {
        const rowId = (row as { id?: unknown }).id;
        return !(typeof rowId === "number" && Number.isFinite(rowId) && idSet.has(rowId));
    });
}

