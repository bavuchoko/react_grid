import type {CSSProperties} from "react";

export type GridType ={
    data?: Data
    header?: Header[]
    onSave?: (headers: HeaderState[]) => void
    onExport?: () => void
    /** 전달 시 행 왼쪽에 체크박스·툴바 휴지통이 표시되고, 선택된 행의 `id`(number) 배열로 호출된다. */
    onDelete?: (ids: number[]) => void
    /** 전달 시 툴바에 연필 아이콘이 표시되고, 클릭 시 호출된다. */
    onCreate?: () => void
    /**
     * Spring `Pageable`에 대응되는 값을 한 번에 전달한다.
     * - `pageNumber`는 0-based
     * - `sort`는 `property,direction` 형태(예: `createdAt,desc`)를 권장
     */
    onPageChange?: (pageable: Page) => void
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
}

export type DataType = 'string' | 'number' | 'state' | 'date' | 'score';

export type IconType ={
    style?:CSSProperties
    className?:string
    onClick?: () => void
}