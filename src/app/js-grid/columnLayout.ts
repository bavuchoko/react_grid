import {gridThemeShowsBorders} from "./gridTheme.ts";

const FREEZE_HIGHLIGHT_BG = "rgb(219, 234, 254)";
const FREEZE_LAST_BORDER = "2px solid #1d4ed8";

/**
 * 고정 열 `sticky left` 합산.
 * - `measuredByKey`: 헤더 셀 DOM 너비(우선).
 * - `fallbackByKey`: 아직 측정 전이거나 0일 때 `header.width`/드래그 저장값.
 * 두 값이 어긋나면 `left`가 실제보다 커져 열 사이에 빈 공간이 생길 수 있다.
 */
export function computeLeftOffsets(
    columns: readonly unknown[],
    measuredByKey: Record<string, number>,
    fallbackByKey: Record<string, number>,
) {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
        offsets[i] = acc;
        const key = String((columns[i] as any).key ?? i);
        const m = measuredByKey[key];
        const f = fallbackByKey[key];
        // 사용자·저장 너비(override)가 DOM 측정값보다 우선해야 드래그로 줄인 폭이 반영된다.
        const w = f != null && f > 0 ? f : m != null && m > 0 ? m : 0;
        acc += w;
    }
    return offsets;
}

export function getColumnFreezeStickyStyle(args: {
    colIndex: number;
    isHeader: boolean;
    freezeUntilIndex: number | null;
    leftOffsets: number[];
    theme?: string;
}) {
    const { colIndex, isHeader, freezeUntilIndex, leftOffsets, theme } = args;
    if (freezeUntilIndex == null || colIndex > freezeUntilIndex) return undefined;
    const isLastFrozen = colIndex === freezeUntilIndex;
    const showBorders = gridThemeShowsBorders(theme);
    return {
        position: "sticky" as const,
        left: leftOffsets[colIndex] ?? 0,
        top: isHeader ? 0 : undefined,
        zIndex: isHeader ? 5 : 3,
        backgroundColor: FREEZE_HIGHLIGHT_BG,
        backgroundClip: "padding-box" as const,
        // `linear`는 셀 border를 끄지만, 고정 구간 끝(마지막 고정 열) 구분선은 유지한다.
        borderRight: isLastFrozen
            ? FREEZE_LAST_BORDER
            : showBorders
              ? `1px solid ${FREEZE_HIGHLIGHT_BG}`
              : "none",
    };
}
