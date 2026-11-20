import odataClient from '../odataClient';
import { ODATA_ENTITIES } from '../odataEndpoints';
import type { AttachmentRecord, AttachmentObjectType } from '../../types/ptw.types';
import type { ODataCollectionResponse } from '../../types/odata.types';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes (10 MiB)
export const DMS_ACTION_NAMESPACE = 'com.sap.gateway.srvd_a2x.zptw_services.v0001';

/**
 * Normalizes user / workspace ObjectType to canonical SAP service types:
 * - PERMIT / PTW -> PTW (per updated SAP service)
 * - ISOLATION / ISO -> ISOLATION
 * - GASTEST / GAS -> GASTEST
 */
export function normalizeAttachmentObjectType(type?: AttachmentObjectType | string): string {
  const upper = (type || 'PTW').trim().toUpperCase();
  if (upper === 'PERMIT' || upper === 'PTW') return 'PTW';
  if (upper === 'ISOLATION' || upper === 'ISO') return 'ISOLATION';
  if (upper === 'GASTEST' || upper === 'GAS') return 'GASTEST';
  return upper;
}

export interface AttachmentCreatePayload {
  ObjectType: AttachmentObjectType | string;
  ObjectId?: string;
  FileName: string;
  MimeType: string;
}

export interface DownloadContentResponse {
  FileName: string;
  MimeType: string;
  FileContentBase64: string;
}

export interface AttachmentUploadProgress {
  file: File;
  stage: 'idle' | 'converting' | 'metadata' | 'uploading' | 'linking' | 'completed' | 'error';
  progressPercent: number;
  attachmentId?: string;
  error?: string;
}

/**
 * Utility: Converts a browser File object to raw Base64 string
 * Strips the 'data:<mime>;base64,' prefix per SAP requirement.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) {
        resolve('');
        return;
      }
      // Strip DataURL prefix (e.g., 'data:application/pdf;base64,')
      const commaIdx = result.indexOf(',');
      const rawBase64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      resolve(rawBase64.trim());
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Utility: Converts a raw Base64 string into a browser Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const cleanBase64 = base64.replace(/\s/g, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType || 'application/octet-stream' });
}

/**
 * Utility: Triggers client-side browser file download from Blob
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Utility: Human-readable file size formatter
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Utility: Formats Gas Test ObjectId as PermitNo/TestSeq (e.g. PTW0000108/001)
 */
export function formatGasTestObjectId(permitNo: string, testSeq: string | number): string {
  const cleanPermit = (permitNo || '').trim().replace(/^'|'$/g, '');
  const seqStr = String(testSeq || '1').trim();
  const paddedSeq = seqStr.padStart(3, '0');
  return `${cleanPermit}/${paddedSeq}`;
}

/**
 * SAP OData V4 Attachment API Service (CMIS Stream & DMS Storage)
 * Service Namespace: com.sap.gateway.srvd_a2x.zptw_services.v0001
 * Base Service Endpoint: /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001
 *
 * CMIS Stream & DMS Architecture:
 * 1. Metadata save: POST /Attachment with ObjectType ('PTW'), ObjectId ('PTW-00004'), FileName, MimeType
 * 2. CMIS Upload: PUT /Attachment(AttachmentId='...',ObjectType='PTW')/FileContent [binary]
 * 3. Download / View: GET /Attachment(AttachmentId='...',ObjectType='PTW')/FileContent [binary stream]
 */
class AttachmentApiService {
  /**
   * Helper to build SAP OData V4 entity key predicate
   * e.g. Attachment(AttachmentId='025C0C2FEE661FE1B981B3D082858997',ObjectType='PTW')
   */
  public getEntityPath(attachmentId: string, objectType: AttachmentObjectType | string): string {
    const cleanId = (attachmentId || '').trim().replace(/^'|'$/g, '');
    const cleanType = normalizeAttachmentObjectType(objectType);
    return `${ODATA_ENTITIES.ATTACHMENT}(AttachmentId='${cleanId}',ObjectType='${cleanType}')`;
  }

