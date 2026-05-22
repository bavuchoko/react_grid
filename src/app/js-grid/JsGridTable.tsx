import {
    getValue,
    gridRowNumericId,
    formatCellDisplayValue,
    resolveChildrenCellValue,
} from "../hook/CommonMethod.ts";
import {
    CELL_MAX_WIDTH_PX,
    COL_RESIZE_MAX_PX,
    COL_RESIZE_MIN_PX,
    GRID_SORT_ICON_SLOT_PX,
    LINEAR_CELL_PADDING_X,
} from "./gridStyles.ts";
import {computeRowNumber} from "./rowNumber.ts";
import type {CSSProperties, MutableRefObject, ReactNode} from "react";
import React, {isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {
    GridCellChangeEvent,
    GridCellPasteBatch,
    GridCellPasteItem,
    JsGridTableColumn,
    Page,
} from "../type/Type.ts";
import {renderGridCellEditor} from "./renderGridCellEditor.tsx";
import {
    groupPasteItemsIntoBatches,
    isCellInRange,
    normalizeCellRange,
    parseClipboardLines,
    pasteLineForRowIndex,
    resolveRowId,
    type GridCellRange,
} from "./gridCellSelection.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";
import {gridThemeCellBorders, gridThemeStyles, resolveJsGridTheme, type JsGridTheme} from "./gridTheme.ts";

export type {JsGridTableColumn} from "../type/Type.ts";

const SORT_ICON_PX = GRID_SORT_ICON_SLOT_PX;

type CellEditorSession = {
    rowIndex: number;
    columnKey: string;
};

function colWidthCss(wPx: number | null | undefined): CSSProperties {
    if (wPx == null || wPx <= 0) return {};
    const px = `${wPx}px`;
    return {
        ["--js-grid-col-width" as string]: px,
        width: "var(--js-grid-col-width)",
        maxWidth: "var(--js-grid-col-width)",
        minWidth: `${COL_RESIZE_MIN_PX}px`,
    };
}

function gridColClassNames(
    cdex: number,
    column: Pick<JsGridTableColumn, "__checkbox__" | "__rownum__">,
    role: "th" | "td",
): string {
    const parts = [
        role === "th" ? "js-grid-th" : "js-grid-row",
        "js-grid-cell",
        "js-grid-col",
        `js-grid-col-${cdex}`,
    ];
    if (column.__checkbox__) parts.push("js-grid-chk");
    if (column.__rownum__) parts.push("js-grid-idx");
    return parts.join(" ");
}

type TruncatingTdProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
    children: ReactNode;
};

/** 말줄임이 실제로 일어난 경우에만 `title`로 전체 텍스트(호버 툴팁)를 붙인다. */
function TruncatingTd({
    children,
    style,
    skipResizeObserve,
    ...rest
}: TruncatingTdProps & { skipResizeObserve?: boolean }) {
    const ref = useRef<HTMLTableCellElement>(null);
    const [title, setTitle] = useState<string | undefined>(undefined);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) {
            setTitle(undefined);
            return;
        }
        const truncated = el.scrollWidth > el.clientWidth + 1;
        if (truncated) {
            const raw = el.innerText.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
            setTitle(raw.length > 0 ? raw : undefined);
        } else {
            setTitle(undefined);
        }
    }, []);

    useLayoutEffect(() => {
        measure();
        if (skipResizeObserve) return undefined;
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => {
            measure();
        });
        ro.observe(el);
        return () => {
            ro.disconnect();
        };
    }, [measure, children, skipResizeObserve]);

    return (
        <td ref={ref} {...rest} style={style} title={title}>
            {children}
        </td>
    );
}

function HeaderColumnResizeHandle({
    minPx,
    maxPx,
    onResize,
    showGrip,
}: {
    minPx: number;
    maxPx: number;
    onResize: (widthPx: number) => void;
    /** `linear` 등 border 없는 테마에서 열 경계 `|` 표시 */
    showGrip?: boolean;
}) {
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.currentTarget as HTMLDivElement).closest("th");
        const startX = e.clientX;
        const startW = th?.getBoundingClientRect().width ?? minPx;
        const move = (ev: PointerEvent) => {
            const raw = startW + (ev.clientX - startX);
            onResize(Math.round(Math.max(minPx, Math.min(maxPx, raw))));
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };
    return (
        <div
            className="js-grid-col-resize"
            data-jsgrid-col-resize="1"
            role="separator"
            aria-orientation="vertical"
            aria-label="컬럼 너비 조절"
            onPointerDown={onPointerDown}
            style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: showGrip ? 10 : 6,
                cursor: "col-resize",
                zIndex: 8,
                touchAction: "none",
                marginRight: -1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {showGrip ? (
                <span className="js-grid-col-resize-grip" aria-hidden>
                    |
                </span>
            ) : null}
        </div>
    );
}

