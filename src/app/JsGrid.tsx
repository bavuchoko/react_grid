import type {
    GridType,
    Header,
    HeaderState,
    JsGridTableColumn,
    JsGridToolbarSlot,
    Page,
} from "./type/Type.ts";
import {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import { JsGridToolbarProvider } from "./js-grid/JsGridToolbarContext.tsx";
import {
    JsGridRowSelectionProvider,
    type JsGridRowSelectionApi,
} from "./js-grid/JsGridRowSelectionContext.tsx";
import ColumnFieldsMenu from "./js-grid/ColumnFieldsMenu.tsx";
import {toHeaderState, type UserColumn} from "./js-grid/columnFieldsMenuModel.ts";
import {
    buildColumnLayoutWidths,
    captureColumnLayoutWidths,
    computeLeftOffsets,
    getColumnFreezeStickyStyle,
} from "./js-grid/columnLayout.ts";
import {
    buildRowSelectionDataSignature,
    resolveRowSelectionKey,
    type RowSelectionKey,
} from "./js-grid/rowSelection.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import Pagination from "./js-grid/Pagination.tsx";
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
    const gridOverlaySpinClass = useId().replace(/:/g, "");
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

    const showRowSelection = props.enableRowSelection === true;

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
                return {
                    key: c.key,
                    label: c.label,
                    type: h?.type,
                    render: h?.render,
                    editor: h?.editor,
                };
            });
        const rowNum = { key: "__rownum__", label: "#", __rownum__: true as const };
        const cb = { key: "__checkbox__", label: "", __checkbox__: true as const };
        return showRowSelection ? [cb, rowNum, ...visible] : [rowNum, ...visible];
    }, [userColumns, showRowSelection, header]);

    const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);
    const [fieldsSaveBusy, setFieldsSaveBusy] = useState(false);
    const [fieldsResetBusy, setFieldsResetBusy] = useState(false);
    const [fieldsSaveError, setFieldsSaveError] = useState<string | null>(null);
    const fieldsActionBusy = fieldsSaveBusy || fieldsResetBusy;
    const fieldsActionBusyRef = useRef(false);
    fieldsActionBusyRef.current = fieldsActionBusy;

    useEffect(() => {
        if (isFieldsMenuOpen) setFieldsSaveError(null);
    }, [isFieldsMenuOpen]);

    const [fieldsMenuPos, setFieldsMenuPos] = useState<{ top: number; right: number } | null>(null);
    const fieldsBtnRef = useRef<HTMLDivElement | null>(null);
    const dragKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isFieldsMenuOpen) return;

        const onDown = (e: MouseEvent) => {
            if (fieldsActionBusyRef.current) return;
            const target = e.target as Node | null;
            if (!target) return;
            if (fieldsBtnRef.current?.contains(target)) return;
            const menuEl = document.querySelector('[data-jsgrid-fields-menu="1"]');
            if (menuEl && menuEl.contains(target)) return;
            setIsFieldsMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (fieldsActionBusyRef.current) return;
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

    const { freezeUntilIndex, setFreezeUntilIndex } = useFreezeColumns(columns.length);
    const freezeActive = freezeUntilIndex != null;
    const { headerCellRefs, colWidthByKey, measuredWidthByKey, setColumnWidth } = useColumnWidths(
        columns,
        persistedColWidths,
        headerWidthSig,
        freezeActive,
    );

    /** 틀 고정 `sticky left` 합산용. 셀 width CSS는 건드리지 않고 클릭 직전 DOM만 스냅샷한다. */
    const [frozenLayoutWidths, setFrozenLayoutWidths] = useState<Record<string, number> | null>(null);

    const handleFreezeColumn = useCallback(
        (colIndex: number) => {
            if (freezeUntilIndex === colIndex) {
                setFreezeUntilIndex(null);
                setFrozenLayoutWidths(null);
                return;
            }
            setFrozenLayoutWidths(captureColumnLayoutWidths(columns, headerCellRefs));
            setFreezeUntilIndex(colIndex);
        },
        [freezeUntilIndex, columns, headerCellRefs, setFreezeUntilIndex],
    );

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
        return getColumnFreezeStickyStyle({
            colIndex: args.colIndex,
            isHeader: args.isHeader,
            freezeUntilIndex,
            leftOffsets,
            theme: props.theme,
        });
    }, [freezeUntilIndex, leftOffsets, props.theme]);

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

    const rowSelectionIdKey = props.rowSelectionIdKey ?? "id";
    const getRowSelectionId = props.getRowSelectionId;

    const resolveKey = useCallback(
        (row: unknown, rowIndex: number) =>
            resolveRowSelectionKey({
                row,
                rowIndex,
                pageNumber: currentPage0,
                idKey: rowSelectionIdKey,
                getRowSelectionId,
            }),
        [currentPage0, rowSelectionIdKey, getRowSelectionId],
    );

    const [selectedKeys, setSelectedKeys] = useState<Set<RowSelectionKey>>(() => new Set());
    const [selectionAnchor, setSelectionAnchor] = useState(() => ({
        page: page.pageNumber ?? 0,
        show: showRowSelection,
    }));

    const dataSelectionSignature = useMemo(
        () =>
            buildRowSelectionDataSignature({
                data,
                pageNumber: currentPage0,
                totalElements: page.totalElements,
                totalPages: page.totalPages,
                idKey: rowSelectionIdKey,
                getRowSelectionId,
            }),
        [
            data,
            currentPage0,
            page.totalElements,
            page.totalPages,
            rowSelectionIdKey,
            getRowSelectionId,
        ],
    );

    const [prevDataSelectionSignature, setPrevDataSelectionSignature] = useState(
        () => dataSelectionSignature,
    );
    if (prevDataSelectionSignature !== dataSelectionSignature) {
        setPrevDataSelectionSignature(dataSelectionSignature);
        setSelectedKeys(new Set());
    }

    const pageRowKeys = useMemo(
        () => data.map((row, idx) => resolveKey(row, idx)),
        [data, resolveKey],
    );

    const headerChecked =
        pageRowKeys.length > 0 && pageRowKeys.every((key) => selectedKeys.has(key));

    const toggleSelectAll = useCallback(() => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            const allOn = pageRowKeys.length > 0 && pageRowKeys.every((key) => next.has(key));
            if (allOn) {
                for (const key of pageRowKeys) next.delete(key);
            } else {
                for (const key of pageRowKeys) next.add(key);
            }
            return next;
        });
    }, [pageRowKeys]);

    const toggleSelectRow = useCallback((key: RowSelectionKey) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    if (selectionAnchor.page !== currentPage0 || selectionAnchor.show !== showRowSelection) {
        setSelectionAnchor({ page: currentPage0, show: showRowSelection });
        setSelectedKeys(new Set());
    }

    const selectedRows = useMemo(() => {
        const rows: unknown[] = [];
        for (let i = 0; i < data.length; i++) {
            const key = pageRowKeys[i];
            if (key != null && selectedKeys.has(key)) rows.push(data[i]);
        }
        return rows;
    }, [data, pageRowKeys, selectedKeys]);

    const clearSelection = useCallback(() => {
        setSelectedKeys(new Set());
    }, []);

    const rowSelectionApi = useMemo((): JsGridRowSelectionApi | null => {
        if (!showRowSelection) return null;
        return {
            selectedCount: selectedRows.length,
            selectedRows,
            disabled: selectedRows.length === 0,
            clearSelection,
        };
    }, [showRowSelection, selectedRows, clearSelection]);

    const rowSelection = useMemo(() => {
        if (!showRowSelection) return undefined;
        return {
            pageRowKeys,
            selectedKeys,
            headerChecked,
            onToggleAll: toggleSelectAll,
            onToggleRow: toggleSelectRow,
        };
    }, [showRowSelection, pageRowKeys, selectedKeys, headerChecked, toggleSelectAll, toggleSelectRow]);

    const gridTheme = resolveJsGridTheme(props.theme);

    const fieldsBusyLabel = fieldsSaveBusy ? "저장 중..." : fieldsResetBusy ? "초기화 중..." : undefined;

    const [toolbarOverlay, setToolbarOverlay] = useState<{ label: string; accent: string } | null>(null);

    const runToolbarAction = useCallback(
        async (
            label: string,
            action: () => void | Promise<void>,
            accent = "#2563eb",
        ) => {
            setToolbarOverlay({ label, accent });
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });
            try {
                await Promise.resolve(action());
            } finally {
                setToolbarOverlay(null);
            }
        },
        [],
    );

    const setBodyOverlay = useCallback(
        (overlay: { label: string; accent?: string } | null) => {
            setToolbarOverlay(
                overlay ? { label: overlay.label, accent: overlay.accent ?? "#2563eb" } : null,
            );
        },
        [],
    );

    const toolbarApi = useMemo(
        () => ({ runToolbarAction, setBodyOverlay }),
        [runToolbarAction, setBodyOverlay],
    );

    const renderToolbarSlot = useCallback(
        (slot?: JsGridToolbarSlot) => {
            if (slot == null) return undefined;
            return typeof slot === "function" ? slot(toolbarApi) : slot;
        },
        [toolbarApi],
    );

    const toolbarStartNode = useMemo(
        () => renderToolbarSlot(props.toolbarStart),
        [props.toolbarStart, renderToolbarSlot],
    );
    const toolbarEndNode = useMemo(
        () => renderToolbarSlot(props.toolbarEnd),
        [props.toolbarEnd, renderToolbarSlot],
    );

    const gridBodyOverlay = useMemo(() => {
        if (toolbarOverlay) return toolbarOverlay;
        if (fieldsSaveBusy) return { label: "저장 중...", accent: "#2563eb" };
        if (fieldsResetBusy) return { label: "초기화 중...", accent: "#2563eb" };
        return null;
    }, [toolbarOverlay, fieldsSaveBusy, fieldsResetBusy]);
    const gridBodyBusy = gridBodyOverlay != null;

    return (
        <JsGridToolbarProvider value={toolbarApi}>
            <JsGridRowSelectionProvider value={rowSelectionApi}>
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
                    @keyframes jsgrid-body-overlay-spin-${gridOverlaySpinClass} {
                        to { transform: rotate(360deg); }
                    }
                    .jsgrid-body-overlay-spin-dot-${gridOverlaySpinClass} {
                        animation: jsgrid-body-overlay-spin-${gridOverlaySpinClass} 0.75s linear infinite;
                    }
                `}</style>
                <JsGridToolbar
                    theme={props.theme}
                    fieldsBtnRef={fieldsBtnRef}
                    showColumnFieldsMenu={Boolean(props.onHeaderSave)}
                    isPseudoFullscreen={isPseudoFullscreen}
                    enablePseudoFullscreen={enablePseudoFullscreen}
                    fieldsBusy={props.onHeaderSave ? fieldsActionBusy : undefined}
                    fieldsBusyLabel={fieldsBusyLabel}
                    onToggleFieldsMenu={(e) => {
                        e.stopPropagation();
                        if (!props.onHeaderSave) return;
                        if (fieldsActionBusy) return;
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
                    toolbarStart={toolbarStartNode}
                    toolbarEnd={toolbarEndNode}
                />

                <ColumnFieldsMenu
                    open={isFieldsMenuOpen}
                    pos={fieldsMenuPos}
                    userColumns={userColumns}
                    dragKeyRef={dragKeyRef}
                    saveBusy={fieldsSaveBusy}
                    resetBusy={fieldsResetBusy}
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
                        props.onHeaderSave
                            ? async () => {
                                setFieldsSaveError(null);
                                setFieldsResetBusy(true);
                                // busy UI가 그려진 뒤 컬럼/API 처리 (동기만 있으면 React가 한 번에 배치해 스피너가 안 보임)
                                await new Promise<void>((resolve) => {
                                    requestAnimationFrame(() => resolve());
                                });
                                try {
                                    setUserColumns(
                                        headerList.map((c) => ({
                                            key: c.key,
                                            label: String(c.label ?? c.key),
                                            visible: true,
                                        })),
                                    );
                                    if (props.onHeaderReset) {
                                        await Promise.resolve(props.onHeaderReset());
                                    }
                                } finally {
                                    setFieldsResetBusy(false);
                                }
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
                            filter: gridBodyBusy ? "blur(2px)" : undefined,
                            pointerEvents: gridBodyBusy ? "none" : undefined,
                            transition: "filter 120ms ease",
                        }}
                    >
                        <JsGridTable
                            theme={props.theme}
                            editable={props.editable}
                            columns={columns}
                            data={data}
                            page={page}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            headerCellRefs={headerCellRefs}
                            colWidthByKey={colWidthByKey}
                            freezeUntilIndex={freezeUntilIndex}
                            onColumnWidthChange={props.resizable ? setColumnWidth : undefined}
                            onFreezeColumn={handleFreezeColumn}
                            getStickyStyle={getStickyStyle}
                            rowSelection={rowSelection}
                            onRowClick={props.onRowClick}
                            onCellChange={props.onCellChange}
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
                    {gridBodyOverlay ? (
                        <div
                            className="js-grid-body-busy-overlay"
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
                            aria-live="polite"
                            aria-busy
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
                                    className={`jsgrid-body-overlay-spin-dot-${gridOverlaySpinClass}`}
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: "50%",
                                        border: "2px solid #e5e7eb",
                                        borderTopColor: gridBodyOverlay.accent,
                                        boxSizing: "border-box",
                                    }}
                                    aria-hidden
                                />
                                {gridBodyOverlay.label}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            </JsGridRowSelectionProvider>
        </JsGridToolbarProvider>
    );
}

export default JsGrid;
