export function computeLeftOffsets(columns: readonly unknown[], colWidthByKey: Record<string, number>) {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
        offsets[i] = acc;
        const key = String((columns[i] as any).key ?? i);
        acc += colWidthByKey[key] ?? 0;
    }
    return offsets;
}

export function getColumnFreezeStickyStyle(args: {
    colIndex: number;
    isHeader: boolean;
    freezeUntilIndex: number | null;
    leftOffsets: number[];
}) {
    const { colIndex, isHeader, freezeUntilIndex, leftOffsets } = args;
    if (freezeUntilIndex == null || colIndex > freezeUntilIndex) return undefined;
    const isLastFrozen = colIndex === freezeUntilIndex;
    return {
        position: 'sticky' as const,
        left: leftOffsets[colIndex] ?? 0,
        top: isHeader ? 0 : undefined,
        zIndex: isHeader ? 5 : 3,
        backgroundColor: 'rgba(219, 234, 254)',
        backgroundClip: 'padding-box' as const,
        borderRight: isLastFrozen ? '3px solid #1d4ed8' : undefined,
    };
}
