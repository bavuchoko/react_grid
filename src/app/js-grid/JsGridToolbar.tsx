import {useId} from "react";
import type {CSSProperties, MouseEvent, RefObject} from "react";
import Fields from "../resources/icon/Fields.tsx";
import Expand from "../resources/icon/Expand.tsx";
import Shrink from "../resources/icon/Shrink.tsx";
import Trash from "../resources/icon/Trash.tsx";
import Pencil from "../resources/icon/Pencil.tsx";
import {ToolbarHint} from "@bavuchoko/js-tooltip";
import DownLoad from "../resources/icon/DownLoad.tsx";
import Upload from "../resources/icon/Upload.tsx";
import ColumnLock from "../resources/icon/ColumnLock.tsx";
import {gridThemeShowsBorders, gridThemeStyles, resolveJsGridTheme, type JsGridTheme} from "./gridTheme.ts";

type Props = {
    fieldsBtnRef: RefObject<HTMLDivElement | null>;
    onToggleFieldsMenu: (e: MouseEvent) => void;
    onTogglePseudoFullscreen: () => void;
    isPseudoFullscreen: boolean;
    enablePseudoFullscreen?: boolean;
    onDownLoadClick?: () => void;
    uploadBtnRef?: RefObject<HTMLDivElement | null>;
    /** 업로드 아이콘 클릭 — 부모에서 첨부 패널 표시 여부 등 처리 */
    onToggleUploadPanel?: (e: MouseEvent) => void;
    /** 패널에서 업로드 요청 처리 중일 때 툴바에 로딩 표시 */
    uploadBusy?: boolean;
    onCreateClick?: () => void;
    /** 선택된 행 삭제(콜백은 부모에서 `onDelete`와 연결) */
    onTrashClick?: () => void;
    trashBusy?: boolean;
    trashDisabled?: boolean;
    /** `onHeaderSave`를 넘긴 경우에만 컬럼(필드) 메뉴 버튼을 표시한다. */
    showColumnFieldsMenu?: boolean;
    theme?: JsGridTheme | string;
    style?: CSSProperties;
};