  /**
   * Helper to construct relative path for CMIS FileContent media stream
   * e.g. Attachment(AttachmentId='...',ObjectType='PTW')/FileContent
   */
  public getFileContentPath(attachmentId: string, objectType: AttachmentObjectType | string): string {
    const entityPath = this.getEntityPath(attachmentId, objectType);
    return `${entityPath}/FileContent`;
  }

  /**
   * Helper to construct full URL for CMIS FileContent stream
   */
  public getFileContentUrl(attachmentId: string, objectType: AttachmentObjectType | string): string {
    const path = this.getFileContentPath(attachmentId, objectType);
    const base = odataClient.getBaseUrl().replace(/\/+$/, '');
    return `${base}/${path}`;
  }

  /**
   * Step 1: Create Attachment Metadata in SAP
   * Endpoint: POST /Attachment
   * Payload:
   * {
   *   "ObjectType": "PTW",
   *   "ObjectId": "PTW-00004",
   *   "FileName": "book (1)",
   *   "MimeType": "application/pdf"
   * }
   */
  public async createMetadata(payload: AttachmentCreatePayload): Promise<AttachmentRecord> {
    if (!payload.FileName?.trim()) {
      throw new Error('FileName is required for attachment creation.');
    }

    const cleanType = normalizeAttachmentObjectType(payload.ObjectType);
    if (!['PTW', 'ISOLATION', 'GASTEST'].includes(cleanType)) {
      throw new Error(`Invalid ObjectType "${payload.ObjectType}". Must be PTW, ISOLATION, or GASTEST.`);
    }

    const cleanPayload: Record<string, any> = {
      ObjectType: cleanType,
      FileName: payload.FileName.trim(),
      MimeType: payload.MimeType?.trim() || 'application/pdf',
    };

    if (payload.ObjectId?.trim()) {
      cleanPayload.ObjectId = payload.ObjectId.trim();
    }

    const response = await odataClient.instance.post<AttachmentRecord>(
      ODATA_ENTITIES.ATTACHMENT,
      cleanPayload
    );

    if (!response.data || !response.data.AttachmentId) {
      throw new Error('SAP did not return an AttachmentId in the create response.');
    }

    return response.data;
  }

  /**
   * Step 2: CMIS Upload: Binary Stream PUT
   * Endpoint: PUT /Attachment(AttachmentId='...',ObjectType='PTW')/FileContent
   * Sends raw binary stream with Content-Type header.
   */
  public async uploadContentBinary(
    attachmentId: string,
    objectType: AttachmentObjectType | string,
    content: Blob | ArrayBuffer | Uint8Array | File,
    mimeType?: string
  ): Promise<void> {
    if (!attachmentId?.trim()) throw new Error('AttachmentId is required for CMIS upload.');

    const cleanId = (attachmentId || '').trim().replace(/^'|'$/g, '');
    const cleanType = normalizeAttachmentObjectType(objectType);
    const streamPath = `${ODATA_ENTITIES.ATTACHMENT}(AttachmentId='${cleanId}',ObjectType='${cleanType}')/FileContent`;

    let detectedMime = mimeType;
    if (!detectedMime) {
      if (typeof File !== 'undefined' && content instanceof File) {
        detectedMime = content.type;
      } else if (typeof Blob !== 'undefined' && content instanceof Blob) {
        detectedMime = content.type;
      }
    }
    const finalMime = detectedMime?.trim() || 'application/pdf';

    await odataClient.instance.put(streamPath, content, {
      headers: {
        'Content-Type': finalMime,
        'If-Match': '*',
      },
    });
  }

  /**
   * Step 2 (Legacy Fallback): Upload File Content via Base64 JSON Action
   * Endpoint: POST /Attachment(AttachmentId='...',ObjectType='...')/...UploadContent
   */
  public async uploadContent(
    attachmentId: string,
    objectType: AttachmentObjectType | string,
    fileContentBase64: string
  ): Promise<void> {
    if (!attachmentId?.trim()) throw new Error('AttachmentId is required for upload.');
    if (!fileContentBase64?.trim()) throw new Error('FileContentBase64 is required.');

    const approximateBytes = Math.round((fileContentBase64.length * 3) / 4);
    if (approximateBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`File exceeds maximum allowed size of 10 MiB (${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}).`);
    }

    const entityPath = this.getEntityPath(attachmentId, objectType);
    const actionUrl = `${entityPath}/${DMS_ACTION_NAMESPACE}.UploadContent`;

