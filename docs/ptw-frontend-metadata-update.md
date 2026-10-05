# Frontend update and backend handoff — 5 October 2026

The frontend now follows the supplied ZPTW service metadata. These changes have been checked locally with mocked SAP responses; live SAP business processing has not been tested.

## Permit creation

- Execution department is required; the request sends its department code.
- Isolation and gas testing use explicit Yes/No choices. Isolation is transmitted as SAP X/blank; gas retains its YES/NO safety row. Either Yes starts the permit at INTD; both No start at CRTD. SAP must validate this policy and the prerequisites independently.
- The incoming developer update consolidates LOTO into the isolation choice. The UI derives LOTO from isolation; contradictory direct input is rejected by the serializer.
- PersonsQty remains a local crew-count check but is omitted from the request because SAP computes it.
- Gas requirement is represented by the PTW/GREQ safety row, not an undeclared header property. No gas readings or signatures are fabricated.
- Isolation certificates are created separately after SAP returns the permit number. Flat isolation points are rejected in permit creation.
- Current complete example bodies are in [payloads](payloads/README.md). Login, notification and order lookup retain the existing SAP integration.

## Isolation module

The certificate create body contains PermitNo, Remarks and nested _Item points. SAP assigns IsolationNo, ItemNo, status and certificate signatures. Point completion flags start as N with empty actors and null timestamps.

```json
{
  "PermitNo": "0000000001",
  "Remarks": "Planned isolation for this permit",
  "_Item": [{
    "ReferenceType": "EQUIP",
    "ReferenceId": "ACTUAL_EQUIPMENT_ID",
    "IsolationPoint": "Actual isolation point",
    "IsolType": "ELEC",
    "IsolMethod": "LOTO",
    "IsolatedState": "Planned isolated state",
    "DeIsolatedState": "Planned restored state",
    "LockTagNo": "ACTUAL_TAG",
    "IsIsolated": "N",
    "IsolatedBy": "",
    "IsolatedAt": null,
    "ZeroEnergyConf": "N",
    "ZeroEnergyBy": "",
    "ZeroEnergyAt": null,
    "IsNormalized": "N",
    "NormalizedBy": "",
    "NormalizedAt": null,
    "Remarks": ""
  }]
}
```

Replace example identifiers and enumeration codes with valid SAP values. Metadata verifies shape and length, not business-code validity. PermitNo is immutable after creation; editing an existing certificate updates Remarks only.

## Native workflow requests

Namespace: `com.sap.gateway.srvd_a2x.zptw_services.v0001`.

| Entity binding | Action |
|---|---|
| `Isolation('<IsolationNo>')` | `completeIsolation` |
| `Isolation('<IsolationNo>')` | `approveIsolation` |
| `Isolation('<IsolationNo>')` | `normalizeIsolation` |
| `PermitInfo('<Permit_No>')` | `finalizeGasTest` |

Each request is POST to `<binding>/<namespace>.<action>`, body `{}`, with `If-Match: <current ETag>`, `Prefer: return=representation`, and the existing SAP session/CSRF headers. The frontend reloads SAP evidence after success and displays SAP's actual status. It never changes INTD to CRTD locally. Restore isolation requires the linked permit to be CLOS in the frontend; SAP must enforce its own restoration rules.

The backend must return the matching entity key, actual Status and current ETag, either in the entity or response header. Error messages must identify rejected business rules. Timeout or an ambiguous save/action result blocks another blind submission; the user must check the outcome in SAP.

## Backend work still needed

GasTest is read-only in the supplied metadata. The frontend reads `GasTest` separately by PermitNo; `_GasTest` is not a PermitInfo navigation. Users can review saved readings and request the declared finalizeGasTest action. New measurement entry needs an additional backend contract.

The backend team should provide the exact write endpoint/action and declared parameter names for: permit reference; readings with units and approved site limits; test time and validity/retest rules; instrument identity/calibration; test location; remarks; and any evidence references. SAP should derive the authenticated tester identity, approval signatures, pass/fail decision and resulting permit status. Provide the response schema, ETag behavior, duplicate-request handling and sample business errors before frontend measurement entry is enabled. These are required concepts, not proposed undeclared SAP property names.

Please confirm how isolation items receive actual completion/zero-energy evidence: the frontend currently creates planned points and calls the declared certificate actions. Metadata alone does not establish whether those actions populate every point or require another item-update operation. Also confirm that all required isolation and gas approvals gate INTD to CRTD, and that CRTD alone does not authorize work.

## Local validation

The 43 automated checks cover permit requirements, payload shape, nested isolation creation, native workflow action bindings, ETags, read-only gas writes, SAP failures and ambiguous outcomes. TypeScript and production build are also checked. No live business record was created or approved during verification.
