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
        // offsetWidth: 스크롤·sticky 합성 시 getBoundingClientRect()보다 흔들림이 적다.
        const measured = el?.offsetWidth ?? 0;
        if (measured > 0) next[key] = Math.round(measured);
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

export function captureColumnLayoutWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
    overrideByKey: Record<string, number>,
): Record<string, number> {
    return mergeMeasuredWithOverride(
        readHeaderCellWidths(columns, headerCellRefs),
        overrideByKey,
        columns,
    );
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

/** 고정 열: 스크롤 중에도 px 폭이 흔들리지 않도록 width/min/max를 동일하게 고정한다. */
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
    /** 틀 고정 스냅샷 너비(px). 있으면 셀 폭을 고정한다. */
    frozenWidthPx?: number;
}) {
    const { colIndex, isHeader, freezeUntilIndex, leftOffsets, theme, frozenWidthPx } = args;
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
        ...(frozenWidthPx != null && frozenWidthPx > 0 ? frozenColumnWidthCss(frozenWidthPx) : {}),
    };
}
