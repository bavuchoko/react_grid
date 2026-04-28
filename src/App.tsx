import type {Header} from "./app/type/Type.ts";
import JsGrid from "./app/JsGrid.tsx";
import {useMemo, useState} from "react";

const App = () => {
    const [pageNumber, setPageNumber] = useState(0);
    const MyCell = (props: any) => <span onClick={()=>console.log(props.value)}>{props.rowIndex}: {String(props.value ?? "")}</span>;
    const header: Header[] = [
        {key:'creator.name', label:'등록자', type:'string'},
        {key:'state', label:'진행상태', type:'state', },
        {key:'title', label:'제목', type:'string'},
        {key:'number', label:'티켓번호', type:'string'},
        {key:'createdAt', label:'등록일', type:'date'},
        {key:'requester.name', label:'요청자', type:'string'},
        {key:'score', label:'만족도', type:'score', render: <MyCell />},
        {key:'deadLine.endBy', label:'만료일', type:'date'},
        {key:'category.name', label:'카테고리', type:'string'},
        {key:'updatedAt', label:'수정일', type:'date'},
        {key:'transTo.title', label:'이관', type:'string'},
    ]

    const allRows = useMemo(() => (
        Array.from({ length: 15 }, (_, i) => ({
            id: pageNumber * 15 + i + 1,
            creator: { name: '등록자' },
            state: '접수중',
            title: '제목1234123123123123 어 글쎄',
            number: '203123-123',
            createdAt: '2026-01-02',
            requester: { name: '관리자' },
            score: '35',
            deadLine: { endBy: '2026-04-23' },
            category: { name: '네트워크' },
            updatedAt: '2026-01-02',
            transTo: { title: '이관정보' },
        }))
    ), [pageNumber]);

    const pageSize = 15;
    const totalElements = 150;
    const totalPages = 10;

    const data = useMemo(() => {
        // 서버 페이징을 가정한 데모:
        // - 실제 서비스에서는 페이지 변경 시 서버가 새 content를 내려주기 전까지는 기존 rows가 유지되는 경우가 많다.
        // - 그래서 여기서는 pageNumber만 바꾸고 content는 그대로 둔다.
        return {
            content: allRows,
            pageable: { pageNumber, pageSize, size: pageSize },
            totalElements,
            totalPages,
        };
    }, [allRows, pageNumber, pageSize, totalElements, totalPages]);

    return (
        <div>

                <div style={{width:'500px', height:'400px'}}>
                    <JsGrid
                        header={header}
                        data={data}
                        onHeaderSave={v => console.log(v)}
                        onUploadClick={() => console.log('upload clicked')}
                        onHeaderReset={() => console.log('reset clicked')}
                        onDownloadClick={() => console.log('download Clicked')}
                        onCreateClick={() => console.log('create')}
                        onDeleteClick={(rows) => console.log('delete', rows)}
                        onRowClick={(rows)=>console.log('rowClick', rows)}
                        onPageChange={(p) => {
                            console.log('pageable', p);
                            setPageNumber(p.pageNumber ?? 0);
                        }}

                    />
                </div>

        </div>
    );
};

export default App;