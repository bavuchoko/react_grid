import type {CSSProperties, ReactNode} from "react";
import type {JsGridTheme} from "../js-grid/gridTheme.ts";
import type {JsGridToolbarApi} from "../js-grid/jsGridToolbarApi.ts";

/** `toolbarStart` / `toolbarEnd` — ReactNode 또는 render prop */
export type JsGridToolbarSlot = ReactNode | ((api: JsGridToolbarApi) => ReactNode);

export type GridType ={
    data?: Data
    header?: Header[]
    /** resolve 시 저장 완료(컬럼 메뉴가 닫힌다). reject 시 메뉴는 열린 채로 오류 표시 가능. */
    onHeaderSave?: (headers: HeaderState[]) => void | Promise<void>
    /** 컬럼 설정 메뉴에서 "초기화" 클릭 시 호출된다. */
    onHeaderReset?: () => void | Promise<void>
    /** 체크박스를 제외한 행 클릭 시 호출된다. */
    onRowClick?: (row: unknown) => void
    /** `true`면 체크박스 열·행 선택 UI를 표시한다. 삭제 등은 `toolbarEnd`의 `ToolbarDataTransfer`로 처리. */
    enableRowSelection?: boolean
    /**
     * 행 선택 식별 필드명(기본 `id`). `getRowSelectionId`가 있으면 우선한다.
     * 식별자가 없으면 페이지·인덱스 fallback — 조회 데이터가 바뀌면 선택이 초기화된다.
     */
    rowSelectionIdKey?: string
    /** 행 객체에서 선택 키 추출(서버 고유 키가 `id`가 아닐 때) */
    getRowSelectionId?: (row: unknown, rowIndex: number) => string | number | null | undefined
    /** false면 전체화면(pseudo fullscreen) 토글 UI/동작을 비활성화한다. (기본값: true) */
    enablePseudoFullscreen?: boolean
    /**
     * Spring `Pageable`에 대응되는 값을 한 번에 전달한다.
     * - `pageNumber`는 0-based
     * - `sort`는 `property,direction` 형태(예: `createdAt,desc`)를 권장
     */
    onPageChange?: (pageable: Page) => void
    /**
     * 본문 셀 편집기(`Header.editor`)에서 `onChange`가 호출될 때 전달된다.
     * 행 데이터 갱신은 호출 측(부모 state / API)에서 처리한다.
     */
    onCellChange?: (event: GridCellChangeEvent) => void | Promise<void>
    /** 생략·`basic`은 기본 스타일. `linear`는 툴바·헤더 흰 배경, 본문 홀수 행(1·3·5…) 줄무늬. */
    theme?: JsGridTheme
    /** `true`일 때만 헤더에서 열 너비 드래그·리사이즈 핸들(`|`)이 표시·동작한다. */
    resizable?: boolean
    /**
     * `true`이고 전체보기(pseudo fullscreen)일 때만 `Header.editor` 셀을 **클릭**해 편집한다.
     * 일반 화면에서는 `onRowClick`만 사용한다. 전체보기 중에는 `onRowClick`이 호출되지 않는다.
     * (기본값: `false`)
     */
    editable?: boolean
    /** 툴바 왼쪽(헤더 고정 안내 옆). 함수면 `runToolbarAction`으로 본문 로딩 연동 가능. */
    toolbarStart?: JsGridToolbarSlot
    /** 툴바 오른쪽 기본 아이콘 앞. 함수면 `runToolbarAction`으로 본문 로딩 연동 가능. */
    toolbarEnd?: JsGridToolbarSlot
    style?: CSSProperties
}

export type HeaderState = {
    key: string;
    label: string;
    visible: boolean;
    /** 저장된 컬럼 너비(px). 없으면 기본 레이아웃·측정에 따름. */
    width?: number;
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

/** `Header.editor` — `render` 인자 + 값 적용/닫기 콜백 */
export type GridCellEditorArgs = GridCellRenderArgs & {
    /** 새 값 적용. `close: true`면 팝업을 닫는다. */
    onChange: (value: unknown, options?: { close?: boolean }) => void;
    /** 편집 UI 닫기(모달·드로어 완료 시 등) */
    onClose: () => void;
};

export type GridCellEditor = ReactNode | ((args: GridCellEditorArgs) => ReactNode);

export type GridCellChangeEvent = {
    row: unknown;
    rowIndex: number;
    columnKey: string;
    value: unknown;
    previousValue: unknown;
};

export type DataType = 'string' | 'number' | 'state' | 'date' | 'score' | 'children';

/** `JsGridTable` 컬럼 배열(행번호·체크박스 열 포함). `Header`와 동일한 `GridCellRenderArgs`를 사용한다. */
export type JsGridTableColumn = {
    key: string;
    label: string;
    /** `Header.type` — `children`이면 `key`를 `_` 기준으로 나눠 배열에서 `valueString`을 찾는다. */
    type?: DataType;
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    editor?: GridCellEditor;
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
    /** 사용자/서버 저장 너비(px). 있으면 해당 컬럼에 적용, 없으면 자동 너비. */
    width?: number;
    /**
     * 셀 커스텀 렌더링.
     * - 함수면 `(args) => ReactNode` 형태로 호출된다.
     * - JSX/ReactNode면 element일 경우 `row`, `value`, `columnKey` props를 주입하여 렌더링한다.
     */
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    /**
     * 본문 셀 **더블클릭** 시 표시할 편집 UI.
     * - 함수형: `(args) => ReactNode`
     * - JSX/ReactNode: `row`, `value`, `columnKey`, `rowIndex`, `onChange`, `onClose` props 주입
     */
    editor?: GridCellEditor;
}

export type IconType ={
    style?:CSSProperties
    className?:string
    onClick?: () => void
}