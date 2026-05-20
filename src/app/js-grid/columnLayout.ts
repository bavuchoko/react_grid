import type {CSSProperties, MutableRefObject} from "react";
import type {JsGridTableColumn} from "../type/Type.ts";
import {gridThemeShowsBorders} from "./gridTheme.ts";

const FREEZE_HIGHLIGHT_BG = "rgb(219, 234, 254)";

const CHECKBOX_COL_MIN_PX = 40;
const ROWNUM_COL_MIN_PX = 56;

export function readHeaderCellWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
): Record<string, number> {
    const next: Record<string, number> = {};
    columns.forEach((col, idx) => {
        const key = String(col.key ?? idx);
        const el = headerCellRefs.current[idx];
        if (!el) return;
        // border-box 전체 폭(패딩·테두리 포함). rect·offsetWidth 중 큰 값을 쓴다.
        const measured = Math.max(
            el.offsetWidth,
            Math.ceil(el.getBoundingClientRect().width),
        );
        if (measured > 0) next[key] = measured;
    });
    return next;
}

export function mergeMeasuredWithOverride(
    measured: Record<string, number>,
    override: Record<string, number>,
    columns: readonly JsGridTableColumn[],
): Record<string, number> {
    const next = { ...measured };
    columns.forEach((col, idx) => {
        const key = String(col.key ?? idx);
        const o = override[key];
        if (o != null && o > 0) next[key] = o;
    });
    return next;
}

/**
 * 틀 고정 직전 헤더 셀의 실제 렌더 너비(border-box, 패딩·테두리 포함).
 * `header.width`/override만 쓰면 패딩만큼 좁게 잠기는 경우가 있다.
 */
export function captureColumnLayoutWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
): Record<string, number> {
    return readHeaderCellWidths(columns, headerCellRefs);
}

function defaultColumnMinPx(col: JsGridTableColumn): number {
    if (col.__checkbox__) return CHECKBOX_COL_MIN_PX;
    if (col.__rownum__) return ROWNUM_COL_MIN_PX;
    return 0;
}

/** 스티키 `left` 합산용 열 너비 맵(열당 하나의 숫자). */
export function buildColumnLayoutWidths(
    columns: readonly JsGridTableColumn[],
    measuredByKey: Record<string, number>,
    overrideByKey: Record<string, number>,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const key = String(col.key ?? i);
        const o = overrideByKey[key];
        const m = measuredByKey[key];
        const w =
            o != null && o > 0
                ? o
                : m != null && m > 0
                  ? m
                  : defaultColumnMinPx(col);
        if (w > 0) out[key] = w;
    }
    return out;
}

/**
 * 고정 열 `sticky left` 합산.
 * `widthByKey`는 `buildColumnLayoutWidths` 등으로 만든 단일 맵을 넘긴다.
 */
export function computeLeftOffsets(columns: readonly JsGridTableColumn[], widthByKey: Record<string, number>) {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
        offsets[i] = acc;
        const key = String(columns[i].key ?? i);
        acc += widthByKey[key] ?? 0;
    }
    return offsets;
}

/** 고정 열 셀: border-box 기준으로 width/min/max를 동일 px로 잠근다. */
export function frozenColumnWidthCss(wPx: number): Pick<CSSProperties, "width" | "minWidth" | "maxWidth"> {
    const px = `${wPx}px`;
    return { width: px, minWidth: px, maxWidth: px };
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
        borderRight: isLastFrozen
            ? "none"
            : showBorders
              ? `1px solid ${FREEZE_HIGHLIGHT_BG}`
              : "none",
        ...(isLastFrozen ? { boxShadow: "inset -2px 0 0 #1d4ed8" } : {}),
    };
}
