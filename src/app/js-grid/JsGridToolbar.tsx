import type {CSSProperties, MouseEvent, RefObject} from "react";
import Fields from "../resources/icon/Fields.tsx";
import Expand from "../resources/icon/Expand.tsx";
import Shrink from "../resources/icon/Shrink.tsx";
import Export from "../resources/icon/Export.tsx";
import Trash from "../resources/icon/Trash.tsx";
import Pencil from "../resources/icon/Pencil.tsx";
import {ToolbarHint} from "@bavuchoko/js-tooltip";

type Props = {
    fieldsBtnRef: RefObject<HTMLDivElement | null>;
    onToggleFieldsMenu: (e: MouseEvent) => void;
    onTogglePseudoFullscreen: () => void;
    isPseudoFullscreen: boolean;
    onExport?: () => void;
    onCreate?: () => void;
    /** 선택된 행 삭제(콜백은 부모에서 `onDelete`와 연결) */
    onTrash?: () => void;
    trashDisabled?: boolean;
    style?: CSSProperties;
};

export default function JsGridToolbar(props: Props) {
    return (
        <div style={{background:'#f8f8f8', padding: '6px 12px', borderBottom: `1px solid #bdc2c9`, ...props.style}}>
            <div style={{display: 'flex', alignItems:'center', gap:'10px', justifyContent:'end'}}>

                {props.onCreate && (
                    <>
                        <ToolbarHint text="새 데이터 추가">
                            <Pencil
                                style={{ width: '18px', cursor: 'pointer' }}
                                onClick={() => props.onCreate?.()}
                            />
                        </ToolbarHint>

                        {(props.onTrash || props.onExport) && (
                            <div style={{borderLeft:'1px solid rgb(189, 194, 201)', height:'16px', margin:'0 4px'}} />
                        )}
                    </>
                )}

                {props.onTrash && (
                    <>
                        <ToolbarHint text={props.trashDisabled ? "삭제할 행을 선택하세요" : "선택 항목 삭제"}>
                            <Trash
                                style={{
                                    width: '18px',
                                    cursor: props.trashDisabled ? 'not-allowed' : 'pointer',
                                    opacity: props.trashDisabled ? 0.45 : 1,
                                }}
                                onClick={() => {
                                    if (props.trashDisabled) return;
                                    props.onTrash?.();
                                }}
                            />
                        </ToolbarHint>

                        <div style={{borderLeft:'1px solid rgb(189, 194, 201)', height:'16px', margin:'0 4px'}} />
                    </>
                )}

                {props.onExport && (
                    <>
                        <ToolbarHint text="엑셀(XLS) 보내기">
                            <Export
                                style={{width: '18px', cursor: 'pointer'}}
                                onClick={() => props.onExport?.()}
                            />
                        </ToolbarHint>

                        <div style={{borderLeft:'1px solid rgb(189, 194, 201)', height:'16px', margin:'0 4px'}} />
                    </>
                )}

                <ToolbarHint text="컬럼 보이기/숨기기 및 순서 변경">
                    <div
                        ref={props.fieldsBtnRef}
                        style={{ display: 'inline-flex', alignItems: 'center' }}
                        onClick={props.onToggleFieldsMenu}
                    >
                        <Fields style={{width:'18px', cursor: 'pointer'}}/>
                    </div>
                </ToolbarHint>

                {props.isPseudoFullscreen ? (
                    <ToolbarHint text="전체 화면 종료">
                        <Shrink
                            style={{width:'18px', cursor: 'pointer'}}
                            onClick={props.onTogglePseudoFullscreen}
                        />
                    </ToolbarHint>
                ) : (
                    <ToolbarHint text="전체 화면">
                        <Expand
                            style={{width:'18px', cursor: 'pointer'}}
                            onClick={props.onTogglePseudoFullscreen}
                        />
                    </ToolbarHint>
                )}
            </div>
        </div>
    );
}
