<img width="701" height="462" alt="스크린샷 2026-04-28 오후 9 08 45" src="https://github.com/user-attachments/assets/169a8fd6-4fe6-4ce5-9865-d9b6476d5cfe" />
# js-grid

React/TypeScript 기반의 그리드 컴포넌트(`JsGrid`)입니다. 컬럼 표시/숨김, 순서 변경, 고정(Alt+클릭), 정렬, 페이지네이션, 선택 삭제, 툴바 액션(다운로드/업로드/추가) 등을 제공합니다.


## 개발 실행

```bash
npm install
npm run dev
```

## 빠른 시작

`JsGrid`는 `header`(컬럼 정의)와 `data`(페이지 데이터)를 받아 렌더링합니다.

```tsx
import type { Header, HeaderState, Page } from "./app/type/Type";
import JsGrid from "./app/JsGrid";

const header: Header[] = [
  { key: "title", label: "제목", type: "string" },
  { key: "createdAt", label: "등록일", type: "date" },
];

const data = {
  content: [
    { title: "첫 번째", createdAt: "2026-01-02" },
    { title: "두 번째", createdAt: "2026-01-03" },
  ],
  pageable: { pageNumber: 0, pageSize: 15, size: 15 },
  totalElements: 2,
  totalPages: 1,
};

export default function Example() {
  return (
    <JsGrid
      header={header}
      data={data}
      onPageChange={(p: Page) => console.log("pageable", p)}
    />
  );
}
```

## Props (핵심)

### 데이터/컬럼

- **`header?: Header[]`**: 컬럼 정의
  - `key`: 행 데이터에서 값을 꺼낼 키. 점 표기(`creator.name`) 지원
  - `label`: 헤더 텍스트
  - `type`: `'string' | 'number' | 'state' | 'date' | 'score'`
  - `render`: 셀 커스텀 렌더링(선택)
    - 함수형: `({ row, value, columnKey, rowIndex }) => ReactNode`
    - JSX/ReactNode: element일 경우 내부적으로 `row/value/columnKey/rowIndex` props를 주입하여 렌더링
- **`data?: { content?: unknown[]; pageable?: Page; totalElements?: number; totalPages?: number }`**: 페이지 데이터

#### `Header.render` 사용 예시

함수형:

```tsx
const header: Header[] = [
  {
    key: "title",
    label: "제목",
    type: "string",
    render: ({ value }) => <b>{String(value ?? "")}</b>,
  },
];
```

JSX element 주입형:

```tsx
const MyCell = (props: any) => (
  <span>
    {props.rowIndex}: {String(props.value ?? "")}
  </span>
);

const header: Header[] = [
  { key: "title", label: "제목", type: "string", render: <MyCell /> },
];
```

### 이벤트/액션

- **`onPageChange?: (pageable: Page) => void`**: 페이지/정렬 변경 시 호출 (서버 페이징 연결용)
- **`onHeaderSave?: (headers: HeaderState[]) => void`**: 컬럼 visible 상태 저장 (현재 컬럼 설정 저장)
- **`onHeaderReset?: () => void`**: 컬럼 설정 메뉴에서 "초기화" 클릭 시 호출
- **`onDownloadClick?: () => void | Promise<void>`**: 툴바 다운로드 아이콘 클릭. `async`/`Promise` 처리 중에는 툴바 스피너와 본문(테이블·페이지네이션) 블러·「다운로드 중…」 오버레이가 표시된다.
- **`onUploadFiles?: (files: File[]) => void | Promise<void>`**: 업로드 패널에서 전송 시 호출. 처리 중 본문 블러·「업로드 중…」 오버레이(툴바 스피너 포함).
- **`onRowClick?: (row: unknown) => void`**: 체크박스를 제외한 행 클릭 시 호출 (클릭된 행의 데이터 객체 전달)
  - `Header.render`가 있는 셀은 기본적으로 `onRowClick`으로 이벤트가 전파되지 않습니다.
- **`onCreateClick?: () => void`**: 툴바 추가(연필) 아이콘 클릭
- **`onDeleteClick?: (rows: unknown[]) => void | Promise<void>`**: 툴바 삭제(휴지통) 클릭. `Promise`가 끝날 때까지 로딩·그리드 블러가 유지된다.
  - 전달값은 **선택된 행 데이터 객체 배열**입니다.
  - 1개를 선택해도 **항상 배열**로 전달됩니다.
- **`enablePseudoFullscreen?: boolean`**: 전체화면(pseudo fullscreen) 토글 기능 사용 여부 (기본값: `true`)

### 스타일

- **`toolbarStart?: React.ReactNode`**: 툴바 왼쪽(헤더 고정 안내 옆) 커스텀 UI
- **`toolbarEnd?: React.ReactNode`**: 툴바 오른쪽(기본 아이콘·컬럼 메뉴 뒤, 전체화면 앞) 커스텀 UI
- **`style?: React.CSSProperties`**: `JsGrid` 루트 컨테이너 스타일 오버라이드
  - 기본 스타일은 유지되고, `style`을 넘기면 해당 값이 덮어써집니다.
  - pseudo fullscreen(전체화면)일 때는 레이아웃을 위해 일부 값(`width/height/position/zIndex/boxShadow` 등)이 강제로 적용됩니다.

예시:

```tsx
<JsGrid
  header={header}
  data={data}
  onRowClick={(row) => console.log("row click", row)}
  style={{ height: 500, borderRadius: 12 }}
/>
```

## UI 기능

- **정렬**: 헤더 클릭으로 정렬 변경(ASC/DESC)
- **컬럼 고정**: 헤더를 **Alt+클릭**하면 해당 컬럼까지 왼쪽 고정
- **컬럼 설정**: 컬럼 표시/숨김 및 순서 변경(툴바의 컬럼 아이콘)
- **컬럼 넓이 조정(리사이즈)**: 헤더 셀의 **오른쪽 경계(리사이즈 핸들)**를 드래그하여 너비를 조절
  - 체크박스/행번호 컬럼은 리사이즈 대상이 아닙니다.
  - 최소/최대 너비는 고정값으로 제한됩니다. (현재: 64px ~ 640px)
  - **저장/복원**:
    - 사용자가 조정한 너비는 `onHeaderSave(headers)`로 내려오는 `HeaderState.width`에 포함됩니다.
    - 저장한 너비를 다시 적용하려면, 다음 렌더에서 해당 컬럼의 `header.width`(px)에 주입해 주세요.
- **pseudo fullscreen**: 툴바의 전체화면 아이콘으로 토글 (ESC로 종료)
  - `enablePseudoFullscreen={false}`면 전체화면 버튼/동작이 비활성화됩니다.
- **선택/삭제**: `onDeleteClick`을 전달하면 체크박스 컬럼과 휴지통이 나타납니다.

## 서버 페이징 연결 예시

```tsx
<JsGrid
  header={header}
  data={pageResponse}
  onPageChange={(next) => {
    // next.pageNumber, next.pageSize/size, next.sort 등이 들어옵니다.
    fetchList(next);
  }}
/>
```

