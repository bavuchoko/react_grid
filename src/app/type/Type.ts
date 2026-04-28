import type {CSSProperties, ReactNode} from "react";

export type GridType ={
    data?: Data
    header?: Header[]
    onHeaderSave?: (headers: HeaderState[]) => void
    /** 컬럼 설정 메뉴에서 "초기화" 클릭 시 호출된다. */
    onHeaderReset?: () => void
    onDownloadClick?: () => void
    /** 전달 시 툴바에 업로드 아이콘이 표시되고, 클릭 시 호출된다. */
    onUploadClick?: () => void
    /** 체크박스를 제외한 행 클릭 시 호출된다. */
    onRowClick?: (row: unknown) => void
    /** 전달 시 행 왼쪽에 체크박스·툴바 휴지통이 표시되고, 선택된 행의 "데이터 객체" 배열로 호출된다(1건이어도 배열). */
    onDeleteClick?: (rows: unknown[]) => void
    /** 전달 시 툴바에 연필 아이콘이 표시되고, 클릭 시 호출된다. */
    onCreateClick?: () => void
    /** false면 전체화면(pseudo fullscreen) 토글 UI/동작을 비활성화한다. (기본값: true) */
    enablePseudoFullscreen?: boolean
    /**
     * Spring `Pageable`에 대응되는 값을 한 번에 전달한다.
     * - `pageNumber`는 0-based
     * - `sort`는 `property,direction` 형태(예: `createdAt,desc`)를 권장
     */
    onPageChange?: (pageable: Page) => void
    style?: CSSProperties
}

export type HeaderState = {
    key: string;
    label: string;
    visible: boolean;
}

type Data = {
    content?: unknown[]
    pageable?: Page;
    totalElements?: number;
    totalPages?: number;
    listener?:(v:unknown)=>void;
}

/** `Header.render` 함수형과 테이블 컬럼 `render`가 동일한 인자 타입을 쓰도록 공유한다. */
export type GridCellRenderArgs = {
    row: unknown;
    value: unknown;
    columnKey: string;
    rowIndex: number;
    stopRowClick: (e: unknown) => void;
};

/** `JsGridTable` 컬럼 배열(행번호·체크박스 열 포함). `Header`와 동일한 `GridCellRenderArgs`를 사용한다. */
export type JsGridTableColumn = {
    key: string;
    label: string;
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    __rownum__?: boolean;
    __checkbox__?: boolean;
};

export type Page = {
    pageNumber?: number;
    size?: number;
    pageSize?: number;
    sort?: string[];
    desc?: string;
    /** Spring `Page` 응답과 동일하게 UI(행번호 등)에서 참조할 수 있음 */
    totalElements?: number;
    totalPages?: number;
    /** 단일 컬럼 정렬 UI에서 방향을 명시적으로 실어 보낼 때 사용(optional) */
    sortDirection?: 'ASC' | 'DESC';
}

export type Header ={
    key:string;
    label:string;
    type: DataType;
    /**
     * 셀 커스텀 렌더링.
     * - 함수면 `(args) => ReactNode` 형태로 호출된다.
     * - JSX/ReactNode면 element일 경우 `row`, `value`, `columnKey` props를 주입하여 렌더링한다.
     */
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
}

export type DataType = 'string' | 'number' | 'state' | 'date' | 'score';

export type IconType ={
    style?:CSSProperties
    className?:string
    onClick?: () => void
}