<img width="701" height="462" alt="스크린샷 2026-04-28 오후 9 08 45" src="https://github.com/user-attachments/assets/169a8fd6-4fe6-4ce5-9865-d9b6476d5cfe" />
# js-grid

React/TypeScript 기반의 그리드 컴포넌트(`JsGrid`)입니다. 컬럼 표시/숨김, 순서 변경, 고정(Alt+클릭), 정렬, 페이지네이션, 행 선택, 내장 툴바(컬럼 설정·전체화면 등), 커스텀 툴바(`ToolbarAsyncAction`·`ToolbarDataTransfer`·`ToolbarUploadAction`) 등을 제공합니다.


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
  - `editor`: 편집 UI 컴포넌트(선택). **`editable={true}`일 때만** 해당 컬럼 본문 셀 **더블클릭**으로 연다. 함수형·JSX 주입 지원, `onChange`, `onClose` 주입.
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

#### `Header.editor` — 더블클릭 인라인 편집

`JsGrid`에 **`editable={true}`** 를 넘기고, `editor`가 정의된 컬럼만 본문 셀 **더블클릭** 시 편집 UI가 셀 위치에 열립니다. (`editable`이 없거나 `false`면 `editor`가 있어도 더블클릭 편집은 동작하지 않습니다.)

값 반영은 `onCellChange` 또는 에디터에서 직접 API 호출 후 `data` 갱신으로 처리합니다.

```tsx
const header: Header[] = [
  {
    key: "assetName",
    label: "자산명",
    type: "string",
    editor: ({ value, onChange, onClose }) => (
      <input
        autoFocus
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onChange((e.target as HTMLInputElement).value, { close: true });
          if (e.key === "Escape") onClose();
        }}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
    ),
  },
];

<JsGrid
  editable={true}
  header={header}
  data={pageData}
  onCellChange={({ row, rowIndex, columnKey, value }) => {
    // row / API로 갱신 후 setState → data.content 재전달
    console.log("cell change", rowIndex, columnKey, value, row);
  }}
/>
```

- `onChange(nextValue, { close: true })` — 값 적용 후 팝업 닫기
- `onClose()` — 적용 없이 닫기(모달·드로어 완료 버튼 등)
- 인풋·달력·드로어·모달 등 **임의 React 컴포넌트**를 `editor`에 넣을 수 있습니다.

### 이벤트/액션

- **`onPageChange?: (pageable: Page) => void`**: 페이지/정렬 변경 시 호출 (서버 페이징 연결용)
- **`onHeaderSave?: (headers: HeaderState[]) => void`**: 컬럼 visible 상태 저장 (현재 컬럼 설정 저장)
- **`onHeaderReset?: () => void | Promise<void>`**: 컬럼 설정 메뉴에서 "초기화" 클릭 시 호출. `async`/`Promise` 처리 중에는 저장과 동일하게 툴바·본문 로딩이 표시된다.
- **`onRowClick?: (row: unknown) => void`**: 체크박스를 제외한 행 클릭 시 호출 (클릭된 행의 데이터 객체 전달)
  - `Header.render`가 있는 셀은 기본적으로 `onRowClick`으로 이벤트가 전파되지 않습니다.
- **`editable?: boolean`**: `true`일 때만 `Header.editor` 더블클릭 편집 활성 (기본 `false`)
- **`onCellChange?: (event) => void | Promise<void>`**: `Header.editor`에서 `onChange` 호출 시 전달 (`row`, `rowIndex`, `columnKey`, `value`, `previousValue`)
- **`enableRowSelection?: boolean`**: `true`면 체크박스 열·행 선택 UI를 표시한다. 삭제·보내기 등은 `toolbarEnd`의 **`ToolbarDataTransfer`**로 처리한다(선택과 콜백을 분리).
  - 선택 키는 기본 **`row.id`**(또는 `rowSelectionIdKey` / `getRowSelectionId`).
  - **조회 데이터·페이지 메타가 바뀌면** 체크가 **전부 해제**된다(검색 조건 변경 후 잘못된 행 삭제 방지).
  - **페이지 이동** 시에도 선택이 초기화된다.
- **`enablePseudoFullscreen?: boolean`**: 전체화면(pseudo fullscreen) 토글 기능 사용 여부 (기본값: `true`)

### 스타일

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

### 툴바 커스텀 아이콘 / UI

그리드 **기본 툴바**는 컬럼 설정·전체화면 등입니다. **삭제·다운로드·업로드·필터** 등은 `toolbarStart` / `toolbarEnd`에 커스텀 컴포넌트로 넣습니다.