    await odataClient.instance.post(actionUrl, {
      FileContentBase64: fileContentBase64,
    });
  }

  /**
   * Step 3: Link Attachment to Created Business Record (Fallback Action)
   * Endpoint: POST /Attachment(AttachmentId='...',ObjectType='...')/...LinkAttachment
   */
  public async linkAttachment(
    attachmentId: string,
    objectType: AttachmentObjectType | string,
    objectId: string
  ): Promise<AttachmentRecord> {
    if (!attachmentId?.trim()) throw new Error('AttachmentId is required for linking.');
    if (!objectId?.trim()) throw new Error('ObjectId is required for linking attachment.');

    const entityPath = this.getEntityPath(attachmentId, objectType);
    const actionUrl = `${entityPath}/${DMS_ACTION_NAMESPACE}.LinkAttachment`;

    const response = await odataClient.instance.post<AttachmentRecord>(actionUrl, {
      ObjectId: objectId.trim(),
    });

    return response.data;
  }

  /**
   * Step 4: Query Attachments for a Record
   * Endpoint: GET /Attachment?$filter=(ObjectType eq 'PTW' or ObjectType eq 'PERMIT') and ObjectId eq '{OBJECT_ID}'
   */
  public async getAttachments(
    objectType: AttachmentObjectType | string,
    objectId: string
  ): Promise<AttachmentRecord[]> {
    if (!objectId?.trim()) return [];

    const cleanType = normalizeAttachmentObjectType(objectType);
    const cleanId = objectId.trim().replace(/^'|'$/g, '');

    const typeClause = cleanType === 'PTW'
      ? `(ObjectType eq 'PTW' or ObjectType eq 'PERMIT')`
      : `ObjectType eq '${cleanType}'`;
    const filter = `${typeClause} and ObjectId eq '${cleanId}'`;
    const url = `${ODATA_ENTITIES.ATTACHMENT}?$filter=${encodeURIComponent(filter)}`;

    try {
      const response = await odataClient.instance.get<ODataCollectionResponse<AttachmentRecord>>(url);
      return response.data?.value || [];
    } catch (err) {
      console.warn(`[AttachmentApi] Failed to fetch attachments for ${cleanType} ${cleanId}:`, err);
      return [];
    }
  }

  /**
   * Step 5: Download CMIS Media Stream (Binary GET)
   * Endpoint: GET /Attachment(AttachmentId='...',ObjectType='PTW')/FileContent
   */
  public async downloadContentBlob(
    attachmentId: string,
    objectType: AttachmentObjectType | string
  ): Promise<Blob> {
    if (!attachmentId?.trim()) throw new Error('AttachmentId is required to download content.');

    const cleanId = (attachmentId || '').trim().replace(/^'|'$/g, '');
    const cleanType = normalizeAttachmentObjectType(objectType);
    const streamPath = `${ODATA_ENTITIES.ATTACHMENT}(AttachmentId='${cleanId}',ObjectType='${cleanType}')/FileContent`;

    const response = await odataClient.instance.get(streamPath, {
      responseType: 'blob',
    });

    return response.data;
  }

  /**
   * Step 5 (Legacy Fallback): Download File Content via Base64 Function
   * Endpoint: GET /Attachment(AttachmentId='...',ObjectType='...')/...DownloadContent()
   */
  public async downloadContent(
    attachmentId: string,
    objectType: AttachmentObjectType | string
  ): Promise<DownloadContentResponse> {
    if (!attachmentId?.trim()) throw new Error('AttachmentId is required to download content.');

    const entityPath = this.getEntityPath(attachmentId, objectType);
    const functionUrl = `${entityPath}/${DMS_ACTION_NAMESPACE}.DownloadContent()`;

    const response = await odataClient.instance.get<DownloadContentResponse>(functionUrl);
    if (!response.data || !response.data.FileContentBase64) {
      throw new Error('SAP did not return file content for download.');
    }

    return response.data;
  }

  /**
   * Complete Download Pipeline: Fetches binary stream and triggers browser file save
   */
  public async downloadFile(
    attachmentId: string,
    objectType: AttachmentObjectType | string,
    fallbackFileName?: string
  ): Promise<void> {
    try {
      // Primary: CMIS /FileContent stream
      const blob = await this.downloadContentBlob(attachmentId, objectType);
      const fileName = fallbackFileName || 'document.pdf';
      downloadBlob(blob, fileName);
    } catch (streamErr) {
      console.warn('[AttachmentApi] CMIS binary stream failed, attempting legacy function fallback:', streamErr);
      const data = await this.downloadContent(attachmentId, objectType);
      const fileName = data.FileName || fallbackFileName || 'document.bin';
      const mimeType = data.MimeType || 'application/octet-stream';
      const blob = base64ToBlob(data.FileContentBase64, mimeType);
      downloadBlob(blob, fileName);
    }
  }

  /**
   * Document Viewer Pipeline: Fetches binary stream and creates an object URL for inline viewing
   */
  public async viewDocument(
    attachmentId: string,
    objectType: AttachmentObjectType | string
  ): Promise<{ blob: Blob; url: string; mimeType: string }> {
    let blob: Blob;
    try {
      blob = await this.downloadContentBlob(attachmentId, objectType);
    } catch {
      const data = await this.downloadContent(attachmentId, objectType);
      blob = base64ToBlob(data.FileContentBase64, data.MimeType || 'application/pdf');
    }
    const objectUrl = window.URL.createObjectURL(blob);
    return {
      blob,
      url: objectUrl,
      mimeType: blob.type || 'application/pdf',
    };
  }

  /**
   * Orchestrates the 2-step CMIS Upload Pipeline:
   * 1. Creates metadata with ObjectType ('PTW') and ObjectId ('PTW-00004')
   * 2. Uploads binary stream to PUT /FileContent
   * 3. Fallback: links attachment if backend metadata did not link ObjectId
   */
  public async uploadAndLinkFile(
    file: File,
    objectType: AttachmentObjectType | string,
    objectId: string,
    onProgress?: (stage: string) => void
  ): Promise<AttachmentRecord> {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`"${file.name}" exceeds 10 MiB limit (${formatFileSize(file.size)}). Max allowed: 10 MiB.`);
    }

    const cleanType = normalizeAttachmentObjectType(objectType);

    onProgress?.('Saving attachment metadata in SAP...');
    const meta = await this.createMetadata({
      ObjectType: cleanType,
      ObjectId: objectId?.trim() || undefined,
      FileName: file.name,
      MimeType: file.type || 'application/pdf',
    });

    const attachmentId = meta.AttachmentId!;

    onProgress?.('Uploading binary content to CMIS / DMS...');
    await this.uploadContentBinary(attachmentId, cleanType, file, file.type);

    // Fallback: If ObjectId was not linked in metadata response
    if (!meta.ObjectId && objectId?.trim()) {
      try {
        onProgress?.('Linking attachment to business record...');
        await this.linkAttachment(attachmentId, cleanType, objectId);
      } catch (linkErr) {
        console.warn('[AttachmentApi] LinkAttachment fallback notice:', linkErr);
      }
    }

    onProgress?.('Done');
    return {
      ...meta,
      ObjectId: meta.ObjectId || objectId,
      FileName: file.name,
      MimeType: file.type || 'application/pdf',
      FileSize: file.size,
    };
  }

  /**
   * Batch Upload Pipeline: Sequentially processes multiple selected files
   */
  public async uploadAndLinkMultipleFiles(
    files: File[],
    objectType: AttachmentObjectType | string,
    objectId: string,
    onFileProgress?: (index: number, total: number, fileName: string, step: string) => void
  ): Promise<{
    successful: AttachmentRecord[];
    failed: { file: File; error: string; attachmentId?: string }[];
  }> {
    const successful: AttachmentRecord[] = [];
    const failed: { file: File; error: string; attachmentId?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const record = await this.uploadAndLinkFile(
          file,
          objectType,
          objectId,
          (step) => onFileProgress?.(i + 1, files.length, file.name, step)
        );
        successful.push(record);
      } catch (err: any) {
        failed.push({
          file,
          error: err?.message || String(err),
        });
      }
    }

    return { successful, failed };
  }
}

export const attachmentApi = new AttachmentApiService();
export default attachmentApi;
