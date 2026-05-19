import {getValue, gridRowNumericId, formatCellDisplayValue, resolveChildrenCellValue} from "../hook/CommonMethod.ts";
import {
    CELL_MAX_WIDTH_PX,
    COL_RESIZE_MAX_PX,
    COL_RESIZE_MIN_PX,
    GRID_SORT_ICON_SLOT_PX,
    LINEAR_CELL_INNER_GAP,
    LINEAR_CELL_PADDING_X,
} from "./gridStyles.ts";
import {computeRowNumber} from "./rowNumber.ts";
import type {CSSProperties, Dispatch, MutableRefObject, ReactNode, SetStateAction} from "react";
import React, {isValidElement, useCallback, useLayoutEffect, useRef, useState} from "react";
import type {JsGridTableColumn, Page} from "../type/Type.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";
import {gridThemeCellBorders, gridThemeStyles, resolveJsGridTheme, type JsGridTheme} from "./gridTheme.ts";

export type {JsGridTableColumn} from "../type/Type.ts";

const SORT_ICON_PX = GRID_SORT_ICON_SLOT_PX;

function gridColClassNames(
    cdex: number,
    column: Pick<JsGridTableColumn, "__checkbox__" | "__rownum__">,
    role: "th" | "td",
): string {
    const parts = [
        role === "th" ? "js-grid-th" : "js-grid-row",
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
function TruncatingTd({ children, style, ...rest }: TruncatingTdProps) {
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
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => {
            measure();
        });
        ro.observe(el);
        return () => {
            ro.disconnect();
        };
    }, [measure, children]);

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
}: {
    minPx: number;
    maxPx: number;
    onResize: (widthPx: number) => void;
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
                width: 6,
                cursor: "col-resize",
                zIndex: 8,
                touchAction: "none",
                marginRight: -1,
            }}
        />
    );
}

type RowSelectionProps = {
    pageRowIds: number[];
    selectedIds: ReadonlySet<number>;
    /** 현재 페이지 행이 모두 선택된 경우에만 true (일부만 선택이면 false) */
    headerChecked: boolean;
    onToggleAll: () => void;
    onToggleRow: (id: number) => void;
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
    setFreezeUntilIndex: Dispatch<SetStateAction<number | null>>;
    getStickyStyle: (args: { colIndex: number; isHeader: boolean }) => CSSProperties | undefined;
    onSortChange: (next: { key: string; direction: 'ASC' | 'DESC' }) => void;
    rowSelection?: RowSelectionProps;
    onRowClick?: (row: unknown) => void;
    onColumnWidthChange?: (columnKey: string, widthPx: number) => void;
    theme?: JsGridTheme | string;
};

