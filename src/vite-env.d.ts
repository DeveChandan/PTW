/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SAP_TARGET: string;
  readonly VITE_SAP_CLIENT: string;
  readonly VITE_ODATA_BASE_URL: string;
  readonly VITE_ENABLE_DEV_MOCK_USER: string;
  readonly VITE_DEV_MOCK_USER_ID: string;
  readonly VITE_PTW_WORK_ENTITY?: string;
  readonly VITE_PTW_WORK_DATE_FIELD?: string;
  readonly VITE_PTW_SHUTDOWN_FILTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
