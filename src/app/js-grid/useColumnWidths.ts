import {useCallback, useLayoutEffect, useRef, useState} from "react";
import type {JsGridTableColumn} from "../type/Type.ts";
import {COL_RESIZE_MAX_PX, COL_RESIZE_MIN_PX} from "./gridStyles.ts";
import {
    mergeMeasuredWithOverride,
    readHeaderCellWidths,
} from "./columnLayout.ts";

/** 스크롤·sticky 합성 시 1px 단위 ResizeObserver 노이즈 무시 */
const MEASURED_WIDTH_CHANGE_THRESHOLD_PX = 2;

function sameWidthsForColumns(
    a: Record<string, number>,
    b: Record<string, number>,
    columns: readonly JsGridTableColumn[],
): boolean {
    for (let i = 0; i < columns.length; i++) {
        const key = String(columns[i].key ?? i);
        if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
    }
    return true;
}

function widthsChangedBeyondThreshold(
    prev: Record<string, number>,
    next: Record<string, number>,
    columns: readonly JsGridTableColumn[],
    thresholdPx: number,
): boolean {
    for (let i = 0; i < columns.length; i++) {
        const key = String(columns[i].key ?? i);
        if (Math.abs((prev[key] ?? 0) - (next[key] ?? 0)) > thresholdPx) return true;
    }
    return false;
}

export function useColumnWidths(
    columns: readonly JsGridTableColumn[],
    persistedWidthByKey: Record<string, number>,
    /** `header`의 키·width 조합이 바뀌면 저장 너비를 다시 적용한다. */
    headerWidthSig: string,
    /** 틀 고정 중에는 DOM 재측정을 멈춘다(스크롤 시 1px 흔들림 방지). */
    pauseMeasure = false,
) {
    const headerCellRefs = useRef<Array<HTMLTableCellElement | null>>([]);
    const [measuredWidthByKey, setMeasuredWidthByKey] = useState<Record<string, number>>({});
    const [overrideWidthByKey, setOverrideWidthByKey] = useState<Record<string, number>>({});
    const overrideWidthRef = useRef(overrideWidthByKey);
    overrideWidthRef.current = overrideWidthByKey;
    const prevSigRef = useRef<string | null>(null);

    const applyMeasured = useCallback(
        (raw: Record<string, number>) => {
            const next = mergeMeasuredWithOverride(raw, overrideWidthRef.current, columns);
            setMeasuredWidthByKey((prev) => {
                if (sameWidthsForColumns(prev, next, columns)) return prev;
                if (
                    Object.keys(prev).length > 0 &&
                    !widthsChangedBeyondThreshold(prev, next, columns, MEASURED_WIDTH_CHANGE_THRESHOLD_PX)
                ) {
                    return prev;
                }
                return next;
            });
        },
        [columns],
    );

    const setColumnWidth = useCallback((columnKey: string, widthPx: number) => {
        const w = Math.round(Math.max(COL_RESIZE_MIN_PX, Math.min(COL_RESIZE_MAX_PX, widthPx)));
        setOverrideWidthByKey((prev) => {
            const next = { ...prev, [columnKey]: w };
            overrideWidthRef.current = next;
            setMeasuredWidthByKey((prevM) => {
                const merged = mergeMeasuredWithOverride(prevM, next, columns);
                return sameWidthsForColumns(prevM, merged, columns) ? prevM : merged;
            });
            return next;
        });
    }, [columns]);

    useLayoutEffect(() => {
        if (pauseMeasure) return;
        const id = requestAnimationFrame(() => {
            const sigChanged = prevSigRef.current !== headerWidthSig;
            prevSigRef.current = headerWidthSig;

            if (sigChanged) {
                const nextOverride = { ...persistedWidthByKey };
                overrideWidthRef.current = nextOverride;
                setOverrideWidthByKey(nextOverride);
            } else {
                setOverrideWidthByKey((prev) => {
                    const next = { ...prev };
                    for (const [k, v] of Object.entries(persistedWidthByKey)) {
                        if (!(k in next) && v > 0) next[k] = v;
                    }
                    overrideWidthRef.current = next;
                    return next;
                });
            }

            applyMeasured(readHeaderCellWidths(columns, headerCellRefs));
        });
        return () => cancelAnimationFrame(id);
    }, [columns, headerWidthSig, persistedWidthByKey, applyMeasured, pauseMeasure]);

    useLayoutEffect(() => {
        if (pauseMeasure) return;
        const ro = new ResizeObserver(() => {
            applyMeasured(readHeaderCellWidths(columns, headerCellRefs));
        });
        for (let i = 0; i < columns.length; i++) {
            const el = headerCellRefs.current[i];
            if (el) ro.observe(el);
        }
        return () => ro.disconnect();
    }, [columns, applyMeasured, pauseMeasure]);

    return {
        headerCellRefs,
        colWidthByKey: overrideWidthByKey,
        measuredWidthByKey,
        setColumnWidth,
    };
}