export default function JsGridTable(props: Props) {
    const themeStyles = gridThemeStyles(props.theme);
    const isLinear = resolveJsGridTheme(props.theme) === "linear";
    const cellBorders = gridThemeCellBorders(props.theme);
    const bodyCellClass = isLinear ? "h-[30px]" : "border h-[30px]";
    const isEmpty = props.data.length === 0;
    const colCount = props.columns.length;

    return (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: '1 1 0%', minHeight: 0 }}>
            <table
                style={{
                    width: isEmpty ? '100%' : 'max-content',
                    minWidth: isEmpty ? '100%' : undefined,
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                }}
            >
                <thead style={{backgroundColor: themeStyles.headerBg}}>
                    <tr className="js-grid-head-row">
                        {props.columns.map((column, cdex) => {
                            const isRowNum = Boolean(column.__rownum__);
                            const isCheckbox = Boolean(column.__checkbox__);
                            const colKey = String(column.key ?? cdex);
                            const wPx = props.colWidthByKey[colKey];
                            const isDataCol = !isCheckbox && !isRowNum;
                            const hasW = wPx != null && wPx > 0;
                            /** `header.width`/측정 전: CSS `max-content`로 라벨이 잘리지 않게 한 뒤 DOM에서 px 확정 */
                            const intrinsicLabelCol = isDataCol && !hasW;
                            return (
                                <th
                                    key={colKey}
                                    className={gridColClassNames(cdex, column, "th")}
                                    ref={(el) => { props.headerCellRefs.current[cdex] = el; }}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest("[data-jsgrid-col-resize=\"1\"]")) return;
                                        if (e.altKey) {
                                            props.setFreezeUntilIndex((prev) => (prev === cdex ? null : cdex));
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
                                        ...(intrinsicLabelCol
                                            ? {
                                                minWidth: 'max-content',
                                                maxWidth: 'none',
                                                width: undefined,
                                                overflow: 'visible',
                                                textOverflow: 'clip',
                                                whiteSpace: 'nowrap',
                                            }
                                            : {
                                                minWidth: isCheckbox ? '40px' : isRowNum ? '56px' : '80px',
                                                maxWidth:
                                                    isCheckbox || isRowNum
                                                        ? undefined
                                                        : hasW
                                                          ? wPx
                                                          : CELL_MAX_WIDTH_PX,
                                                width: hasW ? `${wPx}px` : undefined,
                                                overflow: isCheckbox || isRowNum ? undefined : 'hidden',
                                                textOverflow: isCheckbox || isRowNum ? undefined : 'ellipsis',
                                                whiteSpace: isCheckbox || isRowNum ? undefined : 'nowrap',
                                            }),
                                        ...props.getStickyStyle({ colIndex: cdex, isHeader: true }),
                                    }}
                                >
                                    {isCheckbox && props.rowSelection ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <input
                                                type="checkbox"
                                                className="js-grid-chk-box"
                                                checked={props.rowSelection.headerChecked}
                                                disabled={props.rowSelection.pageRowIds.length === 0}
                                                readOnly
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        </div>
                                    ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: isRowNum ? 'center' : isLinear ? 'flex-start' : 'center',
                                            paddingLeft: isLinear ? 0 : 6,
                                            paddingRight: 6,
                                            gap: 2,
                                            width: isLinear && !isRowNum ? '100%' : undefined,
                                        }}
                                    >
                                        {!isRowNum && (
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
                                            style={
                                                intrinsicLabelCol
                                                    ? {
                                                        whiteSpace: 'nowrap',
                                                        flex: '0 0 auto',
                                                        flexShrink: 0,
                                                        minWidth: 'max-content',
                                                        width: 'max-content',
                                                        overflow: 'visible',
                                                    }
                                                    : {
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        minWidth: 0,
                                                    }
                                            }
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
                        return (
                        <tr
                            key={rowId ?? `r-${rdex}`}
                            className={
                                rowId != null
                                    ? `${rowClass} js-grid-row-idx-${rdex} js-grid-row-id-${rowId}`
                                    : `${rowClass} js-grid-row-idx-${rdex}`
                            }
                            onClick={() => props.onRowClick?.(row)}
                            style={{ cursor: props.onRowClick ? 'pointer' : undefined }}
                        >
                            {props.columns.map((column, cdex) => {
                                const isRowNum = Boolean(column.__rownum__);
                                const isCheckbox = Boolean(column.__checkbox__);
                                const colKey = String(column.key ?? cdex);
                                const wPx = props.colWidthByKey[colKey];
                                const isDataCol = !isCheckbox && !isRowNum;
                                const hasW = wPx != null && wPx > 0;
                                const intrinsicDataCol = isDataCol && !hasW;
                                const value = isCheckbox
                                    ? null
                                    : column.__rownum__
                                    ? computeRowNumber({
                                        pageNumber: props.page.pageNumber,
                                        pageSize: props.page.size,
                                        pageSizeAlt: props.page.pageSize,
                                        totalElements: props.page.totalElements,
                                        rowIndexOnPage: rdex,
                                        fallbackPageSize: props.data.length,
                                    })
                                    : column.type === "children"
                                      ? resolveChildrenCellValue(row, column.key)
                                      : getValue(row, column.key);

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

                                const rowStripe =
                                    isLinear && themeStyles.bodyRowStripeBg && rdex % 2 === 0
                                        ? { backgroundColor: themeStyles.bodyRowStripeBg }
                                        : undefined;

                                const tdStyle: CSSProperties = {
                                    ...rowStripe,
                                    ...cellBorders,
                                    width: wPx != null && wPx > 0 ? `${wPx}px` : undefined,
                                    minWidth: isCheckbox ? '40px' : isRowNum ? '56px' : undefined,
                                    maxWidth:
                                        isCheckbox || isRowNum
                                            ? undefined
                                            : intrinsicDataCol
                                              ? undefined
                                              : hasW && wPx != null
                                                ? wPx
                                                : CELL_MAX_WIDTH_PX,
                                    boxSizing: 'border-box',
                                    whiteSpace: 'nowrap',
                                    overflow:
                                        intrinsicDataCol
                                            ? 'visible'
                                            : isCheckbox || isRowNum
                                              ? undefined
                                              : 'hidden',
                                    textOverflow:
                                        intrinsicDataCol ? 'clip' : isCheckbox || isRowNum ? undefined : 'ellipsis',
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

                                const onTdClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
                                    if (isCheckbox) {
                                        e.stopPropagation();
                                        if (!props.rowSelection) return;
                                        props.rowSelection.onToggleRow(rdex);
                                        return;
                                    }
                                    if (column.render) {
                                        e.stopPropagation();
                                    }
                                };

                                const cellText = rendered ?? formatCellDisplayValue(value);

                                const tdChildren = isCheckbox && props.rowSelection ? (
                                    <input
                                        type="checkbox"
                                        className="js-grid-chk-box"
                                        checked={props.rowSelection.selectedIds.has(rdex)}
                                        readOnly
                                        style={{ pointerEvents: 'none' }}
                                    />
                                ) : isLinear && isDataCol ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: LINEAR_CELL_INNER_GAP,
                                            minWidth: 0,
                                            width: '100%',
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                flexShrink: 0,
                                                width: SORT_ICON_PX,
                                                minWidth: SORT_ICON_PX,
                                                height: 1,
                                            }}
                                            aria-hidden
                                        />
                                        <span
                                            style={{
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                flex: '1 1 auto',
                                            }}
                                        >
                                            {cellText}
                                        </span>
                                    </div>
                                ) : (
                                    cellText
                                );

                                return isCheckbox || isRowNum ? (
                                    <td
                                        key={colKey}
                                        className={`${bodyCellClass} ${gridColClassNames(cdex, column, "td")}`}
                                        onClick={onTdClick}
                                        style={tdStyle}
                                    >
                                        {tdChildren}
                                    </td>
                                ) : (
                                    <TruncatingTd
                                        key={colKey}
                                        className={`${bodyCellClass} ${gridColClassNames(cdex, column, "td")}`}
                                        onClick={onTdClick}
                                        style={tdStyle}
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