type RowSelectionProps = {
    /** 현재 페이지 각 행의 선택 키(행 `id` 등) */
    pageRowKeys: readonly string[];
    selectedKeys: ReadonlySet<string>;
    /** 현재 페이지 행이 모두 선택된 경우에만 true (일부만 선택이면 false) */
    headerChecked: boolean;
    onToggleAll: () => void;
    onToggleRow: (key: string) => void;
};

type Props = {
    columns: readonly JsGridTableColumn[];
    data: unknown[];
    page: Page;
    sortKey: string | null;
    /** 미지정·ASC는 ASC 아이콘, DESC만 DESC 아이콘 */
    sortDir?: 'ASC' | 'DESC';
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>;
    colWidthByKey: Record<string, number>;
    freezeUntilIndex: number | null;
    onFreezeColumn: (colIndex: number) => void;
    getStickyStyle: (args: { colIndex: number; isHeader: boolean }) => CSSProperties | undefined;
    onSortChange: (next: { key: string; direction: 'ASC' | 'DESC' }) => void;
    rowSelection?: RowSelectionProps;
    onRowClick?: (row: unknown) => void;
    onCellChange?: (event: GridCellChangeEvent) => void | Promise<void>;
    onCellsPaste?: (batches: GridCellPasteBatch[]) => void | Promise<void>;
    rowIdKey?: string;
    onColumnWidthChange?: (columnKey: string, widthPx: number) => void;
    theme?: JsGridTheme | string;
    /** `true`일 때 셀 선택·재클릭 편집·세로 드래그·붙여넣기 */
    editable?: boolean;
};

type DragState = {
    active: boolean;
    columnKey: string;
    anchorRow: number;
    currentRow: number;
    moved: boolean;
};

function resolveBodyCellValue(
    row: unknown,
    column: JsGridTableColumn,
    rdex: number,
    page: Page,
    dataLength: number,
): unknown {
    if (column.__checkbox__) return null;
    if (column.__rownum__) {
        return computeRowNumber({
            pageNumber: page.pageNumber,
            pageSize: page.size,
            pageSizeAlt: page.pageSize,
            totalElements: page.totalElements,
            rowIndexOnPage: rdex,
            fallbackPageSize: dataLength,
        });
    }
    if (column.type === "children") return resolveChildrenCellValue(row, column.key);
    return getValue(row, column.key);
}

