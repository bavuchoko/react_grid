import {useCallback, useLayoutEffect, useRef, useState, type MutableRefObject} from "react";
import type {JsGridTableColumn} from "../type/Type.ts";
import {COL_RESIZE_MAX_PX, COL_RESIZE_MIN_PX} from "./gridStyles.ts";

function readHeaderCellWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
): Record<string, number> {
    const next: Record<string, number> = {};
    columns.forEach((col, idx) => {
        const key = String(col.key ?? idx);
        const el = headerCellRefs.current[idx];
        const measured = el?.getBoundingClientRect().width ?? el?.offsetWidth ?? 0;
        if (measured > 0) next[key] = Math.round(measured);
    });
    return next;
}

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

/** DOM 측정값보다 사용자·저장 너비(override)를 우선한다. */
function mergeMeasuredWithOverride(
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

export function useColumnWidths(
    columns: readonly JsGridTableColumn[],
    persistedWidthByKey: Record<string, number>,
    /** `header`의 키·width 조합이 바뀌면 저장 너비를 다시 적용한다. */
    headerWidthSig: string,
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
            setMeasuredWidthByKey((prev) => (sameWidthsForColumns(prev, next, columns) ? prev : next));
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
    }, [columns, headerWidthSig, persistedWidthByKey, applyMeasured]);

    useLayoutEffect(() => {
        const ro = new ResizeObserver(() => {
            applyMeasured(readHeaderCellWidths(columns, headerCellRefs));
        });
        for (let i = 0; i < columns.length; i++) {
            const el = headerCellRefs.current[i];
            if (el) ro.observe(el);
        }
        return () => ro.disconnect();
    }, [columns, applyMeasured]);

    return {
        headerCellRefs,
        colWidthByKey: overrideWidthByKey,
        measuredWidthByKey,
        setColumnWidth,
    };
}
