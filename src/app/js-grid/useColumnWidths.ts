import {useLayoutEffect, useRef, useState} from "react";

export function useColumnWidths(columns: readonly unknown[]) {
    const headerCellRefs = useRef<Array<HTMLTableCellElement | null>>([]);
    const [colWidthByKey, setColWidthByKey] = useState<Record<string, number>>({});

    useLayoutEffect(() => {
        const id = requestAnimationFrame(() => {
            setColWidthByKey((prev) => {
                const next = { ...prev };
                columns.forEach((col, idx) => {
                    const key = String((col as any).key ?? idx);
                    const w = headerCellRefs.current[idx]?.offsetWidth ?? 0;
                    if (w > 0) next[key] = w;
                });
                return next;
            });
        });
        return () => cancelAnimationFrame(id);
    }, [columns]);

    return { headerCellRefs, colWidthByKey };
}