| Prop | 타입 | 위치 |
|------|------|------|
| **`toolbarStart`** | `ReactNode` \| `(api) => ReactNode` | 툴바 **왼쪽** — 「헤더 고정」 안내(자물쇠) **오른쪽** |
| **`toolbarEnd`** | `ReactNode` \| `(api) => ReactNode` | 툴바 **오른쪽** — 기본 액션 아이콘들 **앞** |

아이콘 크기는 기본 툴바와 맞추려면 **약 18×18px**을 권장합니다.

#### `ToolbarDataTransfer` — 선택 행 전달(삭제 등)

`enableRowSelection`과 함께 사용한다. 클릭 시 **선택된 행 데이터 배열**로 `onTransfer`가 호출되고, 성공 시 선택이 해제된다.

```tsx
import JsGrid, { ToolbarDataTransfer } from "@bavuchoko/js-grid";
import Trash from "./TrashIcon";

<JsGrid
  enableRowSelection
  toolbarEnd={() => (
    <ToolbarDataTransfer
      hint="선택 항목 삭제"
      busyHint="삭제 중…"
      overlayLabel="삭제 중…"
      onTransfer={async (rows) => {
        await deleteApi(rows);
      }}
    >
      <Trash />
    </ToolbarDataTransfer>
  )}
/>
```

확인창·추가 검증은 `children`을 함수로 넘겨 `transferSelected()` 전에 처리할 수 있다.

| Prop | 적용 시점 |
|------|-----------|
| `className` | 기본 아이콘 래퍼에 항상 |
| `disabledClassName` | 선택 없음 등 클릭 불가(`not-allowed`)일 때 |
| `busyClassName` | `onTransfer` 처리 중(`wait`)일 때 |

```tsx
<ToolbarDataTransfer
  className="my-grid-delete"
  disabledClassName="my-grid-delete--disabled"
  busyClassName="my-grid-delete--busy"
  onTransfer={onDelete}
>
  <Trash />
</ToolbarDataTransfer>
```

`children`을 함수로 쓰면 클래스는 직접 `ctx.disabled` / `ctx.busy`에 맞춰 붙이면 된다.

#### `ToolbarAsyncAction`으로 감싸서 넣기 (권장)

API 호출 등 **`Promise`가 끝날 때까지** 로딩(아이콘 스피너, 필요 시 본문 블러)을 쓰려면, **커스텀 아이콘을 `ToolbarAsyncAction`으로 감싼 뒤** `toolbarStart` / `toolbarEnd`에 넣으면 됩니다.

```tsx
import JsGrid, { ToolbarAsyncAction } from "@bavuchoko/js-grid";

<JsGrid
  header={header}
  data={data}
  toolbarEnd={() => (
    <>
      <ToolbarAsyncAction
        hint="다운로드"
        busyHint="다운로드 중…"
        overlayLabel="다운로드 중…"
        onClick={async () => {
          await exportExcel();
        }}
      >
        <DownloadIcon />
      </ToolbarAsyncAction>
      <ToolbarAsyncAction hint="새로고침" onClick={onRefresh}>
        <RefreshIcon />
      </ToolbarAsyncAction>
    </>
  )}
/>
```

| `ToolbarAsyncAction` prop | 설명 |
|-------------------------|------|
| **`onClick`** | 클릭 시 실행. **`async` + `await`** 로 API가 끝날 때까지 스피너 유지 |
| **`hint`** | 평소 툴팁 (`@bavuchoko/js-tooltip`) |
| **`busyHint`** | 로딩 중 툴팁 (생략 시 `hint` 유지) |
| **`overlayLabel`** | 지정 시 본문(테이블·페이지네이션) 블러 + 가운데 문구. **생략 시 아이콘 스피너만** |
| **`accentColor`** | 스피너 색 (기본 `#2563eb`) |
| **`disabled`** | 비활성 |
| **children** | 아이콘·SVG 등 (18×18px 권장) |

- `onClick`이 **동기만** 실행되면 스피너가 거의 보이지 않을 수 있습니다.
- `overlayLabel` + 본문 블러를 쓰려면 `toolbarStart` / `toolbarEnd`를 **함수형** `() => (...)` 으로 넘기는 것을 권장합니다.

#### `ToolbarUploadAction` — Excel 업로드 패널

클릭 시 **내장과 동일한 업로드 패널**(파일 목록·Excel `accept`·다중 업로드·패널 내 업로드 버튼)이 열립니다. 예전 `onUploadFiles` prop 대신 사용합니다.

