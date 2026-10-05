> Historical review/proposal: frontend fixes are now implemented. See [current implementation and backend handoff](ptw-frontend-metadata-update.md). Statements below describing the old serializer or generic action are retained as review history, not the current integration contract.

# Supplied backend metadata vs current permit creation

Reviewed 5 October 2026. Source: user-supplied Pasted text.txt attachment, namespace `com.sap.gateway.srvd_a2x.zptw_services.v0001`. Static metadata/payload verification only; no live create or workflow action was executed.

## Verdict

The current PermitInfo header, Worker, PPE, Safety and HazardControl local property schemas match the supplied metadata exactly, including types, nullability, lengths, precision and scale. Order and notification linkage fields exist. The examples without isolation point rows have compatible property names/lengths/null values, but they currently include the computed PersonsQty property. Creation with flat isolation points and the generic prerequisite action contract are incompatible with this backend.

## Verified creation request

`POST <configured OData service root>/PermitInfo`, JSON body directly, with existing SAP authentication/CSRF and `Prefer: return=representation`.

The supplied metadata supports the `_Worker`, `_PPE`, `_Safety` and `_HazardControl` navigations and explicitly advertises their insertion. The app additionally supports `_Isolation` using an outdated row model; see below. Empty child collections are omitted by the serializer.

Department (`ExecDept`, string40), isolation requirement (`IsolationRequired`, string1), gas interval (`GasTestFreqHr`, string2), status (`Status`, string4) and existing SAP references match metadata. `GasTestRequired` is absent from the header; the frontend stores it as `_Safety` Category PTW / ItemCode GREQ / Response YES or NO. Metadata allows this row shape but does not demonstrate that backend business logic interprets GREQ.

Status INTD/CRTD fits the property's length. The metadata does not expose an enum or prove backend transition/approval rules. Backend implementation must confirm that initial INTD is preserved and all required approvals are checked.

### Computed crew quantity

`PermitInfoType/PersonsQty` is annotated `Core.Computed`, alongside Permit_No and the creation audit fields. The current serializer removes Permit_No and audit fields but still sends PersonsQty. Keep local PersonsQty for checking the crew count, then omit it from the transmitted body and let SAP derive it. A computed field may be ignored/rejected by the server; static shape validation alone cannot prove acceptance.

The recommended metadata-aligned example bodies below omit PersonsQty and contain no isolation certificate/point inserts:

- [Hot order / INTD](payloads/permit-create-hot-order.metadata.json)
- [Hot notification / INTD](payloads/permit-create-hot-notification.metadata.json)
- [Cold order / CRTD](payloads/permit-create-cold-order.metadata.json)

These are recommended request bodies; the app serializer still emits the original `.json` examples' PersonsQty. Replace example identities, references, department codes and validity dates with actual data before use. Preparation NO values are pending reports, not signed clearance. Populate actual required PPE/questionnaire evidence. No SAP business validation was exercised.

## Isolation mismatch

The metadata defines a certificate keyed solely by `IsolationNo`:

```text
IsolationType
  IsolationNo, PermitNo, Status
  Requested*, Verified*, Approved*, Normalized*, Remarks, LastChangedAt
  _Item → Collection(ItemType)
```

Physical point fields are in ItemType, keyed by IsolationNo + ItemNo:

```text
ReferenceType, ReferenceId, IsolationPoint, IsolType, IsolMethod
IsolatedState, DeIsolatedState, LockTagNo, IsIsolated, IsolatedBy/At
ZeroEnergyConf/By/At, IsNormalized, NormalizedBy/At, Remarks
```

The current permit-create schema still sends points directly under `_Isolation`, including ItemNo, IsolType, ReferenceType, ReferenceId, IsolationPoint, IsolMethod, LockTagNo, IsIsolated and ZeroEnergyConf. Nineteen local IsolationType properties are absent from the new IsolationType. Such rows will not match the supplied type; their point data belongs in `_Isolation` certificate → `_Item` rows or in a separately created Isolation certificate, subject to the backend's permitted workflow.

