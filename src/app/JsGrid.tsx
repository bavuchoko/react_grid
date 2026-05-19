import type {GridType, Header, HeaderState, JsGridTableColumn, Page} from "./type/Type.ts";
import {useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from "react";
import ColumnFieldsMenu from "./js-grid/ColumnFieldsMenu.tsx";
import {toHeaderState, type UserColumn} from "./js-grid/columnFieldsMenuModel.ts";
import {
    buildColumnLayoutWidths,
    captureColumnLayoutWidths,
    computeLeftOffsets,
    getColumnFreezeStickyStyle,
} from "./js-grid/columnLayout.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import Pagination from "./js-grid/Pagination.tsx";
import { DEFAULT_EXCEL_UPLOAD_ACCEPT } from "./js-grid/excelUploadConstraints.ts";
import UploadFilePanel from "./js-grid/UploadFilePanel.tsx";
import {useColumnWidths} from "./js-grid/useColumnWidths.ts";
import {useFreezeColumns} from "./js-grid/useFreezeColumns.ts";
import {gridThemeContainerBorder, resolveJsGridTheme} from "./js-grid/gridTheme.ts";
import "./js-grid/js-grid-layout.css";

function headerSaveErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message.trim()) return err.message;
    const o = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
    if (o && "response" in o && typeof o.response === "object" && o.response !== null) {
        const rd = (o.response as Record<string, unknown>).data;
        if (typeof rd === "string" && rd.trim()) return rd;
        if (rd && typeof rd === "object") {
            const m = (rd as Record<string, unknown>).message;
            if (typeof m === "string" && m.trim()) return m;
        }
    }
    return "컬럼 저장에 실패했습니다.";
}

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
    const deleteSpinClass = useId().replace(/:/g, "");
    const [deleteBusy, setDeleteBusy] = useState(false);

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
                return { key: c.key, label: c.label, type: h?.type, render: h?.render };
            });
        const rowNum = { key: "__rownum__", label: "#", __rownum__: true as const };
        const cb = { key: "__checkbox__", label: "", __checkbox__: true as const };
        return showDelete ? [cb, rowNum, ...visible] : [rowNum, ...visible];
    }, [userColumns, showDelete, header]);

    const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);
    const [fieldsSaveBusy, setFieldsSaveBusy] = useState(false);
    const [fieldsSaveError, setFieldsSaveError] = useState<string | null>(null);
    const fieldsSaveBusyRef = useRef(fieldsSaveBusy);
    fieldsSaveBusyRef.current = fieldsSaveBusy;

    useEffect(() => {
        if (isFieldsMenuOpen) setFieldsSaveError(null);
    }, [isFieldsMenuOpen]);

    const [fieldsMenuPos, setFieldsMenuPos] = useState<{ top: number; right: number } | null>(null);
    const fieldsBtnRef = useRef<HTMLDivElement | null>(null);
    const dragKeyRef = useRef<string | null>(null);
    const uploadBtnRef = useRef<HTMLDivElement | null>(null);

    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [uploadPanelPos, setUploadPanelPos] = useState<{ top: number; right: number } | null>(null);
    const [uploadPanelBusy, setUploadPanelBusy] = useState(false);

    const toggleUploadPanel = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        if (uploadPanelBusy) return;
        setIsFieldsMenuOpen(false);
        const rect = uploadBtnRef.current?.getBoundingClientRect();
        if (rect) {
            setUploadPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        setIsUploadPanelOpen((v) => !v);
    }, [uploadPanelBusy]);

    const handleUploadConfirm = useCallback(
        (files: File[]) => Promise.resolve(props.onUploadFiles?.(files)),
        [props.onUploadFiles],
    );

    useEffect(() => {
        if (!isFieldsMenuOpen) return;

        const onDown = (e: MouseEvent) => {
            if (fieldsSaveBusyRef.current) return;
            const target = e.target as Node | null;
            if (!target) return;
            if (fieldsBtnRef.current?.contains(target)) return;
            const menuEl = document.querySelector('[data-jsgrid-fields-menu="1"]');
            if (menuEl && menuEl.contains(target)) return;
            setIsFieldsMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (fieldsSaveBusyRef.current) return;
                setIsFieldsMenuOpen(false);
            }
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [isFieldsMenuOpen]);

    useEffect(() => {
        if (!isUploadPanelOpen) return;
        const onDown = (e: MouseEvent) => {
            if (uploadPanelBusy) return;

            const target = e.target as Node | null;
            if (!target) return;

            if (uploadBtnRef.current?.contains(target)) return;
            const panelEl = document.querySelector('[data-jsgrid-upload-panel="1"]');
            if (panelEl && panelEl.contains(target)) return;
            setIsUploadPanelOpen(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (uploadPanelBusy) return;
            if (e.key === "Escape") setIsUploadPanelOpen(false);
        };

        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };

    }, [isUploadPanelOpen, uploadPanelBusy]);

    const { freezeUntilIndex, setFreezeUntilIndex } = useFreezeColumns(columns.length);
    const freezeActive = freezeUntilIndex != null;
    const { headerCellRefs, colWidthByKey, measuredWidthByKey, setColumnWidth } = useColumnWidths(
        columns,
        persistedColWidths,
        headerWidthSig,
        freezeActive,
    );

    /** 틀 고정 중에는 스크롤 시 DOM 측정이 흔들려 `left`·폭이 깨지므로, 고정 시점 너비를 스냅샷한다. */
    const [frozenLayoutWidths, setFrozenLayoutWidths] = useState<Record<string, number> | null>(null);

    useLayoutEffect(() => {
        if (!freezeActive) {
            setFrozenLayoutWidths(null);
            return;
        }
        setFrozenLayoutWidths(captureColumnLayoutWidths(columns, headerCellRefs, colWidthByKey));
    }, [freezeActive, freezeUntilIndex, columns, colWidthByKey, headerWidthSig]);

    const layoutWidths = useMemo(
        () =>
            freezeUntilIndex != null && frozenLayoutWidths
                ? frozenLayoutWidths
                : buildColumnLayoutWidths(columns, measuredWidthByKey, colWidthByKey),
        [freezeUntilIndex, frozenLayoutWidths, columns, measuredWidthByKey, colWidthByKey],
    );

    const leftOffsets = useMemo(
        () => computeLeftOffsets(columns, layoutWidths),
        [columns, layoutWidths],
    );

    const getStickyStyle = useCallback((args: { colIndex: number; isHeader: boolean }) => {
        const col = columns[args.colIndex];
        const colKey = String(col?.key ?? args.colIndex);
        const frozenWidthPx = freezeActive ? layoutWidths[colKey] : undefined;
        return getColumnFreezeStickyStyle({
            colIndex: args.colIndex,
            isHeader: args.isHeader,
            freezeUntilIndex,
            leftOffsets,
            theme: props.theme,
            frozenWidthPx,
        });
    }, [freezeActive, freezeUntilIndex, leftOffsets, layoutWidths, columns, props.theme]);

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

    const handleDeleteSelected = useCallback(async () => {
        if (deleteBusy) return;
        if (!props.onDeleteClick) return;
        const selectedRows = Array
            .from(selectedRowIndexes)
            .sort((a, b) => a - b)
            .map((i) => data[i])
            .filter((v) => v !== undefined);
        if (selectedRows.length === 0) return;

        setDeleteBusy(true);
        try {
            await Promise.resolve(props.onDeleteClick(selectedRows));
            setSelectedRowIndexes(new Set());
        } finally {
            setDeleteBusy(false);
        }
    }, [deleteBusy, props.onDeleteClick, selectedRowIndexes, data]);

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

    const gridTheme = resolveJsGridTheme(props.theme);

    return (
            <div
                className={`js-grid-container js-grid-theme-${gridTheme}`}
                ref={rootRef}
                style={{
                    ...gridThemeContainerBorder(props.theme),
                    width: '100%',
                    // 부모가 높이를 주면(또는 flex 컬럼에서 flex:1) 전체 높이를 채운다.
                    height: '100%',
                    flex: '1 1 0%',
                    alignSelf: 'stretch',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
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
                <style>{`
                    @keyframes jsgrid-delete-spin-${deleteSpinClass} {
                        to { transform: rotate(360deg); }
                    }
                    .jsgrid-delete-spin-dot-${deleteSpinClass} {
                        animation: jsgrid-delete-spin-${deleteSpinClass} 0.75s linear infinite;
                    }
                `}</style>
                <JsGridToolbar
                    theme={props.theme}
                    fieldsBtnRef={fieldsBtnRef}
                    showColumnFieldsMenu={Boolean(props.onHeaderSave)}
                    isPseudoFullscreen={isPseudoFullscreen}
                    enablePseudoFullscreen={enablePseudoFullscreen}
                    onDownLoadClick={props.onDownloadClick}
                    uploadBtnRef={props.onUploadFiles ? uploadBtnRef : undefined}
                    onToggleUploadPanel={props.onUploadFiles ? toggleUploadPanel : undefined}
                    uploadBusy={props.onUploadFiles ? uploadPanelBusy : undefined}
                    onCreateClick={props.onCreateClick}
                    onTrashClick={props.onDeleteClick ? handleDeleteSelected : undefined}
                    trashBusy={deleteBusy}
                    trashDisabled={selectedRowIndexes.size === 0 || deleteBusy}
                    onToggleFieldsMenu={(e) => {
                        e.stopPropagation();
                        if (!props.onHeaderSave) return;
                        if (uploadPanelBusy || fieldsSaveBusy) return;
                        setIsUploadPanelOpen(false);
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

                {props.onUploadFiles ? (
                    <UploadFilePanel
                        open={isUploadPanelOpen}
                        pos={uploadPanelPos}
                        accept={props.uploadAccept ?? DEFAULT_EXCEL_UPLOAD_ACCEPT}
                        multiple={props.uploadMultiple ?? false}
                        onBusyChange={setUploadPanelBusy}
                        onUploadConfirm={handleUploadConfirm}
                        onClose={() => setIsUploadPanelOpen(false)}
                    />
                ) : null}

                <ColumnFieldsMenu
                    open={isFieldsMenuOpen}
                    pos={fieldsMenuPos}
                    userColumns={userColumns}
                    dragKeyRef={dragKeyRef}
                    saveBusy={fieldsSaveBusy}
                    saveError={fieldsSaveError}
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
                    onReset={
                        props.onHeaderReset
                            ? () => {
                                setFieldsSaveError(null);
                                setUserColumns(
                                    headerList.map((c) => ({
                                        key: c.key,
                                        label: String(c.label ?? c.key),
                                        visible: true,
                                    })),
                                );
                                props.onHeaderReset?.();
                            }
                            : undefined
                    }
                    onSave={async () => {
                        const payload: HeaderState[] = toHeaderState(userColumns, colWidthByKey);
                        if (!props.onHeaderSave) {
                            setIsFieldsMenuOpen(false);
                            return;
                        }
                        setFieldsSaveError(null);
                        setFieldsSaveBusy(true);
                        try {
                            await props.onHeaderSave(payload);
                            setIsFieldsMenuOpen(false);
                        } catch (err) {
                            setFieldsSaveError(headerSaveErrorMessage(err));
                        } finally {
                            setFieldsSaveBusy(false);
                        }
                    }}
                />

                <div
                    style={{
                        flex: "1 1 0%",
                        minHeight: 0,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            flex: "1 1 0%",
                            minHeight: 0,
                            minWidth: 0,
                            width: "100%",
                            filter: deleteBusy ? "blur(2px)" : undefined,
                            pointerEvents: deleteBusy ? "none" : undefined,
                            transition: "filter 120ms ease",
                        }}
                    >
                        <JsGridTable
                            theme={props.theme}
                            columns={columns}
                            data={data}
                            page={page}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            headerCellRefs={headerCellRefs}
                            colWidthByKey={colWidthByKey}
                            layoutWidthByKey={layoutWidths}
                            freezeUntilIndex={freezeUntilIndex}
                            onColumnWidthChange={props.resizable ? setColumnWidth : undefined}
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
                        <div style={{ flex: "0 0 auto", flexShrink: 0, backgroundColor: gridTheme === "linear" ? "#ffffff" : "rgb(248, 248, 248)" }}>
                            <Pagination
                                theme={props.theme}
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
                    {deleteBusy ? (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(255,255,255,0.35)",
                                zIndex: 3,
                                pointerEvents: "none",
                            }}
                        >
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    background: "rgba(255,255,255,0.9)",
                                    border: "1px solid #d1d5db",
                                    color: "#111827",
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                <span
                                    className={`jsgrid-delete-spin-dot-${deleteSpinClass}`}
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: "50%",
                                        border: "2px solid #e5e7eb",
                                        borderTopColor: "#ef4444",
                                        boxSizing: "border-box",
                                    }}
                                    aria-hidden
                                />
                                삭제 중...
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
    );
}

export default JsGrid;