```tsx
import JsGrid, { ToolbarUploadAction, DEFAULT_EXCEL_UPLOAD_ACCEPT } from "@bavuchoko/js-grid";

<JsGrid
  header={header}
  data={data}
  toolbarEnd={() => (
    <ToolbarUploadAction
      hint="업로드"
      busyHint="업로드 중…"
      overlayLabel="업로드 중…"
      accept={DEFAULT_EXCEL_UPLOAD_ACCEPT}
      multiple={false}
      onUploadConfirm={async (files) => {
        await uploadApi(files);
      }}
    />
  )}
/>
```

| `ToolbarUploadAction` prop | 설명 |
|----------------------------|------|
| **`onUploadConfirm`** | 패널에서 업로드 확인 시 `(files: File[]) => void \| Promise<void>`. resolve 시 패널 닫힘, reject 시 패널에 오류 |
| **`accept`** | `<input accept>` (기본 Excel 허용 문자열) |
| **`multiple`** | 다중 파일 (기본 `false`) |
| **`hint` / `busyHint` / `overlayLabel`** | 툴팁·본문 블러 문구 |
| **children** | 업로드 아이콘 대체 UI (생략 시 기본 업로드 아이콘) |

`toolbarEnd`는 **함수형** `() => (...)` 으로 넘겨야 업로드 API 처리 중 본문 블러가 연동됩니다.

#### 아이콘 여러 개

개수 제한 없이, Fragment(`<>...</>`) 또는 `div`로 나열합니다.

```tsx
<JsGrid
  toolbarStart={() => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <ToolbarAsyncAction hint="검색" overlayLabel="검색 중…" onClick={onSearch}>
        <SearchIcon />
      </ToolbarAsyncAction>
      <ToolbarAsyncAction hint="새로고침" overlayLabel="새로고침 중…" onClick={onRefresh}>
        <RefreshIcon />
      </ToolbarAsyncAction>
    </div>
  )}
  toolbarEnd={() => (
    <>
      <ToolbarUploadAction onUploadConfirm={onUpload} />
      <ToolbarAsyncAction hint="필터" onClick={onFilter}>
        <FilterIcon />
      </ToolbarAsyncAction>
    </>
  )}
/>
```

- **내장**: `enableRowSelection`, `onHeaderSave` …
- **커스텀**: `ToolbarDataTransfer`, `ToolbarUploadAction`, `ToolbarAsyncAction` …
- 왼쪽·오른쪽에 나눠 넣으려면 `toolbarStart` / `toolbarEnd`를 각각 사용합니다.
- 동시에 여러 API를 돌리지 않도록, 필요하면 앱에서 클릭 가드·`disabled`를 추가하세요.

#### 로딩 없이 버튼만 넣기

**왼쪽에 필터 버튼**

```tsx
<JsGrid
  header={header}
  data={data}
  toolbarStart={
    <button type="button" onClick={() => openFilter()}>
      필터
    </button>
  }
/>
```

커스텀 영역은 클래스 `js-grid-toolbar-custom`, `js-grid-toolbar-custom-start`, `js-grid-toolbar-custom-end`로 감싸져 있어 필요 시 CSS로 간격·정렬을 조정할 수 있습니다.

#### 본문 블러만 직접 제어 (`runToolbarAction` / `setBodyOverlay`)

아이콘 UI는 직접 만들고, 테이블 블러·오버레이만 그리드에 맡길 때 (`ToolbarUploadAction`은 `setBodyOverlay`를 내부에서 사용):

```tsx
import type { JsGridToolbarApi } from "@bavuchoko/js-grid";

<JsGrid
  toolbarEnd={(api: JsGridToolbarApi) => (
    <button
      type="button"
      onClick={() =>
        void api.runToolbarAction("처리 중…", async () => {
          await myApi();
        })
      }
    >
      실행
    </button>
  )}
/>
```

패키지 export: `JsGrid`, `ToolbarAsyncAction`, `ToolbarDataTransfer`, `ToolbarUploadAction`, `DEFAULT_EXCEL_UPLOAD_ACCEPT`, `useJsGridToolbar`, `useJsGridRowSelection`, `JsGridToolbarApi`, `JsGridRowSelectionApi`, `JsGridToolbarSlot`

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
- **행 선택**: `enableRowSelection`이면 체크박스 컬럼이 나타납니다. 선택은 행 **`id`**(등) 기준이며, 데이터 재조회·페이지 변경 시 선택이 초기화됩니다. 삭제 버튼은 `ToolbarDataTransfer`를 `toolbarEnd`에 넣습니다.

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