PermitInfo has `_Isolation` for reading, but its navigation insertion declarations do not explicitly advertise `_Isolation`. Isolation explicitly advertises `_Item` insertion. Do not assume permit deep-create accepts isolation certificate insertion; confirm with backend. The user's deferred module flow can create the permit first with no `_Isolation` rows, then create/link the certificate through the verified Isolation contract.

IsolationNo, certificate Status, Requested*/Verified*/Approved*/Normalized* and LastChangedAt are computed. Item IsolationNo and ItemNo are computed. SAP allocates these and stamps certificate actions. Existing separate isolation API/UI already uses `_Item`, but permit-create and the generic prerequisite panel retain the old flat model. Existing local-store fallback on isolation save is not evidence of a successful SAP save.

## Gas and action mismatch

PermitInfoType has no `_GasTest` navigation. The current `sitePermitApi.read` expands `_GasTest`, which is an invalid navigation for this supplied service and can cause the entire detail GET to fail. Read gas records from the `GasTest` entity set by PermitNo; expand `_Isolation(_Item)` to see certificate points. The old generic prerequisite response validator also incorrectly requires `_GasTest` in the returned permit.

GasTest is explicitly non-insertable, non-updatable and non-deletable. The metadata exposes no writable gas child navigation and no action accepting measurement parameters. Therefore it does not provide a verified way for the UI to record new readings. `finalizeGasTest` can finalize existing backend data but, as declared, cannot receive the proposed GasTest evidence object. Backend must explain where readings are entered or expose the intended writable/action contract.

The declared bound actions are:

| Action | Bound entity / return type | Explicit input parameters |
|---|---|---|
| completeIsolation | IsolationType | None |
| approveIsolation | IsolationType | None |
| normalizeIsolation | IsolationType | None |
| finalizeGasTest | PermitInfoType | None |

The `_it` parameter in metadata is the binding entity represented by the URL, not a JSON input field. Example calls use an empty JSON object:

```http
POST Isolation('<IsolationNo>')/com.sap.gateway.srvd_a2x.zptw_services.v0001.completeIsolation
{}

POST Isolation('<IsolationNo>')/com.sap.gateway.srvd_a2x.zptw_services.v0001.approveIsolation
{}

POST Isolation('<IsolationNo>')/com.sap.gateway.srvd_a2x.zptw_services.v0001.normalizeIsolation
{}

POST PermitInfo('<Permit_No>')/com.sap.gateway.srvd_a2x.zptw_services.v0001.finalizeGasTest
{}
```

These are metadata-derived routes, not live-tested approvals. Use SAP authentication, CSRF and the backend's concurrency requirements. Isolation actions return IsolationType, not an expanded PermitInfo. Reload the permit to obtain its resulting status. Action names do not prove their business preconditions or a mandatory execution order.

The earlier proposed `UpdatePrerequisite` action is absent. Setting VITE_PTW_PREREQUISITE_ACTION to one of the above will not make the current adapter compatible: its binding, Kind/Decision/evidence parameters and required response shape differ. Implement dedicated adapters for the declared actions after backend behavior is confirmed.

## Backend confirmations needed

1. Confirm mandatory department/master validation, GREQ semantics, initial INTD/CRTD and all-required approval transitions. Metadata alone does not specify them.
2. Confirm creation/linking of Isolation after the permit, computed key generation, allowed certificate create fields and when each bound action is valid.
3. Supply the measurement-entry contract; GasTest CRUD is disabled and finalizeGasTest has no evidence parameters.
4. Confirm version/ETag behavior, idempotent/uncertain action handling and action error responses. LastChangedAt exists but this metadata has no explicit OptimisticConcurrency annotation.
5. Enforce LotoRequired=Y implies isolation-required: current frontend initial status still ignores LOTO when isolation is No.

## Verification scope

Parsed the supplied XML, compared six creation entity schemas, checked entity sets/navigations/action signatures/computed annotations, and checked all three current JSON examples recursively for unknown properties, lengths and nullability. Their non-isolation fields pass structural checks; PersonsQty is the computed-field exception. Full SAP runtime validation, required business defaults and actual work authorization were not tested. Application code was left unchanged for this verification.