export default function JsGridTable(props: Props) {
    const themeStyles = gridThemeStyles(props.theme);
    const isLinear = resolveJsGridTheme(props.theme) === "linear";
    const cellBorders = gridThemeCellBorders(props.theme);
    const bodyCellBorderClass = isLinear ? "" : "border";
    const isEmpty = props.data.length === 0;
    const colCount = props.columns.length;
    const freezeActive = props.freezeUntilIndex != null;
    const editingEnabled = props.editable === true;
    const rowIdKey = props.rowIdKey ?? "id";
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const [editorSession, setEditorSession] = useState<CellEditorSession | null>(null);
    const [cellRange, setCellRange] = useState<GridCellRange | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const lastClickRef = useRef<{ rowIndex: number; columnKey: string } | null>(null);

    useEffect(() => {
        if (!editingEnabled) {
            setEditorSession(null);
            setCellRange(null);
            dragStateRef.current = null;
            lastClickRef.current = null;
        }
    }, [editingEnabled]);

    const closeEditor = useCallback(() => setEditorSession(null), []);

    const isBodyCellSelectable = useCallback(
        (column: JsGridTableColumn) =>
            editingEnabled && !column.__checkbox__ && !column.__rownum__,
        [editingEnabled],
    );

    useEffect(() => {
        if (!editorSession) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest(".js-grid-cell-editing")) return;
            closeEditor();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeEditor();
        };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [editorSession, closeEditor]);

    const handleEditorChange = useCallback(
        (nextValue: unknown, options?: { close?: boolean }) => {
            if (!editorSession) return;
            const editorColumn = props.columns.find((c) => c.key === editorSession.columnKey);
            if (!editorColumn) return;
            const row = props.data[editorSession.rowIndex];
            if (row === undefined) return;
            const previousValue = resolveBodyCellValue(
                row,
                editorColumn,
                editorSession.rowIndex,
                props.page,
                props.data.length,
            );
            props.onCellChange?.({
                row,
                rowIndex: editorSession.rowIndex,
                columnKey: editorColumn.key,
                value: nextValue,
                previousValue,
            });
            if (options?.close) closeEditor();
        },
        [editorSession, props.columns, props.data, props.page, props.onCellChange, closeEditor],
    );

    const openCellEditor = useCallback(
        (args: { rowIndex: number; columnKey: string }) => {
            if (!editingEnabled) return;
            const col = props.columns.find((c) => c.key === args.columnKey);
            if (!col?.editor) return;
            setEditorSession(args);
        },
        [editingEnabled, props.columns],
    );

    const finishDragClick = useCallback(
        (rowIndex: number, columnKey: string, hasEditor: boolean) => {
            const drag = dragStateRef.current;
            dragStateRef.current = null;
            if (!drag?.active) return;

            if (!drag.moved) {
                const prev = lastClickRef.current;
                if (
                    prev
                    && prev.rowIndex === rowIndex
                    && prev.columnKey === columnKey
                    && hasEditor
                ) {
                    lastClickRef.current = null;
                    openCellEditor({ rowIndex, columnKey });
                    return;
                }
                lastClickRef.current = { rowIndex, columnKey };
            } else {
                lastClickRef.current = null;
            }
        },
        [openCellEditor],
    );

    const resolveBodyCellFromPoint = useCallback(
        (clientX: number, clientY: number): { rowIndex: number; columnKey: string } | null => {
            const el = document.elementFromPoint(clientX, clientY);
            const td = el?.closest<HTMLTableCellElement>("[data-jsgrid-body-cell]");
            if (!td) return null;
            const rowIndex = Number(td.dataset.jsgridRow);
            const columnKey = td.dataset.jsgridCol;
            if (!Number.isFinite(rowIndex) || !columnKey) return null;
            return { rowIndex, columnKey };
        },
        [],
    );

    useEffect(() => {
        if (!editingEnabled) return;

        const endDrag = (releaseRow: number, columnKey: string) => {
            const col = props.columns.find((c) => c.key === columnKey);
            finishDragClick(releaseRow, columnKey, Boolean(col?.editor));
        };

        const onPointerMove = (e: PointerEvent) => {
            const drag = dragStateRef.current;
            if (!drag?.active) return;
            const hit = resolveBodyCellFromPoint(e.clientX, e.clientY);
            if (!hit || hit.columnKey !== drag.columnKey) return;
            if (hit.rowIndex !== drag.currentRow) {
                drag.currentRow = hit.rowIndex;
                if (hit.rowIndex !== drag.anchorRow) drag.moved = true;
                setCellRange(
                    normalizeCellRange(drag.columnKey, drag.anchorRow, hit.rowIndex),
                );
            }
        };

        const onPointerUp = () => {
            const drag = dragStateRef.current;
            if (!drag?.active) return;
            endDrag(drag.currentRow, drag.columnKey);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [editingEnabled, finishDragClick, props.columns, resolveBodyCellFromPoint]);

    const buildPasteItems = useCallback(
        (range: GridCellRange, lines: string[]): GridCellPasteItem[] => {
            const column = props.columns.find((c) => c.key === range.columnKey);
            if (!column) return [];
            const items: GridCellPasteItem[] = [];
            const rowCount = range.rowEnd - range.rowStart + 1;
            for (let i = 0; i < rowCount; i++) {
                const rowIndex = range.rowStart + i;
                const row = props.data[rowIndex];
                if (row === undefined) continue;
                const line = pasteLineForRowIndex(lines, i);
                const previousValue = resolveBodyCellValue(
                    row,
                    column,
                    rowIndex,
                    props.page,
                    props.data.length,
                );
                items.push({
                    row,
                    rowId: resolveRowId(row, rowIdKey),
                    columnKey: range.columnKey,
                    rowIndex,
                    value: line,
                    previousValue,
                });
            }
            return items;
        },
        [props.columns, props.data, props.page, rowIdKey],
    );

    useEffect(() => {
        if (!editingEnabled) return;
        const root = tableScrollRef.current;
        if (!root) return;

        const onCopy = (e: ClipboardEvent) => {
            if (!cellRange) return;
            const column = props.columns.find((c) => c.key === cellRange.columnKey);
            if (!column) return;
            const lines: string[] = [];
            for (let r = cellRange.rowStart; r <= cellRange.rowEnd; r++) {
                const row = props.data[r];
                if (row === undefined) continue;
                const value = resolveBodyCellValue(
                    row,
                    column,
                    r,
                    props.page,
                    props.data.length,
                );
                lines.push(formatCellDisplayValue(value));
            }
            if (lines.length === 0) return;
            e.preventDefault();
            e.clipboardData?.setData("text/plain", lines.join("\n"));
        };

        const onPaste = (e: ClipboardEvent) => {
            if (!cellRange || !props.onCellsPaste) return;
            const column = props.columns.find((c) => c.key === cellRange.columnKey);
            if (!column || column.__checkbox__ || column.__rownum__) return;
            if (!root.contains(document.activeElement) && document.activeElement !== document.body) {
                const sel = document.getSelection();
                if (sel && sel.anchorNode && !root.contains(sel.anchorNode)) return;
            }
            e.preventDefault();
            const text = e.clipboardData?.getData("text/plain") ?? "";
            const lines = parseClipboardLines(text);
            const items = buildPasteItems(cellRange, lines);
            const batches = groupPasteItemsIntoBatches(items);
            if (batches.length > 0) void Promise.resolve(props.onCellsPaste(batches));
        };

        root.addEventListener("copy", onCopy);
        root.addEventListener("paste", onPaste);
        return () => {
            root.removeEventListener("copy", onCopy);
            root.removeEventListener("paste", onPaste);
        };
    }, [
        editingEnabled,
        cellRange,
        props.columns,
        props.data,
        props.page,
        props.onCellsPaste,
        buildPasteItems,
    ]);

    useEffect(() => {
        if (!editingEnabled) return;
        const onDown = (e: MouseEvent) => {
            const root = tableScrollRef.current;
            if (!root?.contains(e.target as Node)) {
                setCellRange(null);
                lastClickRef.current = null;
            }
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [editingEnabled]);

    return (
        <div
            className="js-grid-table-scroll"
            ref={tableScrollRef}
            tabIndex={editingEnabled ? -1 : undefined}
        >
            <table
                className="js-grid-table"
                style={{
                    width: isEmpty ? '100%' : 'max-content',
                    minWidth: isEmpty ? '100%' : undefined,
                }}
            >
                <thead style={{backgroundColor: themeStyles.headerBg}}>
                    <tr className="js-grid-head-row">
                        {props.columns.map((column, cdex) => {
                            const isRowNum = Boolean(column.__rownum__);
                            const isCheckbox = Boolean(column.__checkbox__);
                            const colKey = String(column.key ?? cdex);
                            const wPx = props.colWidthByKey[colKey];
                            const hasW = wPx != null && wPx > 0;
                            const isDataCol = !isCheckbox && !isRowNum;
                            /** `header.width`/측정 전: CSS `max-content`로 라벨이 잘리지 않게 한 뒤 DOM에서 px 확정 */
                            const intrinsicLabelCol = isDataCol && !hasW && !freezeActive;
                            return (
                                <th
                                    key={colKey}
                                    className={gridColClassNames(cdex, column, "th")}
                                    ref={(el) => { props.headerCellRefs.current[cdex] = el; }}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest("[data-jsgrid-col-resize=\"1\"]")) return;
                                        if (e.altKey) {
                                            props.onFreezeColumn(cdex);
                                            return;
                                        }
                                        if (isCheckbox) {
                                            props.rowSelection?.onToggleAll();
                                            return;
                                        }
                                        if (isRowNum) return;
                                        const same = props.sortKey === column.key;
                                        const nextDir: 'ASC' | 'DESC' = same
                                            ? (props.sortDir === 'DESC' ? 'ASC' : 'DESC')
                                            : 'ASC';
                                        props.onSortChange({ key: column.key, direction: nextDir });
                                    }}
                                    style={{
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 4,
                                        backgroundColor: themeStyles.headerBg,
                                        ...cellBorders,
                                        boxSizing: 'border-box',
                                        cursor: isCheckbox ? 'pointer' : isRowNum ? 'default' : 'pointer',
                                        userSelect: 'none',
                                        textAlign: isCheckbox || isRowNum ? 'center' : isLinear ? 'left' : 'center',
                                        paddingRight: isRowNum ? 10 : undefined,
                                        paddingLeft:
                                            isLinear && !isCheckbox && !isRowNum
                                                ? LINEAR_CELL_PADDING_X
                                                : undefined,
                                        ...(hasW
                                            ? colWidthCss(wPx)
                                            : isCheckbox || isRowNum
                                              ? {
                                                  minWidth: isCheckbox ? '40px' : '56px',
                                                }
                                              : {
                                                  minWidth: COL_RESIZE_MIN_PX,
                                                  maxWidth: CELL_MAX_WIDTH_PX,
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                              }),
                                        ...(isCheckbox || isRowNum
                                            ? {}
                                            : hasW
                                              ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                                              : {}),
                                        ...props.getStickyStyle({ colIndex: cdex, isHeader: true }),
                                    }}
                                >
                                    {isCheckbox && props.rowSelection ? (
                                        <div className="js-grid-cell-inner" style={{ justifyContent: 'center' }}>
                                            <input
                                                type="checkbox"
                                                className="js-grid-chk-box"
                                                checked={props.rowSelection.headerChecked}
                                                disabled={props.rowSelection.pageRowKeys.length === 0}
                                                readOnly
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        </div>
                                    ) : (
                                    <div
                                        className="js-grid-cell-inner"
                                        style={{
                                            justifyContent: isRowNum ? 'center' : isLinear ? 'flex-start' : 'center',
                                            paddingLeft: isLinear ? 0 : undefined,
                                            paddingRight: isLinear ? 6 : undefined,
                                            gap: 2,
                                        }}
                                    >
                                        {/* basic: 오른쪽 sort 아이콘과 대칭되는 왼쪽 빈 칸 → 제목 가운데 정렬 */}
                                        {!isRowNum && !isLinear && (
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    flexShrink: 0,
                                                    width: SORT_ICON_PX,
                                                    minWidth: SORT_ICON_PX,
                                                    height: SORT_ICON_PX,
                                                }}
                                                aria-hidden
                                            />
                                        )}
                                        <span
                                            style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minWidth: 0,
                                                flex: intrinsicLabelCol ? '1 1 auto' : undefined,
                                            }}
                                        >
                                            {column.label}
                                        </span>
                                        {!isRowNum && (
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    flexShrink: 0,
                                                    width: SORT_ICON_PX,
                                                    minWidth: SORT_ICON_PX,
                                                    height: SORT_ICON_PX,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                                aria-hidden={props.sortKey !== column.key}
                                            >
                                                {props.sortKey === column.key &&
                                                    (props.sortDir === 'DESC' ? (
                                                        <span
                                                            style={{ display: 'inline-flex', flex: '0 0 auto' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                props.onSortChange({ key: column.key, direction: 'ASC' });
                                                            }}
                                                        >
                                                            <DESC
                                                                style={{
                                                                    width: SORT_ICON_PX,
                                                                    height: SORT_ICON_PX,
                                                                    cursor: 'pointer',
                                                                    color: '#111827',
                                                                }}
                                                            />
                                                        </span>
                                                    ) : (
                                                        <span
                                                            style={{ display: 'inline-flex', flex: '0 0 auto' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                props.onSortChange({ key: column.key, direction: 'DESC' });
                                                            }}
                                                        >
                                                            <ASC
                                                                style={{
                                                                    width: SORT_ICON_PX,
                                                                    height: SORT_ICON_PX,
                                                                    cursor: 'pointer',
                                                                    color: '#111827',
                                                                }}
                                                            />
                                                        </span>
                                                    ))}
                                            </span>
                                        )}
                                    </div>
                                    )}
                                    {!isCheckbox && !isRowNum && props.onColumnWidthChange ? (
                                        <HeaderColumnResizeHandle
                                            minPx={COL_RESIZE_MIN_PX}
                                            maxPx={COL_RESIZE_MAX_PX}
                                            showGrip={isLinear}
                                            onResize={(w) => props.onColumnWidthChange?.(column.key, w)}
                                        />
                                    ) : null}
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {isEmpty ? (
                        <tr className="js-grid-empty-row">
                            <td
                                colSpan={colCount > 0 ? colCount : 1}
                                className="js-grid-empty"
                            >
                                <div
                                    className="js-grid-empty-message"
                                    style={{
                                        padding: '48px 16px',
                                        textAlign: 'center',
                                        color: '#6b7280',
                                        fontSize: 14,
                                        userSelect: 'none',
                                    }}
                                >
                                    데이터가 없습니다
                                </div>
                            </td>
                        </tr>
                    ) : null}
                    {!isEmpty && props.data.map((row, rdex) => {
                        const rowId = gridRowNumericId(row);
                        const rowClass = isLinear ? "js-grid-body-row" : "border js-grid-body-row";
                        const rowStripeClass =
                            isLinear && themeStyles.bodyRowStripeBg && rdex % 2 === 0
                                ? " js-grid-row-stripe"
                                : "";
                        return (
                        <tr
                            key={rowId ?? `r-${rdex}`}
                            className={
                                rowId != null
                                    ? `${rowClass}${rowStripeClass} js-grid-row-idx-${rdex} js-grid-row-id-${rowId}`
                                    : `${rowClass}${rowStripeClass} js-grid-row-idx-${rdex}`
                            }
                            onClick={
                                props.onRowClick
                                    ? () => props.onRowClick?.(row)
                                    : undefined
                            }
                            style={{
                                cursor: props.onRowClick ? 'pointer' : undefined,
                                ...(isLinear && themeStyles.bodyRowStripeBg && rdex % 2 === 0
                                    ? { backgroundColor: themeStyles.bodyRowStripeBg }
                                    : undefined),
                            }}
                        >
                            {props.columns.map((column, cdex) => {
                                const isRowNum = Boolean(column.__rownum__);
                                const isCheckbox = Boolean(column.__checkbox__);
                                const colKey = String(column.key ?? cdex);
                                const wPx = props.colWidthByKey[colKey];
                                const hasW = wPx != null && wPx > 0;
                                const value = resolveBodyCellValue(
                                    row,
                                    column,
                                    rdex,
                                    props.page,
                                    props.data.length,
                                );
                                const selectable = isBodyCellSelectable(column);
                                const hasEditor = selectable && Boolean(column.editor);
                                const isSelected = isCellInRange(cellRange, rdex, column.key);

                                const stopRowClick = (e: unknown) => {
                                    if (e && typeof e === "object" && "stopPropagation" in e) {
                                        (e as React.SyntheticEvent).stopPropagation();
                                    }
                                };

                                const rendered = !isCheckbox && !isRowNum && column.render
                                    ? (typeof column.render === 'function'
                                        ? column.render({ row, value, columnKey: column.key, rowIndex: rdex, stopRowClick })
                                        : (isValidElement(column.render)
                                            ? React.cloneElement(column.render as any, { row, value, columnKey: column.key, rowIndex: rdex, stopRowClick })
                                            : column.render))
                                    : null;

                                const tdStyle: CSSProperties = {
                                    ...cellBorders,
                                    ...(hasW
                                        ? colWidthCss(wPx)
                                        : isCheckbox || isRowNum
                                          ? { minWidth: isCheckbox ? '40px' : '56px' }
                                          : {
                                              minWidth: COL_RESIZE_MIN_PX,
                                              maxWidth: CELL_MAX_WIDTH_PX,
                                          }),
                                    boxSizing: 'border-box',
                                    whiteSpace: 'nowrap',
                                    overflow: isCheckbox || isRowNum ? undefined : 'hidden',
                                    textOverflow: isCheckbox || isRowNum ? undefined : 'ellipsis',
                                    textAlign: isCheckbox ? 'center' : isRowNum ? 'right' : undefined,
                                    paddingRight: isCheckbox ? undefined : LINEAR_CELL_PADDING_X,
                                    paddingLeft: isCheckbox
                                        ? undefined
                                        : isRowNum
                                          ? undefined
                                          : LINEAR_CELL_PADDING_X,
                                    cursor: isCheckbox && props.rowSelection ? 'pointer' : undefined,
                                    ...props.getStickyStyle({ colIndex: cdex, isHeader: false }),
                                };

                                const onTdPointerDown = (
                                    e: React.PointerEvent<HTMLTableCellElement>,
                                ) => {
                                    if (isCheckbox) {
                                        e.stopPropagation();
                                        if (!props.rowSelection) return;
                                        props.rowSelection.onToggleRow(
                                            props.rowSelection.pageRowKeys[rdex] ?? String(rdex),
                                        );
                                        return;
                                    }
                                    if (!selectable) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                        editorSession
                                        && (editorSession.rowIndex !== rdex
                                            || editorSession.columnKey !== column.key)
                                    ) {
                                        closeEditor();
                                    }
                                    dragStateRef.current = {
                                        active: true,
                                        columnKey: column.key,
                                        anchorRow: rdex,
                                        currentRow: rdex,
                                        moved: false,
                                    };
                                    setCellRange(
                                        normalizeCellRange(column.key, rdex, rdex),
                                    );
                                    tableScrollRef.current?.focus({ preventScroll: true });
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                };

                                const onTdClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
                                    if (selectable || column.render) {
                                        e.stopPropagation();
                                    }
                                };

                                const cellText = rendered ?? formatCellDisplayValue(value);
                                const isEditing =
                                    editorSession?.rowIndex === rdex
                                    && editorSession?.columnKey === column.key
                                    && hasEditor;

                                const tdChildren = isCheckbox && props.rowSelection ? (
                                    <input
                                        type="checkbox"
                                        className="js-grid-chk-box"
                                        checked={props.rowSelection.selectedKeys.has(
                                            props.rowSelection.pageRowKeys[rdex] ?? "",
                                        )}
                                        readOnly
                                        style={{ pointerEvents: 'none' }}
                                    />
                                ) : isEditing && column.editor ? (
                                    <div className="js-grid-cell-inner js-grid-cell-inner--editing">
                                        {renderGridCellEditor(column.editor, {
                                            row,
                                            value,
                                            columnKey: column.key,
                                            rowIndex: rdex,
                                            onChange: handleEditorChange,
                                            onClose: closeEditor,
                                            stopRowClick,
                                        })}
                                    </div>
                                ) : (
                                    <div className="js-grid-cell-inner">{cellText}</div>
                                );

                                const editingClass = isEditing ? " js-grid-cell-editing" : "";
                                const selectedClass = isSelected ? " js-grid-cell-selected" : "";

                                const bodyCellDataAttrs = selectable
                                    ? {
                                          "data-jsgrid-body-cell": "1",
                                          "data-jsgrid-row": String(rdex),
                                          "data-jsgrid-col": column.key,
                                      }
                                    : undefined;

                                return isCheckbox || isRowNum ? (
                                    <td
                                        key={colKey}
                                        className={`${bodyCellBorderClass} ${gridColClassNames(cdex, column, "td")}`}
                                        onPointerDown={onTdPointerDown}
                                        onClick={onTdClick}
                                        style={tdStyle}
                                    >
                                        {tdChildren}
                                    </td>
                                ) : (
                                    <TruncatingTd
                                        key={colKey}
                                        className={`${bodyCellBorderClass} ${gridColClassNames(cdex, column, "td")}${selectable ? " js-grid-cell-selectable" : ""}${hasEditor ? " js-grid-cell-editable" : ""}${selectedClass}${editingClass}`}
                                        {...bodyCellDataAttrs}
                                        onPointerDown={onTdPointerDown}
                                        onClick={onTdClick}
                                        style={tdStyle}
                                        skipResizeObserve={
                                            isEditing
                                            || (freezeActive
                                                && props.freezeUntilIndex != null
                                                && cdex <= props.freezeUntilIndex)
                                        }
                                    >
                                        {tdChildren}
                                    </TruncatingTd>
                                );
                            })}
                        </tr>
                    );
                    })}
                </tbody>
            </table>
        </div>
    );
}
