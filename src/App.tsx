import type { GridCellPasteBatch, Header, HeaderState } from "./app/type/Type.ts";
import JsGrid from "./app/JsGrid.tsx";
import ToolbarAsyncAction from "./app/js-grid/ToolbarAsyncAction.tsx";
import ToolbarDataTransfer from "./app/js-grid/ToolbarDataTransfer.tsx";
import DownLoad from "./app/resources/icon/DownLoad.tsx";
import {
    PERF_TEST_COLS,
    PERF_TEST_ROWS,
    buildPerfTestHeader,
    buildPerfTestRows,
} from "./demo/perfTestData.ts";
import { useCallback, useMemo, useState } from "react";
import { applyHeaderStateToHeader, applyPasteValueToRow } from "./app/index.ts";

function DemoToolbarIcon({ children }: { children: React.ReactNode }) {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {children}
        </svg>
    );
}

const demoToolbarCustomGap = { display: "flex" as const, alignItems: "center", gap: 16 };

/** 가상 스크롤 스트레스 테스트: 단일 페이지에 전체 행 전달 */
const PAGE_SIZE = PERF_TEST_ROWS;
const TOTAL_ELEMENTS = PERF_TEST_ROWS;
const TOTAL_PAGES = 1;

const App = () => {
    const [pageNumber] = useState(0);
    const [header, setHeader] = useState<Header[]>(() => buildPerfTestHeader(PERF_TEST_COLS));
    const [rows, setRows] = useState<unknown[]>(() => buildPerfTestRows(PERF_TEST_ROWS, PERF_TEST_COLS));

    const headerApi = useCallback(async (_payload: HeaderState[]) => {
        await new Promise<void>((r) => window.setTimeout(r, 300));
        return true as const;
    }, []);

    const onHeaderSave = useCallback(
        async (payload: HeaderState[]) => {
            await headerApi(payload);
            setHeader((prev) => applyHeaderStateToHeader({ header: prev, state: payload }));
        },
        [headerApi],
    );

    const delay = useCallback(
        (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
        [],
    );

    const onHeaderReset = useCallback(async () => {
        await headerApi([]);
    }, [headerApi]);

    const onCustomDownloadClick = useCallback(async () => {
        await delay(1500);
        console.log("다운로드(테스트) 완료");
    }, [delay]);

    const onCustomSearchClick = useCallback(async () => {
        await delay(1200);
        console.log("커스텀 검색(테스트) 완료");
    }, [delay]);

    const onCustomRefreshClick = useCallback(async () => {
        await delay(1000);
        console.log("커스텀 새로고침(테스트) 완료");
    }, [delay]);

    const onCustomFilterClick = useCallback(async () => {
        await delay(1500);
        console.log("커스텀 필터(테스트) 완료");
    }, [delay]);

    const onCustomUserClick = useCallback(async () => {
        await delay(800);
        console.log("커스텀 사용자 메뉴(테스트) 완료");
    }, [delay]);

    const headerTypeByKey = useMemo(
        () => new Map(header.map((h) => [h.key, h.type] as const)),
        [header],
    );

    const patchCellsApi = useCallback(
        (columnKey: string, value: string, ids: number[]) =>
            new Promise<void>((resolve) => {
                console.log("patch cells 요청", { columnKey, value, ids });
                window.setTimeout(() => resolve(), 100);
            }),
        [],
    );

    const deleteApi = useCallback(
        (ids: number[]) =>
            new Promise<void>((resolve) => {
                console.log("delete 요청", ids);
                window.setTimeout(() => resolve(), 1000);
            }),
        [],
    );

    const onDeleteTransfer = useCallback(
        async (selected: unknown[]) => {
            const ids = selected
                .map((r) => (r as { id?: unknown }).id)
                .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
            if (ids.length === 0) return;
            await deleteApi(ids);
            console.log("삭제 완료(데모)", ids.length, "건");
        },
        [deleteApi],
    );

    const onCellsPaste = useCallback(
        async (batches: GridCellPasteBatch[]) => {
            if (batches.length === 0) return;

            const patchesByRowId = new Map<number, GridCellPasteBatch["items"]>();
            for (const batch of batches) {
                const ids = batch.rowIds.filter(
                    (id): id is number => typeof id === "number" && Number.isFinite(id),
                );
                if (ids.length > 0) {
                    await patchCellsApi(batch.columnKey, String(batch.value ?? ""), ids);
                }
                for (const item of batch.items) {
                    const id = item.rowId;
                    if (typeof id !== "number" || !Number.isFinite(id)) continue;
                    const list = patchesByRowId.get(id) ?? [];
                    list.push(item);
                    patchesByRowId.set(id, list);
                }
            }

            setRows((prev) =>
                prev.map((r) => {
                    const id = (r as { id?: unknown }).id;
                    if (typeof id !== "number" || !Number.isFinite(id)) return r;
                    const rowItems = patchesByRowId.get(id);
                    if (!rowItems?.length) return r;

                    const next = { ...(r as Record<string, unknown>) };
                    for (const item of rowItems) {
                        const columnType = headerTypeByKey.get(item.columnKey);
                        applyPasteValueToRow(next, item.columnKey, item.value, columnType);
                    }
                    return next;
                }),
            );
        },
        [headerTypeByKey, patchCellsApi],
    );

    const onRowClick = useCallback((row: unknown) => console.log("rowClick", row), []);

    const onPageChange = useCallback((p: { pageNumber?: number }) => {
        console.log("pageable", p);
    }, []);

    const pageData = useMemo(
        () => ({
            content: rows,
            pageable: { pageNumber, pageSize: PAGE_SIZE, size: PAGE_SIZE },
            totalElements: TOTAL_ELEMENTS,
            totalPages: TOTAL_PAGES,
        }),
        [rows, pageNumber],
    );

    const isAdmin = true;

    return (
        <div style={{ height: "100vh", width: "100%", padding: 10, boxSizing: "border-box" }}>
            <div
                style={{
                    marginBottom: 8,
                    fontSize: 13,
                    color: "#475569",
                }}
            >
                스트레스 테스트 — {PERF_TEST_ROWS.toLocaleString()}행 × {PERF_TEST_COLS}열 (가상
                스크롤)
            </div>
            <div style={{ height: "calc(100% - 28px)", minHeight: 0 }}>
                <JsGrid
                    editable
                    resizable
                    theme="linear"
                    toolbarStart={() => (
                        <div style={demoToolbarCustomGap}>
                            <ToolbarAsyncAction
                                hint="검색 (테스트)"
                                busyHint="검색 중…"
                                overlayLabel="검색 중…"
                                onClick={onCustomSearchClick}
                            >
                                <DemoToolbarIcon>
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </DemoToolbarIcon>
                            </ToolbarAsyncAction>
                            <ToolbarAsyncAction
                                hint="새로고침 (테스트)"
                                busyHint="새로고침 중…"
                                overlayLabel="새로고침 중…"
                                onClick={onCustomRefreshClick}
                            >
                                <DemoToolbarIcon>
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                    <path d="M16 16h5v5" />
                                </DemoToolbarIcon>
                            </ToolbarAsyncAction>
                        </div>
                    )}
                    toolbarEnd={() => (
                        <div style={demoToolbarCustomGap}>
                            {isAdmin ? (
                                <>
                                    <ToolbarDataTransfer
                                        hint="선택 항목 삭제"
                                        busyHint="삭제 중…"
                                        overlayLabel="삭제 중…"
                                        onTransfer={onDeleteTransfer}
                                    >
                                        <button
                                            type="button"
                                            className="w-8 border rounded-4 text-black"
                                        >
                                            삭제
                                        </button>
                                    </ToolbarDataTransfer>
                                    <ToolbarAsyncAction
                                        hint="다운로드 (테스트)"
                                        busyHint="다운로드 중…"
                                        overlayLabel="다운로드 중…"
                                        onClick={onCustomDownloadClick}
                                    >
                                        <DownLoad />
                                    </ToolbarAsyncAction>
                                </>
                            ) : null}
                            <ToolbarAsyncAction
                                hint="필터 (테스트)"
                                busyHint="필터 적용 중…"
                                overlayLabel="필터 적용 중…"
                                onClick={onCustomFilterClick}
                            >
                                <DemoToolbarIcon>
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                </DemoToolbarIcon>
                            </ToolbarAsyncAction>
                            <ToolbarAsyncAction
                                hint="사용자 (테스트)"
                                busyHint="불러오는 중…"
                                overlayLabel="불러오는 중…"
                                onClick={onCustomUserClick}
                            >
                                <DemoToolbarIcon>
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </DemoToolbarIcon>
                            </ToolbarAsyncAction>
                        </div>
                    )}
                    header={header}
                    data={pageData}
                    onHeaderSave={isAdmin ? onHeaderSave : undefined}
                    onHeaderReset={onHeaderReset}
                    enableRowSelection={isAdmin}
                    onRowClick={onRowClick}
                    onCellsPaste={onCellsPaste}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

export default App;
