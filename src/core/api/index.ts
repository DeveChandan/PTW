/**
 * SAP Permit To Work (PTW) - Module-wise OData API Layer
 * 
 * Each business domain has its own dedicated API module to keep logic decoupled,
 * type-safe, and straightforward to maintain across teams.
 */

// Base Transport Client & Utilities
export { odataClient, default as odataClientDefault } from './odataClient';
export * from './odataEndpoints';

// Modular Domain APIs
export { authApi, default as authApiDefault } from './modules/auth.api';
export { permitCreateApi, default as permitCreateApiDefault } from './modules/permitCreate.api';
export { permitWorkLookupApi } from './modules/permitWorkLookup.api';
export { permitDetailsApi, default as permitDetailsApiDefault } from './modules/permitDetails.api';
export { permitApproverApi, default as permitApproverApiDefault } from './modules/permitApprover.api';
export { permitIssuerApi, default as permitIssuerApiDefault } from './modules/permitIssuer.api';
export { permitHolderApi, default as permitHolderApiDefault } from './modules/permitHolder.api';
export { gasTesterApi, default as gasTesterApiDefault, DEFAULT_GAS_THRESHOLDS } from './modules/gasTester.api';
export { isolationApi, default as isolationApiDefault } from './modules/isolation.api';
export { adminApi, default as adminApiDefault } from './modules/admin.api';
