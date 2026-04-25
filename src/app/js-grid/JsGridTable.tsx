import {getValue, gridRowNumericId} from "../hook/CommonMethod.ts";
import {CELL_MAX_WIDTH_PX, GRID_BORDER} from "./gridStyles.ts";
import {computeRowNumber} from "./rowNumber.ts";
import type {CSSProperties, Dispatch, MutableRefObject, SetStateAction} from "react";
import type {Page} from "../type/Type.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";

type Column = { key: string; label: string; __rownum__?: boolean; __checkbox__?: boolean };

const SORT_ICON_PX = 14;

type RowSelectionProps = {
    pageRowIds: number[];
    selectedIds: ReadonlySet<number>;
    /** 현재 페이지 행이 모두 선택된 경우에만 true (일부만 선택이면 false) */
    headerChecked: boolean;
    onToggleAll: () => void;
    onToggleRow: (id: number) => void;
};

type Props = {
    columns: readonly Column[];
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
};

export default function JsGridTable(props: Props) {
    return (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: 'max-content', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{background:'#f8f8f8'}}>
                    <tr>
                        {props.columns.map((column, cdex) => {
                            const isRowNum = Boolean(column.__rownum__);
                            const isCheckbox = Boolean(column.__checkbox__);
                            return (
                                <th
                                    key={String(column.key ?? cdex)}
                                    ref={(el) => { props.headerCellRefs.current[cdex] = el; }}
                                    onClick={(e) => {
                                        if (e.altKey) {
                                            props.setFreezeUntilIndex((prev) => (prev === cdex ? null : cdex));
                                            return;
                                        }
                                        if (isCheckbox) {
                                            if (e.target instanceof HTMLInputElement) return;
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
                                        background: '#f8f8f8',
                                        borderBottom: `1px solid ${GRID_BORDER}`,
                                        borderRight: `1px solid ${GRID_BORDER}`,
                                        minWidth: isCheckbox ? '40px' : isRowNum ? '56px' : '80px',
                                        maxWidth: isCheckbox || isRowNum ? undefined : CELL_MAX_WIDTH_PX,
                                        width: props.colWidthByKey[String(column.key ?? cdex)]
                                            ? `${props.colWidthByKey[String(column.key ?? cdex)]}px`
                                            : undefined,
                                        boxSizing: 'border-box',
                                        cursor: isCheckbox ? 'pointer' : isRowNum ? 'default' : 'pointer',
                                        userSelect: 'none',
                                        textAlign: 'center',
                                        paddingRight: isRowNum ? 10 : undefined,
                                        overflow: isCheckbox || isRowNum ? undefined : 'hidden',
                                        textOverflow: isCheckbox || isRowNum ? undefined : 'ellipsis',
                                        whiteSpace: isCheckbox || isRowNum ? undefined : 'nowrap',
                                        ...props.getStickyStyle({ colIndex: cdex, isHeader: true }),
                                    }}
                                >
                                    {isCheckbox && props.rowSelection ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={props.rowSelection.headerChecked}
                                                disabled={props.rowSelection.pageRowIds.length === 0}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    props.rowSelection?.onToggleAll();
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',paddingLeft:6, paddingRight:6, gap:2 }}>
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
                                            style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minWidth: 0,
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
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {props.data.map((row, rdex) => {
                        const rowId = gridRowNumericId(row);
                        return (
                        <tr key={rowId ?? `r-${rdex}`} className={`border`}>
                            {props.columns.map((column, cdex) => {
                                const isRowNum = Boolean(column.__rownum__);
                                const isCheckbox = Boolean(column.__checkbox__);
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
                                    : getValue(row, column.key);
                                return (
                                    <td
                                        key={String(column.key ?? cdex)}
                                        className={`border h-[30px]`}
                                        style={{
                                            borderBottom: `1px solid ${GRID_BORDER}`,
                                            borderRight: `1px solid ${GRID_BORDER}`,
                                            width: props.colWidthByKey[String(column.key ?? cdex)]
                                                ? `${props.colWidthByKey[String(column.key ?? cdex)]}px`
                                                : undefined,
                                            minWidth: isCheckbox ? '40px' : isRowNum ? '56px' : undefined,
                                            maxWidth: isCheckbox || isRowNum ? undefined : CELL_MAX_WIDTH_PX,
                                            boxSizing: 'border-box',
                                            whiteSpace: 'nowrap',
                                            overflow: isCheckbox || isRowNum ? undefined : 'hidden',
                                            textOverflow: isCheckbox || isRowNum ? undefined : 'ellipsis',
                                            textAlign: isCheckbox ? 'center' : isRowNum ? 'right' : undefined,
                                            paddingRight: isCheckbox ? undefined : 14,
                                            paddingLeft: isCheckbox ? undefined : isRowNum ? undefined : 14,
                                            ...props.getStickyStyle({ colIndex: cdex, isHeader: false }),
                                        }}
                                    >
                                        {isCheckbox && props.rowSelection ? (
                                            <input
                                                type="checkbox"
                                                disabled={rowId == null}
                                                checked={rowId != null && props.rowSelection.selectedIds.has(rowId)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    if (rowId != null) props.rowSelection?.onToggleRow(rowId);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            value as any
                                        )}
                                    </td>
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
