import type {Header} from "./app/type/Type.ts";
import JsGrid from "./app/JsGrid.tsx";
import {useCallback, useMemo, useState} from "react";

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
    const header: Header[] = useMemo(
        () => [
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
        ],
        [],
    );

    const allRows = useMemo(() => (
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
    ), [pageNumber]);

    const onHeaderSave = useCallback((v: unknown) => console.log(v), []);
    const onUploadClick = useCallback(() => console.log("upload clicked"), []);
    const onHeaderReset = useCallback(() => console.log("reset clicked"), []);
    const onDownloadClick = useCallback(() => console.log("download Clicked"), []);
    const onCreateClick = useCallback(() => console.log("create"), []);
    const onDeleteClick = useCallback((rows: unknown) => console.log("delete", rows), []);
    const onRowClick = useCallback((rows: unknown) => console.log("rowClick", rows), []);
    const onPageChange = useCallback((p: any) => {
        console.log("pageable", p);
        setPageNumber(p.pageNumber ?? 0);
    }, []);

    const data = useMemo(() => {
        // 서버 페이징을 가정한 데모:
        // - 실제 서비스에서는 페이지 변경 시 서버가 새 content를 내려주기 전까지는 기존 rows가 유지되는 경우가 많다.
        // - 그래서 여기서는 pageNumber만 바꾸고 content는 그대로 둔다.
        return {
            content: allRows,
            pageable: {pageNumber, pageSize: PAGE_SIZE, size: PAGE_SIZE},
            totalElements: TOTAL_ELEMENTS,
            totalPages: TOTAL_PAGES,
        };
    }, [allRows, pageNumber]);

    return (
        <div>
            <div style={{width: "700px", height: "800px", display: "flex", flexDirection: "column"}}>
                <JsGrid
                    style={{flex:'0 0 auto', maxHeight:'none'}}
                    header={header}
                    data={data}
                    onHeaderSave={onHeaderSave}
                    onUploadClick={onUploadClick}
                    onHeaderReset={onHeaderReset}
                    onDownloadClick={onDownloadClick}
                    onCreateClick={onCreateClick}
                    onDeleteClick={onDeleteClick}
                    onRowClick={onRowClick}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

export default App;