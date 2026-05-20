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
import React, {isValidElement, useCallback, useLayoutEffect, useRef, useState} from "react";
import type {JsGridTableColumn, Page} from "../type/Type.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";
import {gridThemeCellBorders, gridThemeStyles, resolveJsGridTheme, type JsGridTheme} from "./gridTheme.ts";

export type {JsGridTableColumn} from "../type/Type.ts";

const SORT_ICON_PX = GRID_SORT_ICON_SLOT_PX;

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
    freezeUntilIndex: number | null;
    onFreezeColumn: (colIndex: number) => void;
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
    const bodyCellBorderClass = isLinear ? "" : "border";
    const isEmpty = props.data.length === 0;
    const colCount = props.columns.length;
    const freezeActive = props.freezeUntilIndex != null;

    return (
        <div className="js-grid-table-scroll">
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
                                                disabled={props.rowSelection.pageRowIds.length === 0}
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
                                const hasW = wPx != null && wPx > 0;
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
                                ) : (
                                    <div className="js-grid-cell-inner">{cellText}</div>
                                );

                                return isCheckbox || isRowNum ? (
                                    <td
                                        key={colKey}
                                        className={`${bodyCellBorderClass} ${gridColClassNames(cdex, column, "td")}`}
                                        onClick={onTdClick}
                                        style={tdStyle}
                                    >
                                        {tdChildren}
                                    </td>
                                ) : (
                                    <TruncatingTd
                                        key={colKey}
                                        className={`${bodyCellBorderClass} ${gridColClassNames(cdex, column, "td")}`}
                                        onClick={onTdClick}
                                        style={tdStyle}
                                        skipResizeObserve={
                                            freezeActive &&
                                            props.freezeUntilIndex != null &&
                                            cdex <= props.freezeUntilIndex
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
