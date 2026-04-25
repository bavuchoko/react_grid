import type {GridType, HeaderState, Page} from "./type/Type.ts";
import {gridRowNumericId} from "./hook/CommonMethod.ts";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import ColumnFieldsMenu, {toHeaderState, type UserColumn} from "./js-grid/ColumnFieldsMenu.tsx";
import {computeLeftOffsets, getColumnFreezeStickyStyle} from "./js-grid/columnLayout.ts";
import {GRID_BORDER} from "./js-grid/gridStyles.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import Pagination from "./js-grid/Pagination.tsx";
import {useColumnWidths} from "./js-grid/useColumnWidths.ts";
import {useFreezeColumns} from "./js-grid/useFreezeColumns.ts";

const JsGrid =(props:GridType)=> {
    const data = props.data?.content ?? []
    const keys = props?.header ?? []
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

    useEffect(() => {
        const next = parseSortFromPageable(props.data?.pageable);
        setSortKey(next.key);
        setSortDir(next.dir);
    }, [props.data?.pageable]);

    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const [userColumns, setUserColumns] = useState<UserColumn[]>([]);

    useEffect(() => {
        // props.header 변경 시: 기존 설정(visible/order)을 최대한 유지
        setUserColumns((prev) => {
            const prevByKey = new Map(prev.map(c => [c.key, c] as const));
            const next: UserColumn[] = [];
            for (const c of (keys as any[])) {
                const k = String((c as any).key);
                const existing = prevByKey.get(k);
                next.push({
                    key: k,
                    label: String((c as any).label ?? k),
                    visible: existing?.visible ?? true,
                });
            }
            return next;
        });
    }, [keys]);

    useEffect(() => {
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
    }, [isPseudoFullscreen]);

    const showDelete = Boolean(props.onDelete);

    const columns = useMemo(() => {
        const visible = userColumns.filter(c => c.visible).map(c => ({ key: c.key, label: c.label }));
        const rowNum = { key: "__rownum__", label: "#", __rownum__: true as const };
        const cb = { key: "__checkbox__", label: "", __checkbox__: true as const };
        return (showDelete ? [cb, rowNum, ...visible] : [rowNum, ...visible]) as readonly { key: string; label: string; __rownum__?: boolean; __checkbox__?: boolean }[];
    }, [userColumns, showDelete]);

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
    const { headerCellRefs, colWidthByKey } = useColumnWidths(columns);

    const leftOffsets = useMemo(() => computeLeftOffsets(columns, colWidthByKey), [columns, colWidthByKey]);

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

    const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(() => new Set());

    const pageRowIds = useMemo(() => {
        const ids: number[] = [];
        for (const row of data) {
            const id = gridRowNumericId(row);
            if (id != null) ids.push(id);
        }
        return ids;
    }, [data]);

    const headerChecked =
        pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIds.has(id));

    const toggleSelectAll = useCallback(() => {
        setSelectedRowIds((prev) => {
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
        setSelectedRowIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    useEffect(() => {
        setSelectedRowIds(new Set());
    }, [currentPage0, showDelete]);

    const rowSelection = useMemo(() => {
        if (!showDelete) return undefined;
        return {
            pageRowIds,
            selectedIds: selectedRowIds,
            headerChecked,
            onToggleAll: toggleSelectAll,
            onToggleRow: toggleSelectRow,
        };
    }, [showDelete, pageRowIds, selectedRowIds, headerChecked, toggleSelectAll, toggleSelectRow]);

    return (
            <div
                ref={rootRef}
                style={{
                    border: `1px solid ${GRID_BORDER}`,
                    borderBottom: 'none',
                    width: isPseudoFullscreen ? '100vw' : '100%',
                    // 부모가 고정 height를 가질 때는 maxHeight:100%로 "부모 안"에 맞추고,
                    // 내부 테이블 영역(JsGridTable wrapper)이 flex:1 + overflow:auto로 스크롤을 담당한다.
                    height: isPseudoFullscreen ? '100vh' : 'auto',
                    maxHeight: isPseudoFullscreen ? undefined : '100%',
                    overflow: 'hidden',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    minHeight: 0,
                    position: isPseudoFullscreen ? 'fixed' : undefined,
                    inset: isPseudoFullscreen ? 0 : undefined,
                    zIndex: isPseudoFullscreen ? 9999 : undefined,
                    boxShadow: isPseudoFullscreen ? '0 10px 30px rgba(0,0,0,0.18)' : undefined,
                }}
            >
                <JsGridToolbar
                    fieldsBtnRef={fieldsBtnRef}
                    isPseudoFullscreen={isPseudoFullscreen}
                    onExport={props.onExport}
                    onCreate={props.onCreate}
                    onTrash={
                        props.onDelete
                            ? () => props.onDelete?.(Array.from(selectedRowIds))
                            : undefined
                    }
                    trashDisabled={selectedRowIds.size === 0}
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
                        setUserColumns((keys as any[]).map((c) => ({
                            key: String((c as any).key),
                            label: String((c as any).label ?? (c as any).key),
                            visible: true,
                        })));
                    }}
                    onSave={() => {
                        const payload: HeaderState[] = toHeaderState(userColumns);
                        props.onSave?.(payload);
                        setIsFieldsMenuOpen(false);
                    }}
                />

                <JsGridTable
                    columns={columns as any}
                    data={data}
                    page={page}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    headerCellRefs={headerCellRefs}
                    colWidthByKey={colWidthByKey}
                    setFreezeUntilIndex={setFreezeUntilIndex}
                    getStickyStyle={getStickyStyle}
                    rowSelection={rowSelection}
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
                <div style={{ flex: "0 0 auto" }}>
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
