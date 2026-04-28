import type {GridType, Header, HeaderState, JsGridTableColumn, Page} from "./type/Type.ts";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import ColumnFieldsMenu from "./js-grid/ColumnFieldsMenu.tsx";
import {toHeaderState, type UserColumn} from "./js-grid/columnFieldsMenuModel.ts";
import {computeLeftOffsets, getColumnFreezeStickyStyle} from "./js-grid/columnLayout.ts";
import {GRID_BORDER} from "./js-grid/gridStyles.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import Pagination from "./js-grid/Pagination.tsx";
import {useColumnWidths} from "./js-grid/useColumnWidths.ts";
import {useFreezeColumns} from "./js-grid/useFreezeColumns.ts";

const JsGrid =(props:GridType)=> {
    const data = props.data?.content ?? []
    const header = props.header;
    const headerList: Header[] = header ?? [];
    const page = {...props.data?.pageable,
        totalElements: props.data?.totalElements ?? 0,
        totalPages: props.data?.totalPages ?? 0 }

    const parseSortFromPageable = (p?: Page) => {
        const s0 = p?.sort?.[0];
        if (!s0) return { key: null as string | null, dir: 'ASC' as const };
        const parts = String(s0).split(',');
        const key = parts[0]?.trim();
        const dirRaw = (parts[1] ?? p?.sortDirection ?? 'ASC').toString().trim().toUpperCase();
        const dir = dirRaw === 'DESC' ? 'DESC' as const : 'ASC' as const;
        return { key: key || null, dir };
    };

    const [sortKey, setSortKey] = useState<string | null>(() => parseSortFromPageable(props.data?.pageable).key);
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(() => parseSortFromPageable(props.data?.pageable).dir);

    const serverSort = useMemo(() => parseSortFromPageable(props.data?.pageable), [props.data?.pageable]);
    const serverSortToken = `${serverSort.key ?? ''}\u0000${serverSort.dir}`;
    const [prevServerSortToken, setPrevServerSortToken] = useState(() => {
        const s = parseSortFromPageable(props.data?.pageable);
        return `${s.key ?? ''}\u0000${s.dir}`;
    });
    if (prevServerSortToken !== serverSortToken) {
        setPrevServerSortToken(serverSortToken);
        setSortKey(serverSort.key);
        setSortDir(serverSort.dir);
    }

    const enablePseudoFullscreen = props.enablePseudoFullscreen !== false;
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const [userColumns, setUserColumns] = useState<UserColumn[]>([]);

    const keysSig = useMemo(
        () => (header ?? []).map((h) => h.key).join('\u0001'),
        [header],
    );
    const [prevKeysSig, setPrevKeysSig] = useState<string | null>(null);
    if (prevKeysSig !== keysSig) {
        setPrevKeysSig(keysSig);
        setUserColumns((prev) => {
            const prevByKey = new Map(prev.map((c) => [c.key, c] as const));
            const next: UserColumn[] = [];
            for (const c of headerList) {
                const k = c.key;
                const existing = prevByKey.get(k);
                next.push({
                    key: k,
                    label: String(c.label ?? k),
                    visible: existing?.visible ?? true,
                });
            }
            return next;
        });
    }

    useEffect(() => {
        if (!enablePseudoFullscreen) return;
        if (!isPseudoFullscreen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsPseudoFullscreen(false);
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [enablePseudoFullscreen, isPseudoFullscreen]);

    const showDelete = Boolean(props.onDeleteClick);

    const headerWidthSig = useMemo(
        () => headerList.map((h) => `${h.key}:${h.width ?? ""}`).join("\u0001"),
        [header],
    );
    const persistedColWidths = useMemo(() => {
        const m: Record<string, number> = {};
        for (const h of headerList) {
            if (typeof h.width === "number" && h.width > 0) m[h.key] = Math.round(h.width);
        }
        return m;
    }, [headerWidthSig]);

    const columns = useMemo((): readonly JsGridTableColumn[] => {
        const list = header ?? [];
        const headerByKey = new Map(list.map((h) => [h.key, h] as const));
        const visible = userColumns
            .filter((c) => c.visible)
            .map((c) => {
                const h = headerByKey.get(c.key);
                return { key: c.key, label: c.label, render: h?.render };
            });
        const rowNum = { key: "__rownum__", label: "#", __rownum__: true as const };
        const cb = { key: "__checkbox__", label: "", __checkbox__: true as const };
        return showDelete ? [cb, rowNum, ...visible] : [rowNum, ...visible];
    }, [userColumns, showDelete, header]);

    const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);
    const [fieldsMenuPos, setFieldsMenuPos] = useState<{ top: number; right: number } | null>(null);
    const fieldsBtnRef = useRef<HTMLDivElement | null>(null);
    const dragKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isFieldsMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (fieldsBtnRef.current?.contains(target)) return;
            const menuEl = document.querySelector('[data-jsgrid-fields-menu="1"]');
            if (menuEl && menuEl.contains(target)) return;
            setIsFieldsMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFieldsMenuOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [isFieldsMenuOpen]);

    const { freezeUntilIndex, setFreezeUntilIndex } = useFreezeColumns(columns.length);
    const { headerCellRefs, colWidthByKey, measuredWidthByKey, setColumnWidth } = useColumnWidths(
        columns,
        persistedColWidths,
        headerWidthSig,
    );

    const leftOffsets = useMemo(() => computeLeftOffsets(columns, measuredWidthByKey), [columns, measuredWidthByKey]);

    const getStickyStyle = useCallback((args: { colIndex: number; isHeader: boolean }) => {
        return getColumnFreezeStickyStyle({
            colIndex: args.colIndex,
            isHeader: args.isHeader,
            freezeUntilIndex,
            leftOffsets,
        });
    }, [freezeUntilIndex, leftOffsets]);

    const totalPages = page.totalPages ?? 1;
    const currentPage0 = page.pageNumber ?? 0;

    const pageableBase: Page = useMemo(() => {
        const base = { ...(props.data?.pageable ?? {}) } as Page;
        const size = base.pageSize ?? base.size;
        const sortToken = sortKey ? `${sortKey},${sortDir.toLowerCase()}` : undefined;
        return {
            ...base,
            ...(size != null ? { pageSize: size, size } : {}),
            ...(sortToken ? { sort: [sortToken], sortDirection: sortDir } : { sort: undefined, sortDirection: undefined }),
        };
    }, [props.data?.pageable, sortKey, sortDir]);

    const emitPageable = useCallback((next: Page) => {
        props.onPageChange?.(next);
    }, [props.onPageChange]);

    const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(() => new Set());
    const [selectionAnchor, setSelectionAnchor] = useState(() => ({
        page: page.pageNumber ?? 0,
        show: Boolean(props.onDeleteClick),
    }));

    const pageRowIds = useMemo(() => {
        // 선택은 `row.id`가 없어도 동작해야 하므로, 현재 페이지의 행 인덱스를 키로 사용한다.
        return data.map((_, idx) => idx);
    }, [data]);

    const headerChecked =
        pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIndexes.has(id));

    const toggleSelectAll = useCallback(() => {
        setSelectedRowIndexes((prev) => {
            const next = new Set(prev);
            const allOn = pageRowIds.length > 0 && pageRowIds.every((id) => next.has(id));
            if (allOn) {
                for (const id of pageRowIds) next.delete(id);
            } else {
                for (const id of pageRowIds) next.add(id);
            }
            return next;
        });
    }, [pageRowIds]);

    const toggleSelectRow = useCallback((id: number) => {
        setSelectedRowIndexes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    if (selectionAnchor.page !== currentPage0 || selectionAnchor.show !== showDelete) {
        setSelectionAnchor({ page: currentPage0, show: showDelete });
        setSelectedRowIndexes(new Set());
    }

    const rowSelection = useMemo(() => {
        if (!showDelete) return undefined;
        return {
            pageRowIds,
            selectedIds: selectedRowIndexes,
            headerChecked,
            onToggleAll: toggleSelectAll,
            onToggleRow: toggleSelectRow,
        };
    }, [showDelete, pageRowIds, selectedRowIndexes, headerChecked, toggleSelectAll, toggleSelectRow]);

    return (
            <div
                ref={rootRef}
                style={{
                    border: `1px solid ${GRID_BORDER}`,
                    borderBottom: 'none',
                    width: '100%',
                    // 부모가 고정 height를 가질 때는 maxHeight:100%로 "부모 안"에 맞추고,
                    // 내부 테이블 영역(JsGridTable wrapper)이 flex:1 + overflow:auto로 스크롤을 담당한다.
                    height: 'auto',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    minHeight: 0,
                    ...(props.style ?? {}),
                    ...(isPseudoFullscreen
                        ? {
                            width: '100vw',
                            height: '100vh',
                            maxHeight: undefined,
                            position: 'fixed' as const,
                            inset: 0,
                            zIndex: 9999,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                        }
                        : null),
                }}
            >
                <JsGridToolbar
                    fieldsBtnRef={fieldsBtnRef}
                    isPseudoFullscreen={isPseudoFullscreen}
                    enablePseudoFullscreen={enablePseudoFullscreen}
                    onDownLoadClick={props.onDownloadClick}
                    onUploadClick={props.onUploadClick}
                    onCreateClick={props.onCreateClick}
                    onTrashClick={
                        props.onDeleteClick
                            ? () => {
                                const selectedRows = Array
                                    .from(selectedRowIndexes)
                                    .sort((a, b) => a - b)
                                    .map((i) => data[i])
                                    .filter((v) => v !== undefined);
                                props.onDeleteClick?.(selectedRows);
                            }
                            : undefined
                    }
                    trashDisabled={selectedRowIndexes.size === 0}
                    onToggleFieldsMenu={(e) => {
                        e.stopPropagation();
                        const rect = fieldsBtnRef.current?.getBoundingClientRect();
                        if (rect) {
                            setFieldsMenuPos({
                                top: rect.bottom + 8,
                                right: window.innerWidth - rect.right,
                            });
                        }
                        setIsFieldsMenuOpen(v => !v);
                    }}
                    onTogglePseudoFullscreen={() => setIsPseudoFullscreen(v => !v)}
                />

                <ColumnFieldsMenu
                    open={isFieldsMenuOpen}
                    pos={fieldsMenuPos}
                    userColumns={userColumns}
                    dragKeyRef={dragKeyRef}
                    onReorder={(fromKey, toKey) => {
                        setUserColumns((prev) => {
                            const fromIdx = prev.findIndex(x => x.key === fromKey);
                            const toIdx = prev.findIndex(x => x.key === toKey);
                            if (fromIdx < 0 || toIdx < 0) return prev;
                            const next = [...prev];
                            const [moved] = next.splice(fromIdx, 1);
                            next.splice(toIdx, 0, moved);
                            return next;
                        });
                    }}
                    onToggleVisible={(key, visible) => {
                        setUserColumns((prev) => prev.map(x => x.key === key ? { ...x, visible } : x));
                    }}
                    onReset={() => {
                        setUserColumns(
                            headerList.map((c) => ({
                                key: c.key,
                                label: String(c.label ?? c.key),
                                visible: true,
                            })),
                        );
                        props.onHeaderReset?.();
                    }}
                    onSave={() => {
                        const payload: HeaderState[] = toHeaderState(userColumns, colWidthByKey);
                        props.onHeaderSave?.(payload);
                        setIsFieldsMenuOpen(false);
                    }}
                />

                <JsGridTable
                    columns={columns}
                    data={data}
                    page={page}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    headerCellRefs={headerCellRefs}
                    colWidthByKey={colWidthByKey}
                    onColumnWidthChange={setColumnWidth}
                    setFreezeUntilIndex={setFreezeUntilIndex}
                    getStickyStyle={getStickyStyle}
                    rowSelection={rowSelection}
                    onRowClick={props.onRowClick}
                    onSortChange={(next) => {
                        setSortKey(next.key);
                        setSortDir(next.direction);
                        const size = pageableBase.pageSize ?? pageableBase.size;
                        emitPageable({
                            ...pageableBase,
                            pageNumber: 0,
                            ...(size != null ? { pageSize: size, size } : {}),
                            sort: [`${next.key},${next.direction.toLowerCase()}`],
                            sortDirection: next.direction,
                        });
                    }}
                />
                <div style={{ flex: "0 0 auto" , backgroundColor: "rgb(248, 248, 248)",}}>
                    <Pagination
                        page={{
                            currentPage: currentPage0,
                            totalPages,
                            totalElements: page.totalElements ?? 0,
                        }}
                        pageableBase={pageableBase}
                        onPageChange={(nextPageable) => emitPageable(nextPageable)}
                    />
                </div>
            </div>
    );
}

export default JsGrid;
