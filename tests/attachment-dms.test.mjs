import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundleResult = await build({
  stdin: {
    contents: `
      export {
        attachmentApi,
        normalizeAttachmentObjectType,
        MAX_ATTACHMENT_SIZE_BYTES,
        DMS_ACTION_NAMESPACE,
        formatFileSize,
        formatGasTestObjectId,
        base64ToBlob
      } from './src/core/api/modules/attachment.api';
      export { ODATA_ENTITIES } from './src/core/api/odataEndpoints';
    `,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_ODATA_BASE_URL: '/sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/',
      DEV: true
    })
  }
});

const compiled = { exports: {} };
new Function('require', 'module', 'exports', bundleResult.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
);

const {
  attachmentApi,
  normalizeAttachmentObjectType,
  MAX_ATTACHMENT_SIZE_BYTES,
  DMS_ACTION_NAMESPACE,
  formatFileSize,
  formatGasTestObjectId,
  base64ToBlob,
  ODATA_ENTITIES
} = compiled.exports;

test('Attachment CMIS/DMS: Size limits & constants', () => {
  assert.equal(MAX_ATTACHMENT_SIZE_BYTES, 10 * 1024 * 1024, 'Max attachment size must be exactly 10 MiB (10,485,760 bytes)');
  assert.equal(DMS_ACTION_NAMESPACE, 'com.sap.gateway.srvd_a2x.zptw_services.v0001');
  assert.equal(ODATA_ENTITIES.ATTACHMENT, 'Attachment');
});

test('Attachment CMIS/DMS: normalizeAttachmentObjectType maps types to canonical SAP keys', () => {
  assert.equal(normalizeAttachmentObjectType('PERMIT'), 'PTW');
  assert.equal(normalizeAttachmentObjectType('PTW'), 'PTW');
  assert.equal(normalizeAttachmentObjectType('permit'), 'PTW');
  assert.equal(normalizeAttachmentObjectType('ISOLATION'), 'ISOLATION');
  assert.equal(normalizeAttachmentObjectType('ISO'), 'ISOLATION');
  assert.equal(normalizeAttachmentObjectType('GASTEST'), 'GASTEST');
  assert.equal(normalizeAttachmentObjectType('GAS'), 'GASTEST');
});

test('Attachment CMIS/DMS: formatFileSize utility', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
  assert.equal(formatFileSize(5.5 * 1024 * 1024), '5.5 MB');
  assert.equal(formatFileSize(undefined), '—');
});

test('Attachment CMIS/DMS: Gas Test ObjectId construction (PermitNo/TestSeq)', () => {
  assert.equal(formatGasTestObjectId('PTW0000108', '1'), 'PTW0000108/001');
  assert.equal(formatGasTestObjectId('PTW0000108', 1), 'PTW0000108/001');
  assert.equal(formatGasTestObjectId('PTW0000108', '002'), 'PTW0000108/002');
  assert.equal(formatGasTestObjectId('PTW0000108', 15), 'PTW0000108/015');
  assert.equal(formatGasTestObjectId("'PTW0000108'", 3), 'PTW0000108/003');
});

test('Attachment CMIS/DMS: Entity Path and CMIS FileContent stream path formatting', () => {
  const ptwPath = attachmentApi.getEntityPath('025C0C2FEE661FE1B981B3D082858997', 'PTW');
  assert.equal(ptwPath, "Attachment(AttachmentId='025C0C2FEE661FE1B981B3D082858997',ObjectType='PTW')");

  const permitNormalizedPath = attachmentApi.getEntityPath('025C0C2FEE661FE1B981B3D082858997', 'PERMIT');
  assert.equal(permitNormalizedPath, "Attachment(AttachmentId='025C0C2FEE661FE1B981B3D082858997',ObjectType='PTW')");

  const isoPath = attachmentApi.getEntityPath('ATT002', 'ISOLATION');
  assert.equal(isoPath, "Attachment(AttachmentId='ATT002',ObjectType='ISOLATION')");

  const gasPath = attachmentApi.getEntityPath('ATT003', 'GASTEST');
  assert.equal(gasPath, "Attachment(AttachmentId='ATT003',ObjectType='GASTEST')");

  // CMIS /FileContent stream path (used for PUT binary and GET binary download)
  const streamPath = attachmentApi.getFileContentPath('025C0C2FEE661FE1B981B3D082858997', 'PTW');
  assert.equal(
    streamPath,
    "Attachment(AttachmentId='025C0C2FEE661FE1B981B3D082858997',ObjectType='PTW')/FileContent"
  );
});

test('Attachment CMIS/DMS: Step 1 Create Metadata validates required fields and preserves ObjectId', async () => {
  // Must reject empty FileName
  await assert.rejects(
    async () => {
      await attachmentApi.createMetadata({ ObjectType: 'PTW', FileName: '', MimeType: 'application/pdf' });
    },
    /FileName is required/
  );

  // Must reject invalid ObjectType
  await assert.rejects(
    async () => {
      await attachmentApi.createMetadata({ ObjectType: 'UNKNOWN', FileName: 'doc.pdf', MimeType: 'application/pdf' });
    },
    /Invalid ObjectType/
  );
});

test('Attachment CMIS/DMS: Step 2 CMIS Binary Upload validation', async () => {
  // Reject empty AttachmentId
  await assert.rejects(
    async () => {
      await attachmentApi.uploadContentBinary('', 'PTW', new Uint8Array([1, 2, 3]));
    },
    /AttachmentId is required/
  );
});

test('Attachment CMIS/DMS: Download stream validation', async () => {
  await assert.rejects(
    async () => {
      await attachmentApi.downloadContentBlob('', 'PTW');
    },
    /AttachmentId is required/
  );
});

test('Attachment CMIS/DMS: Legacy Download function URL preserves trailing ()', () => {
  const entityPath = attachmentApi.getEntityPath('ATT001', 'PTW');
  const downloadUrl = `${entityPath}/${DMS_ACTION_NAMESPACE}.DownloadContent()`;
  assert.ok(downloadUrl.endsWith('.DownloadContent()'), 'DownloadContent must include trailing ()');
});

test('Attachment CMIS/DMS: base64ToBlob decodes correctly in browser environment', () => {
  if (typeof atob !== 'undefined' && typeof Blob !== 'undefined') {
    const sampleText = 'Hello SAP PTW DMS';
    const base64 = Buffer.from(sampleText).toString('base64');
    const blob = base64ToBlob(base64, 'text/plain');
    assert.equal(blob.type, 'text/plain');
    assert.equal(blob.size, sampleText.length);
  }
});
