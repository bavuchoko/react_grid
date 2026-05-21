import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ToolbarHint } from "@bavuchoko/js-tooltip";
import Upload from "../resources/icon/Upload.tsx";
import { DEFAULT_EXCEL_UPLOAD_ACCEPT } from "./excelUploadConstraints.ts";
import { useJsGridToolbar } from "./JsGridToolbarContext.tsx";
import UploadFilePanel from "./UploadFilePanel.tsx";

type Props = {
    /** 패널에서 업로드 확인 시 호출. resolve 시 패널이 닫힌다. reject 시 패널에 오류 표시. */
    onUploadConfirm: (files: File[]) => void | Promise<void>;
    accept?: string;
    multiple?: boolean;
    hint?: string;
    busyHint?: string;
    /** 업로드 API 처리 중 본문 오버레이 문구 (기본 「업로드 중…」) */
    overlayLabel?: string;
    accentColor?: string;
    disabled?: boolean;
    children?: ReactNode;
};

export default function ToolbarUploadAction({
    onUploadConfirm,
    accept = DEFAULT_EXCEL_UPLOAD_ACCEPT,
    multiple = false,
    hint = "업로드",
    busyHint = "업로드 중…",
    overlayLabel = "업로드 중…",
    accentColor = "#2563eb",
    disabled,
    children,
}: Props) {
    const toolbarApi = useJsGridToolbar();
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
    const [uploadBusy, setUploadBusy] = useState(false);
    const spinClass = useId().replace(/:/g, "");

    const syncBodyOverlay = useCallback(
        (busy: boolean) => {
            toolbarApi?.setBodyOverlay(
                busy ? { label: overlayLabel, accent: accentColor } : null,
            );
        },
        [toolbarApi, overlayLabel, accentColor],
    );

    useEffect(() => () => syncBodyOverlay(false), [syncBodyOverlay]);

    const handleBusyChange = useCallback(
        (busy: boolean) => {
            setUploadBusy(busy);
            syncBodyOverlay(busy);
        },
        [syncBodyOverlay],
    );

    const togglePanel = useCallback(
        (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            if (disabled || uploadBusy) return;
            if (open) {
                setOpen(false);
                return;
            }
            const rect = anchorRef.current?.getBoundingClientRect();
            if (rect) {
                setPos({
                    top: rect.bottom + 8,
                    right: window.innerWidth - rect.right,
                });
            }
            setOpen(true);
        },
        [disabled, uploadBusy, open],
    );

    useEffect(() => {
        if (!open) return;

        const onDown = (e: MouseEvent) => {
            if (uploadBusy) return;
            const target = e.target as Node | null;
            if (!target) return;
            if (anchorRef.current?.contains(target)) return;
            const panelEl = document.querySelector('[data-jsgrid-upload-panel="1"]');
            if (panelEl?.contains(target)) return;
            setOpen(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (uploadBusy) return;
            if (e.key === "Escape") setOpen(false);
        };

        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, uploadBusy]);

    const tooltip = uploadBusy ? busyHint : hint;

    return (
        <>
            <style>{`
                @keyframes jsgrid-toolbar-upload-spin-${spinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-upload-spin-${spinClass} {
                    animation: jsgrid-toolbar-upload-spin-${spinClass} 0.75s linear infinite;
                }
            `}</style>
            <ToolbarHint text={tooltip}>
                <div
                    ref={anchorRef}
                    data-jsgrid-upload-anchor="1"
                    style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        cursor: disabled || uploadBusy ? "wait" : "pointer",
                    }}
                    onClick={togglePanel}
                    aria-busy={uploadBusy}
                    aria-expanded={open}
                >
                    <span
                        style={{
                            display: "inline-flex",
                            opacity: uploadBusy ? 0.35 : 1,
                            lineHeight: 0,
                        }}
                    >
                        {children ?? (
                            <Upload
                                style={{
                                    width: "18px",
                                    cursor: disabled || uploadBusy ? "wait" : "pointer",
                                    flexShrink: 0,
                                }}
                            />
                        )}
                    </span>
                    {uploadBusy ? (
                        <span
                            className={`jsgrid-toolbar-upload-spin-${spinClass}`}
                            style={{
                                position: "absolute",
                                inset: 0,
                                margin: "auto",
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                border: "2px solid #e5e7eb",
                                borderTopColor: accentColor,
                                boxSizing: "border-box",
                                pointerEvents: "none",
                            }}
                            aria-hidden
                        />
                    ) : null}
                </div>
            </ToolbarHint>
            <UploadFilePanel
                open={open}
                pos={pos}
                accept={accept}
                multiple={multiple}
                onBusyChange={handleBusyChange}
                onUploadConfirm={onUploadConfirm}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
