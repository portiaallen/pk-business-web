import { isHostedRuntime } from '@/lib/security-environment';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { OrdinaryTransferIntent, Prisma } from '@/generated/prisma/client';
import { getSessionUser, getSessionTokenFromRequest, getTransferSessionUser, requireRecentAuthentication, sessionValid, hasClientMemberRole, type SessionUser } from '@/lib/auth';
import { requireRequestAccess, grantMatches, type Capability } from '@/lib/capabilities';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/storage';
import { safeAuditMetadata, logSecurityEvent } from '@/lib/security-log';
import { ApiError } from '@/lib/api-error';
import { getTransferProvider } from './provider';
import type { ObjectState } from './contracts';
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const inputSchema = z.object({ operation: z.enum(['UPLOAD', 'DOWNLOAD', 'DELETE']), kind: z.enum(['DOCUMENT', 'DELIVERABLE']), requestId: identifier.optional(), resourceId: identifier.optional(), size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES).optional(), mime: z.string().max(120).optional(), fileName: z.string().max(255).optional(), category: z.enum(['IDENTITY', 'INCOME', 'EMPLOYMENT', 'BUSINESS', 'TAX', 'BANKING', 'OTHER']).optional(), title: z.string().trim().min(1).max(200).optional(), documentRequestId: identifier.optional() }).strict();
export type TransferInput = z.infer<typeof inputSchema>;
export const transferHash = (token: string) => createHash('sha256').update('pk-ordinary-transfer:' + token).digest('hex');
export function safeFileName(value: string) { return value.replace(/\\/g, '/').split('/').pop()!.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'PK-document'; }
async function assertFresh(tx: Prisma.TransactionClient, row: OrdinaryTransferIntent) {
    const session = await tx.session.findUnique({ where: { id: row.sessionId }, include: { user: true } });
    const engagement = await tx.verificationRequest.findUnique({ where: { id: row.requestId }, include: { client: true } });
    if (!session || !sessionValid(session) || session.userId !== row.userId || session.securityVersion !== row.securityVersion || !engagement || engagement.clientId !== row.clientId || engagement.client.status !== 'ACTIVE')
        throw ApiError.unauthorized();
    if (session.user.role === 'CLIENT') {
        const members = await tx.clientMember.findMany({ where: { userId: row.userId }, take: 2 });
        const selected = session.activeClientId || (members.length === 1 ? members[0].clientId : null);
        const member = await tx.clientMember.findUnique({ where: { clientId_userId: { clientId: row.clientId, userId: row.userId } } });
        if (selected !== row.clientId || !member || (row.operation !== 'DOWNLOAD' && !hasClientMemberRole(member.role, 'STAFF')) || (row.kind === 'DELIVERABLE' && row.operation !== 'DOWNLOAD'))
            throw ApiError.forbidden();
    }
    else {
        if (session.activeClientId !== row.clientId)
            throw ApiError.forbidden();
        const grants = await tx.capabilityGrant.findMany({ where: { userId: row.userId } });
        const required: Capability[] = ['confidential_access'];
        if (row.operation === 'UPLOAD' && row.kind === 'DELIVERABLE')
            required.push('bookkeeping');
        if (row.operation === 'DELETE') {
            required.push('disposal');
            if (session.user.role !== 'ADMIN' || !session.mfaVerifiedAt || !session.passwordVerifiedAt || Date.now() - session.mfaVerifiedAt.getTime() > 300000 || Date.now() - session.passwordVerifiedAt.getTime() > 300000)
                throw ApiError.forbidden();
        }
        if (required.some(capability => !grants.some(grant => grantMatches(grant, capability, row.clientId, row.requestId))))
            throw ApiError.forbidden();
    }
    if (row.resourceId && row.operation !== 'UPLOAD') {
        const doc = row.kind === 'DOCUMENT' ? await tx.document.findUnique({ where: { id: row.resourceId } }) : await tx.deliverable.findUnique({ where: { id: row.resourceId } });
        if (!doc || doc.requestId !== row.requestId || (row.operation === 'DELETE' && doc.ordinaryLegalHold) || (row.operation === 'DOWNLOAD' && (doc.transferDeleteState !== 'NONE' || ('retentionStatus' in doc && (doc.retentionStatus !== 'ACTIVE' || doc.uploadStatus !== 'UPLOADED')) || (session.user.role === 'CLIENT' && 'visibility' in doc && doc.visibility !== 'RELEASED'))))
            throw ApiError.notFound();
    }
}
async function audit(tx: Prisma.TransactionClient, row: OrdinaryTransferIntent, action: string) {
    await tx.auditLog.create({ data: { actorId: row.userId, clientId: row.clientId, action: 'ADMIN_ACTION', resource: 'ordinary-transfer', resourceId: row.id, metadata: safeAuditMetadata({ action, requestId: row.requestId, size: row.size }) } });
}
async function resource(kind: string, id: string) {
    if (kind === 'DOCUMENT') {
        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc)
            return null;
        return { ...doc, live: doc.uploadStatus === 'UPLOADED' && doc.retentionStatus === 'ACTIVE' && doc.transferDeleteState === 'NONE', released: true, size: doc.fileSizeBytes, mime: doc.mimeType };
    }
    const doc = await prisma.deliverable.findUnique({ where: { id } });
    if (!doc)
        return null;
    return { ...doc, live: doc.transferDeleteState === 'NONE', released: doc.visibility === 'RELEASED', size: doc.fileSizeBytes, mime: doc.mimeType };
}
async function authorize(user: SessionUser, row: Pick<OrdinaryTransferIntent, 'requestId' | 'clientId' | 'operation' | 'kind' | 'resourceId'> & {
    status?: string;
}, deleting = false) {
    const engagement = await prisma.verificationRequest.findUnique({ where: { id: row.requestId }, include: { client: true } });
    if (!engagement || engagement.clientId !== row.clientId || engagement.client.status !== 'ACTIVE')
        throw ApiError.notFound();
    if (user.role === 'CLIENT') {
        const members = await prisma.clientMember.findMany({ where: { userId: user.id }, take: 2 });
        const selected = user.activeClientId || (members.length === 1 ? members[0].clientId : null);
        if (selected !== row.clientId)
            throw ApiError.notFound();
        const member = await prisma.clientMember.findUnique({ where: { clientId_userId: { clientId: row.clientId, userId: user.id } } });
        if (!member || (row.operation !== 'DOWNLOAD' && !hasClientMemberRole(member.role, 'STAFF')) || (row.kind === 'DELIVERABLE' && row.operation !== 'DOWNLOAD'))
            throw ApiError.forbidden();
    }
    else {
        if (user.activeClientId !== row.clientId)
            throw ApiError.notFound();
        await requireRequestAccess(user, row.requestId);
        if (row.operation === 'UPLOAD' && row.kind === 'DELIVERABLE')
            await requireRequestAccess(user, row.requestId, 'bookkeeping');
        if (deleting) {
            if (user.role !== 'ADMIN')
                throw ApiError.forbidden();
            requireRecentAuthentication(user);
            await requireRequestAccess(user, row.requestId, 'disposal');
        }
    }
    if (row.resourceId) {
        const doc = await resource(row.kind, row.resourceId);
        if (!doc || doc.requestId !== row.requestId || (!doc.live && (!deleting || (row.status !== 'DELETE_PENDING' && doc.transferDeleteState !== 'PENDING'))) || (user.role === 'CLIENT' && row.kind === 'DELIVERABLE' && !doc.released))
            throw ApiError.notFound();
        if (deleting && doc.ordinaryLegalHold)
            throw ApiError.conflict('Document is on hold');
    }
}
async function current(row: OrdinaryTransferIntent, deleting = false) {
    const user = await getTransferSessionUser(row.sessionId);
    if (!user || user.id !== row.userId || user.securityVersion !== row.securityVersion)
        throw ApiError.unauthorized();
    await authorize(user, row, deleting);
    return user;
}
export async function createIntent(request: Request, input: unknown) {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user)
        throw ApiError.unauthorized();
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw ApiError.badRequest('Invalid transfer request');
    const data = parsed.data;
    const origin = new URL(request.url).origin;
    if (request.headers.get('origin') !== origin || (isHostedRuntime() && origin !== process.env.PK_WEBAUTHN_ORIGIN?.trim()))
        throw ApiError.forbidden();
    let requestId = data.requestId;
    let objectKey: string = randomUUID();
    let size = data.size;
    let mime = data.mime;
    if (data.operation !== 'UPLOAD') {
        if (!data.resourceId)
            throw ApiError.badRequest('Document is required');
        const doc = await resource(data.kind, data.resourceId);
        if (!doc)
            throw ApiError.notFound();
        if (requestId && requestId !== doc.requestId)
            throw ApiError.notFound();
        requestId = doc.requestId;
        objectKey = doc.storageKey;
        size = doc.size;
        mime = doc.mime;
    }
    if (!requestId || !size || size > MAX_FILE_SIZE_BYTES || !mime || !ALLOWED_MIME_TYPES.has(mime) || (data.operation === 'UPLOAD' && (!data.fileName || (data.kind === 'DELIVERABLE' && !data.title))))
        throw ApiError.badRequest('Invalid file metadata');
    const engagement = await prisma.verificationRequest.findUnique({ where: { id: requestId }, select: { clientId: true } });
    if (!engagement)
        throw ApiError.notFound();
    const grant = { requestId, clientId: engagement.clientId, operation: data.operation, kind: data.kind, resourceId: data.resourceId || null };
    await authorize(user, grant, data.operation === 'DELETE');
    if (data.documentRequestId) {
        if (data.kind !== 'DOCUMENT' || data.operation !== 'UPLOAD')
            throw ApiError.badRequest();
        const docRequest = await prisma.documentRequest.findUnique({ where: { id: data.documentRequestId } });
        if (!docRequest || docRequest.requestId !== requestId)
            throw ApiError.notFound();
    }
    if (await prisma.ordinaryTransferIntent.count({ where: { userId: user.id, status: { in: ['PENDING', 'PROCESSING', 'STORED'] }, expiresAt: { gt: new Date() } } }) >= 50)
        throw new ApiError(429, 'Too many pending transfers');
    const provider = getTransferProvider();
    const token = randomBytes(48).toString('base64url');
    const row = await prisma.$transaction(async (tx) => {
        const row = await tx.ordinaryTransferIntent.create({ data: { id: randomUUID(), tokenHash: transferHash(token), userId: user.id, sessionId: user.sessionId, securityVersion: user.securityVersion, ...grant, objectKey, size, mime, origin, fileName: safeFileName(data.fileName || 'PK-document'), title: data.title, category: data.category || 'OTHER', documentRequestId: data.documentRequestId, expiresAt: new Date(Date.now() + 120000) } });
        await assertFresh(tx, row);
        await audit(tx, row, 'TRANSFER_INTENT_CREATED');
        return row;
    });
    if (data.operation === 'DELETE') {
        await requestDelete(row.id, user);
        return { intentId: row.id, status: (await prisma.ordinaryTransferIntent.findUniqueOrThrow({where:{id:row.id}})).status };
    }
    return { intentId: row.id, endpoint: provider.endpoint, authorization: 'Bearer ' + token, size, mime, expiresAt: row.expiresAt.toISOString() };
}
async function tokenRow(token: string) {
    if (!/^[A-Za-z0-9_-]{64}$/.test(token))
        throw ApiError.notFound();
    const row = await prisma.ordinaryTransferIntent.findUnique({ where: { tokenHash: transferHash(token) } });
    if (!row || row.expiresAt <= new Date())
        throw ApiError.notFound();
    return row;
}
export async function claim(token: string, origin: string) {
    const row = await tokenRow(token);
    if (row.status !== 'PENDING' || row.origin !== origin || row.operation === 'DELETE')
        throw ApiError.notFound();
    await current(row);
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.ordinaryTransferIntent.updateMany({ where: { id: row.id, status: 'PENDING', expiresAt: { gt: new Date() } }, data: { status: 'PROCESSING' } });
        if (claimed.count !== 1)
            throw ApiError.notFound();
        await assertFresh(tx, row);
        await audit(tx, row, 'TRANSFER_STARTED');
    });
    return { id: row.id, key: row.objectKey, operation: row.operation, size: row.size, mime: row.mime, origin: row.origin };
}
export async function finish(token: string, state: ObjectState) {
    const row = await tokenRow(token);
    if (row.status !== 'PROCESSING' || row.operation !== 'UPLOAD')
        throw ApiError.notFound();
    await current(row);
    const verified = await getTransferProvider().verifyObjectState(row.objectKey);
    if (!verified || verified.size !== row.size || verified.mime !== row.mime || verified.digest !== state.digest || !/^[a-f0-9]{64}$/.test(verified.digest))
        throw ApiError.conflict('File verification failed');
    await prisma.$transaction(async (tx) => {
        const updated = await tx.ordinaryTransferIntent.updateMany({ where: { id: row.id, status: 'PROCESSING', expiresAt: { gt: new Date() } }, data: { status: 'STORED', digest: verified.digest } });
        if (updated.count !== 1)
            throw ApiError.notFound();
        await assertFresh(tx, row);
        await audit(tx, row, 'TRANSFER_BYTES_VERIFIED');
    });
}
export async function confirmUpload(request: Request, id: string) {
    const user = await getSessionUser(getSessionTokenFromRequest(request));
    if (!user)
        throw ApiError.unauthorized();
    const row = await prisma.ordinaryTransferIntent.findUnique({ where: { id } });
    if (!row || row.userId !== user.id || row.sessionId !== user.sessionId || row.operation !== 'UPLOAD' || row.status !== 'STORED' || row.expiresAt <= new Date())
        throw ApiError.notFound();
    await current(row);
    const state = await getTransferProvider().verifyObjectState(row.objectKey);
    if (!state || state.digest !== row.digest || state.size !== row.size || state.mime !== row.mime)
        throw ApiError.conflict('File verification failed');
    return prisma.$transaction(async (tx) => {
        const claimed = await tx.ordinaryTransferIntent.updateMany({ where: { id, status: 'STORED', expiresAt: { gt: new Date() } }, data: { status: 'COMPLETE' } });
        if (claimed.count !== 1)
            throw ApiError.notFound();
        const data = { requestId: row.requestId, fileName: row.fileName, mimeType: row.mime, fileSizeBytes: row.size, storageKey: row.objectKey };
        const doc = row.kind === 'DOCUMENT' ? await tx.document.create({ data: { ...data, category: row.category as 'OTHER', uploadStatus: 'UPLOADED', uploadedAt: new Date() } }) : await tx.deliverable.create({ data: { ...data, title: row.title!, uploadedById: row.userId } });
        if (row.documentRequestId) {
            const linked = await tx.documentRequest.updateMany({ where: { id: row.documentRequestId, requestId: row.requestId }, data: { status: 'UPLOADED', documentId: doc.id, reviewedAt: new Date() } });
            if (linked.count !== 1)
                throw ApiError.notFound();
        }
        await tx.ordinaryTransferIntent.update({ where: { id }, data: { resourceId: doc.id, fileName:'PK-document', title:null } });
        await assertFresh(tx, row);
        await audit(tx, row, 'TRANSFER_METADATA_CONFIRMED');
        await tx.auditLog.create({data:{actorId:row.userId,clientId:row.clientId,action:row.kind==='DOCUMENT'?'DOCUMENT_UPLOADED':'DELIVERABLE_UPLOADED',resource:row.kind==='DOCUMENT'?'document':'deliverable',resourceId:doc.id,metadata:safeAuditMetadata({requestId:row.requestId,size:row.size})}});
        return { id:doc.id,fileName:doc.fileName,...('title' in doc?{title:doc.title,visibility:doc.visibility}:{status:doc.uploadStatus}) };
    });
}
export async function auditDownload(token: string) {
    const row = await tokenRow(token);
    if (row.status !== 'PROCESSING' || row.operation !== 'DOWNLOAD')
        throw ApiError.notFound();
    await current(row);
    await prisma.$transaction(async (tx) => { const changed = await tx.ordinaryTransferIntent.updateMany({ where: { id: row.id, status: 'PROCESSING', expiresAt: { gt: new Date() } }, data: { status: 'COMPLETE' } }); if (changed.count !== 1)
        throw ApiError.notFound(); await assertFresh(tx, row); await audit(tx, row, 'TRANSFER_DOWNLOAD'); });
}
export async function fail(token: string) {
    const row = await prisma.ordinaryTransferIntent.findUnique({ where: { tokenHash: transferHash(token) } });
    if (!row || row.status === 'COMPLETE')
        return;
    await prisma.$transaction(async (tx) => { await tx.ordinaryTransferIntent.updateMany({ where: { id: row.id, status: { in: ['PENDING', 'PROCESSING', 'STORED'] } }, data: { status: 'FAILED' } }); await audit(tx, row, 'TRANSFER_FAILED'); });
}
async function requestDelete(id: string, user: SessionUser) {
    const row = await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id } });
    await authorize(user, row, true);
    await prisma.$transaction(async (tx) => {
        if (row.kind === 'DOCUMENT')
            await tx.document.update({ where: { id: row.resourceId! }, data: { retentionStatus: 'DELETED', uploadStatus: 'FAILED', transferDeleteState: 'PENDING' } });
        else
            await tx.deliverable.update({ where: { id: row.resourceId! }, data: { visibility: 'DRAFT', transferDeleteState: 'PENDING' } });
        await tx.ordinaryTransferIntent.update({ where: { id }, data: { status: 'DELETE_PENDING' } });
        await assertFresh(tx, row);
        await audit(tx, row, 'TRANSFER_DELETE_REQUESTED');
    });
    // Completion is never reported until storage verifies absence; failures remain retryable.
    try {
        await reconcileIntent(row.id);
    }
    catch { logSecurityEvent('TRANSFER_FAILURE'); /* pending state, not false success */ }
}
export async function reconcileIntent(id: string) {
    const row = await prisma.ordinaryTransferIntent.findUniqueOrThrow({ where: { id } });
    if (row.status !== 'DELETE_PENDING' && !(row.operation === 'UPLOAD' && row.expiresAt <= new Date() && !['COMPLETE','EXPIRED'].includes(row.status)))
        return;
    if (row.status === 'DELETE_PENDING') {
        await current(row, true);
        const doc = await resource(row.kind, row.resourceId!);
        if (doc?.ordinaryLegalHold)
            throw ApiError.conflict('Document is on hold');
    }
    const provider = getTransferProvider();
    // Serialize final hold/state checks and verified deletion with competing metadata writes.
    // Storage deletion is idempotent and fenced; a transaction/audit failure leaves DELETE_PENDING.
    await prisma.$transaction(async (tx) => {
        const locked = await tx.ordinaryTransferIntent.updateMany({where:{id,status:row.status},data:{status:'RECONCILING'}});
        if(locked.count !== 1) throw ApiError.conflict('Reconciliation is pending');
        if(row.status === 'DELETE_PENDING') await assertFresh(tx,row);
        await provider.requestDelete(row.objectKey);
        if(await provider.verifyObjectState(row.objectKey) !== null) throw new ApiError(503,'Deletion verification is pending');
        if (row.status === 'DELETE_PENDING') {
            if (row.kind === 'DOCUMENT')
                await tx.document.update({ where: { id: row.resourceId! }, data: { transferDeleteState: 'COMPLETE', fileName: 'Deleted document' } });
            else
                await tx.deliverable.update({ where: { id: row.resourceId! }, data: { transferDeleteState: 'COMPLETE', fileName: 'Deleted document', title: 'Deleted deliverable' } });
        }
        if(row.status === 'DELETE_PENDING') await tx.ordinaryTransferIntent.updateMany({where:{resourceId:row.resourceId,operation:'DELETE',status:'DELETE_PENDING',id:{not:id}},data:{status:'DELETE_SUPERSEDED',fileName:'PK-document',title:null}});
        if(row.status === 'DELETE_PENDING') await tx.ordinaryTransferIntent.updateMany({where:{resourceId:row.resourceId,operation:'UPLOAD',status:'COMPLETE'},data:{status:'DISPOSED',fileName:'PK-document',title:null}});
        await tx.ordinaryTransferIntent.update({ where: { id }, data: { status: row.status === 'DELETE_PENDING' ? 'DELETE_COMPLETE' : 'EXPIRED', fileName: 'PK-document', title: null } });
        await audit(tx,row,'TRANSFER_DELETE_VERIFIED');
    }, {timeout:35000});
}
