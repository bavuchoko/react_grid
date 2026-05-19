import type {CSSProperties} from "react";
import {GRID_BORDER} from "./gridStyles.ts";

export type JsGridTheme = "basic" | "linear";

/** 생략·`basic`은 기본 스타일, `linear`만 별도 테마. */
export function resolveJsGridTheme(theme?: JsGridTheme | string): JsGridTheme {
    return theme === "linear" ? "linear" : "basic";
}

export function gridThemeShowsBorders(theme?: JsGridTheme | string): boolean {
    return resolveJsGridTheme(theme) !== "linear";
}

export const GRID_THEME_STYLES = {
    basic: {
        toolbarBg: "#f8f8f8",
        headerBg: "#f8f8f8",
        bodyRowStripeBg: undefined as string | undefined,
    },
    linear: {
        toolbarBg: "#ffffff",
        headerBg: "#ffffff",
        bodyRowStripeBg: "#f5f5f5",
    },
} as const;

export function gridThemeStyles(theme?: JsGridTheme | string) {
    return GRID_THEME_STYLES[resolveJsGridTheme(theme)];
}

export function gridThemeCellBorders(
    theme?: JsGridTheme | string,
): Pick<CSSProperties, "borderBottom" | "borderRight"> {
    if (!gridThemeShowsBorders(theme)) {
        return { borderBottom: "none", borderRight: "none" };
    }
    return {
        borderBottom: `1px solid ${GRID_BORDER}`,
        borderRight: `1px solid ${GRID_BORDER}`,
    };
}

export function gridThemeContainerBorder(
    theme?: JsGridTheme | string,
): Pick<CSSProperties, "border" | "borderBottom"> {
    if (!gridThemeShowsBorders(theme)) {
        return { border: "none", borderBottom: "none" };
    }
    return { border: `1px solid ${GRID_BORDER}`, borderBottom: "none" };
}