export default function JsGridToolbar({
    fieldsBtnRef,
    onToggleFieldsMenu,
    onTogglePseudoFullscreen,
    isPseudoFullscreen,
    enablePseudoFullscreen,
    onDownLoadClick,
    uploadBtnRef,
    onToggleUploadPanel,
    uploadBusy,
    onCreateClick,
    onTrashClick,
    trashBusy,
    trashDisabled,
    showColumnFieldsMenu = false,
    theme,
    style,
}: Props) {
    const themeStyles = gridThemeStyles(theme);
    const showBorders = gridThemeShowsBorders(theme);
    const showPseudoFullscreen = enablePseudoFullscreen !== false;
    const uploadSpinClass = useId().replace(/:/g, "");
    const trashSpinClass = useId().replace(/:/g, "");

    return (
        <div
            className={`js-grid-toolbar js-grid-theme-${resolveJsGridTheme(theme)}`}
            style={{
                backgroundColor: themeStyles.toolbarBg,
                padding: '6px 12px',
                borderBottom: '1px solid #bdc2c9',
                userSelect: "none",
                cursor: "default",
                flexShrink: 0,
                ...style,
            }}
        >
            <style>{`
                @keyframes jsgrid-toolbar-spin-${uploadSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-spin-dot-${uploadSpinClass} {
                    animation: jsgrid-toolbar-spin-${uploadSpinClass} 0.75s linear infinite;
                }
                @keyframes jsgrid-toolbar-spin-${trashSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-spin-dot-${trashSpinClass} {
                    animation: jsgrid-toolbar-spin-${trashSpinClass} 0.75s linear infinite;
                }
            `}</style>
            <div className="js-grid-toolbar-inner" style={{display: 'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div className="js-grid-toolbar-start" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ToolbarHint text="헤더 고정 : alt + 헤더 클릭">
                        <ColumnLock style={{ width: '18px', cursor: 'default', opacity: 0.75 }} />
                    </ToolbarHint>
                </div>

                <div className="js-grid-toolbar-actions" style={{display: 'flex', alignItems:'center', gap:'16px', justifyContent:'end'}}>

                {onCreateClick && (
                    <>
                        <ToolbarHint text="새 데이터 추가">
                            <Pencil
                                style={{ width: '18px', cursor: 'pointer' }}
                                onClick={() => onCreateClick()}
                            />
                        </ToolbarHint>

                    </>
                )}

                {(onToggleUploadPanel || onDownLoadClick) && (
                    <>
                        {onToggleUploadPanel && uploadBtnRef && (
                            <ToolbarHint text={uploadBusy ? "업로드 중…" : "업로드"}>
                                <div
                                    ref={uploadBtnRef}
                                    style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 18,
                                        height: 18,
                                        cursor: uploadBusy ? "wait" : "pointer",
                                    }}
                                    onClick={(e) => {
                                        if (uploadBusy) {
                                            e.stopPropagation();
                                            return;
                                        }
                                        onToggleUploadPanel(e);
                                    }}
                                >
                                    <Upload
                                        style={{
                                            width: "18px",
                                            cursor: uploadBusy ? "wait" : "pointer",
                                            opacity: uploadBusy ? 0.35 : 1,
                                            flexShrink: 0,
                                        }}
                                        aria-busy={uploadBusy ?? false}
                                        aria-live={uploadBusy ? "polite" : undefined}
                                    />
                                    {uploadBusy ? (
                                        <span
                                            className={`jsgrid-toolbar-spin-dot-${uploadSpinClass}`}
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                margin: "auto",
                                                width: 14,
                                                height: 14,
                                                borderRadius: "50%",
                                                border: "2px solid #e5e7eb",
                                                borderTopColor: "#2563eb",
                                                boxSizing: "border-box",
                                                pointerEvents: "none",
                                            }}
                                            aria-hidden
                                        />
                                    ) : null}
                                </div>
                            </ToolbarHint>
                        )}
                        {onDownLoadClick && (
                            <ToolbarHint text="다운로드">
                                <DownLoad
                                    style={{width: '18px', cursor: 'pointer'}}
                                    onClick={() => onDownLoadClick()}
                                />
                            </ToolbarHint>
                        )}


                    </>
                )}

                {onTrashClick && (
                    <>
                        <ToolbarHint text={trashBusy ? "삭제 중…" : (trashDisabled ? "삭제할 행을 선택하세요" : "선택 항목 삭제")}>
                            <div
                                style={{
                                    position: "relative",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 18,
                                    height: 18,
                                    cursor: (trashDisabled || trashBusy) ? "wait" : "pointer",
                                }}
                            >
                                <Trash
                                    style={{
                                        width: '18px',
                                        cursor: (trashDisabled || trashBusy) ? 'not-allowed' : 'pointer',
                                        opacity: (trashDisabled || trashBusy) ? 0.45 : 1,
                                        flexShrink: 0,
                                    }}
                                    onClick={() => {
                                        if (trashDisabled || trashBusy) return;
                                        onTrashClick();
                                    }}
                                />
                                {trashBusy ? (
                                    <span
                                        className={`jsgrid-toolbar-spin-dot-${trashSpinClass}`}
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            margin: "auto",
                                            width: 14,
                                            height: 14,
                                            borderRadius: "50%",
                                            border: "2px solid #e5e7eb",
                                            borderTopColor: "#ef4444",
                                            boxSizing: "border-box",
                                            pointerEvents: "none",
                                        }}
                                        aria-hidden
                                    />
                                ) : null}
                            </div>
                        </ToolbarHint>

                    </>
                )}
                {showColumnFieldsMenu ? (
                    <>
                        <div style={{borderLeft: showBorders ? '1px solid rgb(189, 194, 201)' : 'none', height:'16px', margin:'0 2px'}} />
                        <div ref={fieldsBtnRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <ToolbarHint text="컬럼 보이기/숨기기 및 순서 변경">
                                <div
                                    style={{ display: 'inline-flex', alignItems: 'center' }}
                                    onClick={onToggleFieldsMenu}
                                >
                                    <Fields style={{width:'18px', cursor: 'pointer'}}/>
                                </div>
                            </ToolbarHint>
                        </div>
                    </>
                ) : null}

                {showPseudoFullscreen && (
                    isPseudoFullscreen ? (
                        <ToolbarHint text="전체 화면 종료">
                            <Shrink
                                style={{width:'18px', cursor: 'pointer'}}
                                onClick={onTogglePseudoFullscreen}
                            />
                        </ToolbarHint>
                    ) : (
                        <ToolbarHint text="전체 화면">
                            <Expand
                                style={{width:'18px', cursor: 'pointer'}}
                                onClick={onTogglePseudoFullscreen}
                            />
                        </ToolbarHint>
                    )
                )}
                </div>
            </div>
        </div>
    );
}
