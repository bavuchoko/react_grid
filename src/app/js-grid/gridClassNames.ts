import type { JsGridTableColumn } from "../type/Type.ts";

export function gridColClassNames(
    cdex: number,
    column: Pick<JsGridTableColumn, "__checkbox__" | "__rownum__">,
    role: "th" | "td",
): string {
    const parts = [
        role === "th" ? "js-grid-th" : "js-grid-row",
        "js-grid-cell",
        "js-grid-col",
        `js-grid-col-${cdex}`,
    ];
    if (column.__checkbox__) parts.push("js-grid-chk");
    if (column.__rownum__) parts.push("js-grid-idx");
    return parts.join(" ");
}

export function bodyRowClassName(
    rdex: number,
    rowId?: string | number | null,
    extra?: string,
): string {
    const parts = ["js-grid-body-row", `js-grid-row-idx-${rdex}`];
    if (rowId !== undefined && rowId !== null && String(rowId) !== "") {
        parts.push(`js-grid-row-id-${rowId}`);
    }
    if (extra) parts.push(extra);
    return parts.join(" ");
}

export function bodyCellStateClassNames(opts: {
    borderClass?: string;
    selectable: boolean;
    hasEditor: boolean;
    isSelected: boolean;
    isEditing: boolean;
}): string {
    const parts: string[] = [];
    if (opts.borderClass) parts.push(opts.borderClass);
    if (opts.selectable) parts.push("js-grid-cell-selectable");
    if (opts.hasEditor) parts.push("js-grid-cell-editable");
    if (opts.isSelected) parts.push("js-grid-cell-selected");
    if (opts.isEditing) parts.push("js-grid-cell-editing");
    return parts.join(" ");
}
