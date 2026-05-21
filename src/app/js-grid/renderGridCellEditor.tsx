import React, {isValidElement, type ReactNode} from "react";
import type {GridCellEditor, GridCellEditorArgs} from "../type/Type.ts";

export function renderGridCellEditor(
    editor: GridCellEditor,
    args: GridCellEditorArgs,
): ReactNode {
    if (typeof editor === "function") {
        return editor(args);
    }
    if (isValidElement(editor)) {
        return React.cloneElement(editor as React.ReactElement<Record<string, unknown>>, {
            row: args.row,
            value: args.value,
            columnKey: args.columnKey,
            rowIndex: args.rowIndex,
            onChange: args.onChange,
            onClose: args.onClose,
            stopRowClick: args.stopRowClick,
        });
    }
    return editor;
}
