import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import type {GridCellEditorArgs, JsGridTableColumn} from "../type/Type.ts";
import {renderGridCellEditor} from "./renderGridCellEditor.tsx";

export type CellEditorSession = {
    rowIndex: number;
    columnKey: string;
    anchorRect: DOMRect;
};

type Props = {
    session: CellEditorSession;
    row: unknown;
    column: JsGridTableColumn;
    value: unknown;
    onChange: GridCellEditorArgs["onChange"];
    onClose: () => void;
};

const POPOVER_ATTR = "data-jsgrid-cell-editor";
const VIEWPORT_MARGIN = 8;

function clampToViewport(
    anchor: DOMRect,
    panel: DOMRect,
): { top: number; left: number } {
    let top = anchor.top;
    let left = anchor.left;
    if (top + panel.height > window.innerHeight - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, window.innerHeight - panel.height - VIEWPORT_MARGIN);
    }
    if (left + panel.width > window.innerWidth - VIEWPORT_MARGIN) {
        left = Math.max(VIEWPORT_MARGIN, window.innerWidth - panel.width - VIEWPORT_MARGIN);
    }
    if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    return { top, left };
}

export default function CellEditorPopover(props: Props) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const anchor = props.session.anchorRect;
    const [pos, setPos] = useState(() => ({
        top: anchor.top,
        left: anchor.left,
    }));

    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        setPos(clampToViewport(anchor, panel.getBoundingClientRect()));
    }, [anchor.top, anchor.left, anchor.width, anchor.height, props.session.rowIndex, props.column.key]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (panelRef.current?.contains(target)) return;
            props.onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") props.onClose();
        };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [props.onClose]);

    const stopRowClick = (e: unknown) => {
        if (e && typeof e === "object" && "stopPropagation" in e) {
            (e as React.SyntheticEvent).stopPropagation();
        }
    };

    const editorArgs: GridCellEditorArgs = {
        row: props.row,
        value: props.value,
        columnKey: props.column.key,
        rowIndex: props.session.rowIndex,
        onChange: props.onChange,
        onClose: props.onClose,
        stopRowClick,
    };

    const content = props.column.editor
        ? renderGridCellEditor(props.column.editor, editorArgs)
        : null;

    return createPortal(
        <div
            ref={panelRef}
            {...{ [POPOVER_ATTR]: "1" }}
            className="js-grid-cell-editor-popover"
            style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: anchor.width,
                minHeight: anchor.height,
                zIndex: 10050,
                background: "#fff",
                border: "1px solid #2563eb",
                borderRadius: 2,
                boxShadow: "0 0 0 1px rgba(37, 99, 235, 0.25)",
                padding: 0,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "stretch",
                overflow: "visible",
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="js-grid-cell-editor-popover-inner"
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 6px",
                    boxSizing: "border-box",
                }}
            >
                {content}
            </div>
        </div>,
        document.body,
    );
}
