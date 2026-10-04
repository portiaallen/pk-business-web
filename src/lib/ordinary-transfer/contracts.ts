/** PK-owned protocol, not a Cloudflare API. Storage credentials never cross this contract to browsers. */
export type ObjectState = {
    size: number;
    mime: string;
    digest: string;
};
export interface TransferProvider {
    readonly endpoint: string;
    verifyObjectState(key: string): Promise<ObjectState | null>;
    requestDelete(key: string): Promise<void>;
}
export type TransferLease = {
    id: string;
    key: string;
    operation: string;
    size: number;
    mime: string;
    origin: string;
};
export interface TransferAuthority {
    claim(token: string, origin: string): Promise<TransferLease>;
    finish(token: string, state: ObjectState): Promise<void>;
    fail(token: string): Promise<void>;
    auditDownload(token: string): Promise<void>;
}
export interface PrivateTransferStorage {
    putIfAbsent(key: string, bytes: Uint8Array, state: ObjectState): Promise<void>;
    read(key: string): Promise<Uint8Array | null>;
    stat(key: string): Promise<ObjectState | null>;
    /** Deletion must fence future writes of this key; an interrupted upload must not resurrect it. */
    remove(key: string): Promise<void>;
}
