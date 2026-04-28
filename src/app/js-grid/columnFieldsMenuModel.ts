import type {HeaderState} from "../type/Type.ts";

export type UserColumn = { key: string; label: string; visible: boolean };

export function toHeaderState(userColumns: UserColumn[]): HeaderState[] {
    return userColumns.map((c) => ({ key: c.key, label: c.label, visible: c.visible }));
}
