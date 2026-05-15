import type {Header, HeaderState} from "./app/type/Type.ts";
import JsGrid from "./app/JsGrid.tsx";
import {useCallback, useMemo, useState} from "react";
import {applyHeaderStateToHeader} from "./app/index.ts";

const PAGE_SIZE = 15;
const TOTAL_ELEMENTS = 150;
const TOTAL_PAGES = 10;

const MyCell = (props: any) => (
    <span onClick={() => console.log(props.value)}>
        {props.rowIndex}: {String(props.value ?? "")}
    </span>
);

const App = () => {
    const [pageNumber, setPageNumber] = useState(0);
    const [header, setHeader] = useState<Header[]>(() => [
        {key: "creator.name", label: "등록자", type: "string"},
        {key: "state", label: "진행상태", type: "state"},
        {key: "title", label: "제목", type: "string"},
        {key: "number", label: "티켓번호", type: "string"},
        {key: "createdAt", label: "등록일", type: "date"},
        {key: "requester.name", label: "요청자", type: "string"},
        {key: "score", label: "만족도", type: "score", render: <MyCell />},
        {key: "deadLine.endBy", label: "만료일", type: "date"},
        {key: "category.name", label: "카테고리", type: "string"},
        {key: "updatedAt", label: "수정일", type: "date"},
        {key: "transTo.title", label: "이관", type: "string"},
    ]);

    const [data] = useState(() => (
        Array.from({ length: PAGE_SIZE }, (_, i) => ({
            id: pageNumber * PAGE_SIZE + i + 1,
            creator: {name: "등록자"},
            state: "접수중",
            title: "제목1234123123123123 어 글쎄",
            number: "203123-123",
            createdAt: "2026-01-02",
            requester: {name: "관리자"},
            score: "35",
            deadLine: {endBy: "2026-04-23"},
            category: {name: "네트워크"},
            updatedAt: "2026-01-02",
            transTo: {title: "이관정보"},
        }))
    ));

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
    const onUploadFiles = useCallback(async (files: File[]) => {
        await new Promise((r) => setTimeout(r, 1500));
        console.log(
            "업로드 완료 샘플",
            files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        );
    }, []);
    const onHeaderReset = useCallback(() => console.log("reset clicked"), []);
    const onDownloadClick = useCallback(() => console.log("download Clicked"), []);
    const onCreateClick = useCallback(() => console.log("create"), []);
    // api 요청 테스트용 삭제 메서드
    const deleteApi = useCallback((ids: number[]) =>
        new Promise<void>((resolve) => {
            console.log("delete 요청", ids);
            window.setTimeout(() => resolve(), 1000);
        }), []);

    const onDeleteClick = useCallback(async (rows: unknown[]) => {
        const ids = rows
            .map((r) => (r as { id?: unknown }).id)
            .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        if (ids.length === 0) return;

        await deleteApi(ids);
        // 실제 서비스라면 여기서 서버 재조회 후 `setData`를 한다.
        console.log("삭제 완료, 이후 재조회 필요", ids);
    }, [deleteApi]);


    const onRowClick = useCallback((rows: unknown) => console.log("rowClick", rows), []);
    const onPageChange = useCallback((p: any) => {
        console.log("pageable", p);
        setPageNumber(p.pageNumber ?? 0);
    }, []);

    const pageData = useMemo(() => {
        // 서버 페이징을 가정한 데모:
        // - 실제 서비스에서는 페이지 변경 시 서버가 새 content를 내려주기 전까지는 기존 rows가 유지되는 경우가 많다.
        // - 그래서 여기서는 pageNumber만 바꾸고 content는 그대로 둔다.
        return {
            content: data,
            pageable: {pageNumber, pageSize: PAGE_SIZE, size: PAGE_SIZE},
            totalElements: TOTAL_ELEMENTS,
            totalPages: TOTAL_PAGES,
        };
    }, [data, pageNumber]);

    return (
        <div style={{height:'100%'}}>
            <JsGrid
                // style={{flex: "1 1 0%", minHeight: 0, width: "100%"}}
                header={header}
                data={pageData}
                onHeaderSave={onHeaderSave}
                onUploadFiles={onUploadFiles}
                onHeaderReset={onHeaderReset}
                onDownloadClick={onDownloadClick}
                onCreateClick={onCreateClick}
                onDeleteClick={onDeleteClick}
                onRowClick={onRowClick}
                onPageChange={onPageChange}
            />
        </div>
    );
};

export default App;