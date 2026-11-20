import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  attachmentApi,
  formatFileSize,
  downloadBlob,
  MAX_ATTACHMENT_SIZE_BYTES,
  type AttachmentUploadProgress,
} from '../../core/api/modules/attachment.api';
import type { AttachmentRecord, AttachmentObjectType } from '../../core/types/ptw.types';
import { toast } from '../context/ToastContext';

export interface AttachmentManagerProps {
  objectType: AttachmentObjectType | string;
  objectId?: string;
  stagedFiles?: File[];
  onStagedFilesChange?: (files: File[]) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

interface ActivePreview {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  url: string;
  blob?: Blob;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  objectType,
  objectId,
  stagedFiles,
  onStagedFilesChange,
  readOnly = false,
  title,
  description,
  className = '',
}) => {
  // Remote state (for live objectId mode)
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<AttachmentUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close preview modal and revoke blob URL
  const handleClosePreview = useCallback(() => {
    if (activePreview?.url) {
      window.URL.revokeObjectURL(activePreview.url);
    }
    setActivePreview(null);
  }, [activePreview]);

  // Escape key handler for Document Viewer modal
  useEffect(() => {
    if (!activePreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePreview, handleClosePreview]);

  // Load existing DMS attachments if objectId is provided
  const loadRemoteAttachments = useCallback(async () => {
    if (!objectId) return;
    try {
      setLoading(true);
      const data = await attachmentApi.getAttachments(objectType, objectId);
      setAttachments(data);
    } catch (err: any) {
      console.error('[AttachmentManager] Error fetching DMS attachments:', err);
      toast.error('Failed to load DMS attachments: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }, [objectType, objectId]);

  useEffect(() => {
    if (objectId) {
      loadRemoteAttachments();
    }
  }, [objectId, loadRemoteAttachments]);

  // Handle file addition (either staged or live upload)
  const handleFilesAdded = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      if (fileArray.length === 0) return;

      // Validate file size for each file
      const validFiles: File[] = [];
      for (const file of fileArray) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          toast.error(
            `"${file.name}" exceeds maximum allowed size of 10 MiB (${formatFileSize(file.size)}).`
          );
        } else if (file.size === 0) {
          toast.error(`"${file.name}" is empty (0 bytes).`);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) return;

      // Mode 1: Pre-creation Staged Mode (no objectId yet)
      if (!objectId) {
        if (onStagedFilesChange) {
          const current = stagedFiles || [];
          const deduplicated = validFiles.filter(
            (vf) => !current.some((cf) => cf.name === vf.name && cf.size === vf.size)
          );
          if (deduplicated.length < validFiles.length) {
            toast.info('Duplicate file(s) omitted.');
          }
          onStagedFilesChange([...current, ...deduplicated]);
        }
        return;
      }

      // Mode 2: Live Mode (objectId exists) -> Upload immediately to CMIS / DMS
      setIsUploading(true);
      const queueItems: AttachmentUploadProgress[] = validFiles.map((f) => ({
        file: f,
        stage: 'idle',
        progressPercent: 0,
      }));
      setUploadQueue((prev) => [...prev, ...queueItems]);

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          setUploadQueue((prev) =>
            prev.map((q) => (q.file === file ? { ...q, stage: 'metadata', progressPercent: 20 } : q))
          );

          await attachmentApi.uploadAndLinkFile(file, objectType, objectId, (step) => {
            let stage: AttachmentUploadProgress['stage'] = 'uploading';
            let pct = 50;
            if (step.toLowerCase().includes('metadata')) {
              stage = 'metadata';
              pct = 25;
            } else if (step.toLowerCase().includes('binary') || step.toLowerCase().includes('cmis')) {
              stage = 'uploading';
              pct = 65;
            } else if (step.toLowerCase().includes('link')) {
              stage = 'linking';
              pct = 85;
            } else if (step.toLowerCase().includes('done')) {
              stage = 'completed';
              pct = 100;
            }
            setUploadQueue((prev) =>
              prev.map((q) => (q.file === file ? { ...q, stage, progressPercent: pct } : q))
            );
          });

          setUploadQueue((prev) =>
            prev.map((q) => (q.file === file ? { ...q, stage: 'completed', progressPercent: 100 } : q))
          );
          toast.success(`"${file.name}" uploaded to SAP CMIS / DMS.`);
        } catch (uploadErr: any) {
          console.error(`Error uploading ${file.name}:`, uploadErr);
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.file === file
                ? { ...q, stage: 'error', error: uploadErr?.message || String(uploadErr) }
                : q
            )
          );
          toast.error(`Failed to upload "${file.name}": ${uploadErr?.message || uploadErr}`);
        }
      }

      setIsUploading(false);
      await loadRemoteAttachments();
    },
    [objectId, stagedFiles, onStagedFilesChange, objectType, loadRemoteAttachments]
  );

  // Staged file removal (Pre-creation)
  const handleRemoveStagedFile = (index: number) => {
    if (!onStagedFilesChange || !stagedFiles) return;
    const updated = stagedFiles.filter((_, idx) => idx !== index);
    onStagedFilesChange(updated);
  };

  // View action: fetches binary stream and launches interactive Document Viewer modal
  const handleView = async (attachment: AttachmentRecord) => {
    if (!attachment.AttachmentId) {
      toast.error('Attachment ID is missing.');
      return;
    }
    try {
      setViewingId(attachment.AttachmentId);
      const res = await attachmentApi.viewDocument(
        attachment.AttachmentId,
        (attachment.ObjectType as AttachmentObjectType) || objectType
      );
      setActivePreview({
        attachmentId: attachment.AttachmentId,
        fileName: attachment.FileName || 'Document',
        mimeType: res.mimeType,
        url: res.url,
        blob: res.blob,
      });
    } catch (err: any) {
      console.error('[AttachmentManager] View error:', err);
      toast.error('Failed to view file from DMS: ' + (err.message || String(err)));
    } finally {
      setViewingId(null);
    }
  };

  // Download action for remote DMS attachment
  const handleDownload = async (attachment: AttachmentRecord) => {
    if (!attachment.AttachmentId) {
      toast.error('Attachment ID is missing.');
      return;
    }
    try {
      setDownloadingId(attachment.AttachmentId);
      await attachmentApi.downloadFile(
        attachment.AttachmentId,
        (attachment.ObjectType as AttachmentObjectType) || objectType,
        attachment.FileName || 'attachment'
      );
      toast.success(`Downloaded ${attachment.FileName}`);
    } catch (err: any) {
      console.error('[AttachmentManager] Download error:', err);
      toast.error('Failed to download file from DMS: ' + (err.message || String(err)));
    } finally {
      setDownloadingId(null);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!readOnly && !isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (readOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Helper for file type icon / badge
  const getFileBadge = (fileName: string, mime?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext) || mime?.includes('pdf')) {
      return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'PDF' };
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext) || mime?.includes('image')) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'IMG' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext) || mime?.includes('sheet') || mime?.includes('excel')) {
      return { bg: 'bg-green-50 text-green-700 border-green-200', label: 'XLS' };
    }
    if (['doc', 'docx'].includes(ext) || mime?.includes('word')) {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'DOC' };
    }
    return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: ext.toUpperCase() || 'FILE' };
  };

  const displayTitle = title || (objectId ? `DMS Attachments (${objectType} #${objectId})` : 'Attachments & Work Instructions');
  const displayDescription =
    description ||
    (objectId
      ? 'Manage, view, and download safety documentation, P&IDs, work procedures, and certification stored in SAP CMIS / DMS.'
      : 'Attach safety procedures, drawings, JHA sign-offs, or contractor permits (max 10 MiB per file). Files are linked to SAP DMS upon creation.');

  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#006398]/10 text-[#006398]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </span>
            <h3 className="font-semibold text-slate-800 text-sm tracking-tight">{displayTitle}</h3>
            {objectId && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {attachments.length} stored
              </span>
            )}
            {!objectId && stagedFiles && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {stagedFiles.length} staged
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{displayDescription}</p>
        </div>

        {objectId && (
          <button
            type="button"
            onClick={loadRemoteAttachments}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#006398] px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
            title="Refresh DMS Attachments"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#006398]' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Refresh</span>
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Upload Drop Zone (Available if not readOnly) */}
        {!readOnly && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${
              isDragging
                ? 'border-[#006398] bg-sky-50/50 scale-[0.99]'
                : 'border-slate-300 hover:border-[#006398] hover:bg-slate-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdded(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-[#006398] shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-[#006398]">Click to upload</span> or drag and drop
              </div>
              <p className="text-[11px] text-slate-500">
                PDF, JPG, PNG, DOCX, XLSX (Max 10 MiB per file · Stored securely in SAP CMIS / DMS)
              </p>
            </div>
          </div>
        )}

        {/* Uploading Queue Progress (Live Mode) */}
        {uploadQueue.length > 0 && isUploading && (
          <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/60 space-y-2">
            <div className="text-xs font-medium text-sky-900 flex items-center justify-between">
              <span>Uploading to SAP CMIS / DMS...</span>
              <span className="font-mono text-[11px]">
                {uploadQueue.filter((q) => q.stage === 'completed').length} / {uploadQueue.length} done
              </span>
            </div>
            <div className="space-y-1.5">
              {uploadQueue.map((item, idx) => (
                <div key={idx} className="text-xs text-slate-700 bg-white p-2 rounded border border-sky-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium truncate max-w-xs">{item.file.name}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.stage}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.stage === 'error'
                          ? 'bg-red-500'
                          : item.stage === 'completed'
                          ? 'bg-emerald-500'
                          : 'bg-[#006398]'
                      }`}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-Creation Staged Files List (Permit Create Wizard Step 8) */}
        {!objectId && stagedFiles && stagedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Selected Files to be Uploaded ({stagedFiles.length})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Total size:{' '}
                {formatFileSize(stagedFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {stagedFiles.map((file, idx) => {
                const badge = getFileBadge(file.name, file.type);
                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}
                      >
                        {badge.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatFileSize(file.size)} · Ready to upload upon record creation
                        </p>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStagedFile(idx);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Remote Stored DMS Attachments (Live Mode) */}
        {objectId && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Linked DMS Documents ({attachments.length})</span>
              {loading && <span className="text-[11px] text-[#006398] animate-pulse">Loading DMS...</span>}
            </div>

            {attachments.length === 0 && !loading ? (
              <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-lg border border-slate-100">
                <svg
                  className="w-8 h-8 mx-auto mb-1.5 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-xs text-slate-500 font-medium">No attachments linked yet</p>
                <p className="text-[11px] text-slate-400">
                  Upload safety instructions, isolation tags, or gas tests above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {attachments.map((att) => {
                  const badge = getFileBadge(att.FileName, att.MimeType);
                  const isDownloading = downloadingId === att.AttachmentId;
                  const isViewing = viewingId === att.AttachmentId;
                  return (
                    <div
                      key={att.AttachmentId}
                      className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {att.FileName || 'Document'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                            <span>{formatFileSize(att.FileSize)}</span>
                            {att.UploadedBy && <span>• Uploaded by {att.UploadedBy}</span>}
                            {att.UploadedAt && (
                              <span>
                                • {new Date(att.UploadedAt).toLocaleDateString()}{' '}
                                {new Date(att.UploadedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                            {att.CrepId && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                                Repo: {att.CrepId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons: View & Download */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* View Document Button */}
                        <button
                          type="button"
                          onClick={() => handleView(att)}
                          disabled={isViewing || isDownloading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white text-xs font-semibold border border-teal-200 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                          title="View document inline"
                        >
                          {isViewing ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              <span>Opening...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              <span>View</span>
                            </>
                          )}
                        </button>

                        {/* Download Button */}
                        <button
                          type="button"
                          onClick={() => handleDownload(att)}
                          disabled={isDownloading || isViewing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#006398] text-slate-700 hover:text-white text-xs font-medium transition-colors shadow-2xs disabled:opacity-50 cursor-pointer border border-slate-200"
                          title="Download file from SAP CMIS / DMS"
                        >
                          {isDownloading ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              <span>Fetching...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              <span>Download</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Document Viewer Modal */}
      {activePreview && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-hidden"
          onClick={handleClosePreview}
        >
          <div
            className="w-full max-w-5xl rounded-2xl border border-slate-700/60 bg-white shadow-2xl flex flex-col h-[94vh] max-h-[94vh] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Viewer Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <span className="p-2 rounded-xl bg-white/10 text-teal-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-md">
                    {activePreview.fileName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {activePreview.mimeType} • ID: {activePreview.attachmentId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(activePreview.url, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  title="Open in new window / tab"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  <span className="hidden sm:inline">New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activePreview.blob) {
                      downloadBlob(activePreview.blob, activePreview.fileName);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Download document"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Close viewer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 bg-slate-100 overflow-hidden relative flex items-center justify-center">
              {activePreview.mimeType.includes('pdf') ? (
                <iframe
                  src={`${activePreview.url}#toolbar=1`}
                  className="w-full h-full border-0"
                  title={activePreview.fileName}
                />
              ) : activePreview.mimeType.includes('image') ? (
                <div className="p-4 w-full h-full flex items-center justify-center overflow-auto bg-slate-900/5">
                  <img
                    src={activePreview.url}
                    alt={activePreview.fileName}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                </div>
              ) : (
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    Direct browser preview not supported for {activePreview.mimeType}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (activePreview.blob) {
                        downloadBlob(activePreview.blob, activePreview.fileName);
                      }
                    }}
                    className="px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800 transition cursor-pointer"
                  >
                    Download to View Document
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AttachmentManager;
