> Supplied backend metadata review (5 October): see [verification report](../ptw-backend-metadata-verification.md). Recommended `*.metadata.json` bodies omit computed PersonsQty. Flat isolation rows and the proposed generic prerequisite action do not match this backend. All example bodies now omit PersonsQty and match the updated serializer.

# Current permit creation payloads — 5 October 2026

These examples were generated with the current `preparePermitCreate` serializer and site planning row builder. They are request bodies after frontend validation, not saved SAP permits. No API request was sent. Replace example order/notification numbers, plant, department code, people, dates, hazards and job data with actual values. Example validity is 6 October 2026, 08:00–16:00 IST; replace it before using later. The department dropdown sends Config_Code, such as MECH_STAT, not its description.

## Full JSON bodies

- `permit-create-hot-order.json`: order-linked hot work, isolation Yes, gas Yes; initial INTD. Isolation points are deferred to the module user.
- `permit-create-hot-notification.json`: same prerequisites with notification linkage; Qmnum/Qmart/Qmtxt/Qmdat are populated and Aufnr/Auart are empty.
- `permit-create-cold-order.json`: cold work with isolation No, gas No, LOTO No; initial CRTD.

The examples have one employee and one hazard. Empty PPE/isolation collections are omitted by the current serializer. The HOT examples include all 28 generated planning/safety rows, including GREQ; COLD includes 24. Preparation responses remain NO/pending, never asserted verified. Populate actual PPE and any SAP compliance questionnaire answers in the UI. Live questionnaire rows depend on the SAP response and are not fabricated in these examples.

## Current process

1. Sign in with SAP and open Permit Create.
2. Work Selection: choose category, source and date range; search PMIntegration and select an actual SAP order or notification. Its reference, job description, equipment, functional location and plant are mapped into the permit. A different selected job clears the prior site-specific plan/evidence.
3. General Details: select permit category, required execution department (from Config with local fallback), execution agency, area, shift, supervisor, validity and explicit isolation/gas Yes/No. LOTO is derived from the isolation choice. Department sends the code. Selecting a permit category loads its SAP questionnaire; saved responses become _Safety rows.
4. Client Procedure: nature of work, tools, joint assessment/JSA reference, shift end, proposed issuer/acceptor/operator and applicable preparations. Proposed people are planning records, not signatures.
5. Crew Muster: actual worker names and employee IDs or contractor company; PersonsQty must equal _Worker count.
6. PPE & Safety and Hazards: selected PPE/checklist rows and at least one hazard with control. Questionnaire rows use Category from SAP, ItemCode based on Q + question ID, ReferenceNo as the original question ID and response YES/NO/NA. Manual checks use GEN. Procedure rows use PTW.
7. Isolation Plan: create the permit first, then create its isolation certificate and nested _Item points in Isolation Create using the returned permit number. Creation does not store gas readings/tester signatures.
8. Review & Submit: serialize supported metadata properties, remove server-generated keys/audit fields, reindex child ItemNo values, compute initial status and POST PermitInfo. The Review tab's Copy JSON gives the actual body for the filled form.

Validation includes mandatory department/category/plant/job/supervisor/validity, SAP reference, actual crew and hazard controls. Site form additionally requires area, JSA, nature/tools, shift end and proposed people; issuer and acceptor must differ. Initial validity is at most eight hours or shift end, whichever is earlier. Hot work/confined space requires gas testing; confined space requires isolation. Gas retesting choices are 1 or 2 hours. These frontend checks do not establish backend approval or work authorization.

## Endpoint and request headers

```http
POST /sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/PermitInfo
Content-Type: application/json
Accept: application/json
Prefer: return=representation
sap-client: <selected SAP client>
X-CSRF-Token: <SAP-issued token>
```

This is the default service path; VITE_ODATA_BASE_URL can override it. Authentication and CSRF are supplied by the existing SAP client. The UI posts the full JSON directly, without a value/d/results wrapper. SAP assigns Permit_No and must return it with the actual matching Status. Missing numbering, unexpected status or uncertain network/save result prevents another blind create.

## Initial status and gas representation

| Isolation | Gas | Initial status |
|---|---|---|
| No | No | CRTD |
| Yes | No | INTD |
| No | Yes | INTD |
| Yes | Yes | INTD |

GasTestRequired is frontend-only. Do not send it as a header field. The transmitted choice is a single _Safety row with Category=PTW, ItemCode=GREQ, Response=YES/NO. GasTestFreqHr is empty when No. IsolationRequired is a header X/blank flag, and IsolationStatus is INTD when Yes, empty when No. Empty _Isolation is omitted.

PersonsQty, Permit_No, child PermitNo, creation/change audit fields and LastChangedAt are removed. _GasTest, _Approval, _AuditLog, _Attachment and _ShiftRenewal are excluded from creation. Header VerifiedBy/ApprovedBy/IssuedBy and their dates remain empty/null in the UI payload; they do not represent signatures.

Module completion is a separate action. SAP must confirm ALL required approvals before INTD becomes CRTD. Dedicated adapters use the supplied completeIsolation, approveIsolation, normalizeIsolation and finalizeGasTest actions with an empty JSON body and current ETag. See ../ptw-frontend-metadata-update.md for the backend handoff. CRTD is a created permit, not field release.

## Current gaps to account for

- The isolation choice determines LOTO in the updated UI. The serializer rejects LOTO Yes with isolation No. SAP should also enforce this relationship.
- The generic create validator skips site-specific validation if DOCV is absent. The UI always includes DOCV; backend enforcement must be independent of that marker.
- These JSON files validate against the current local schema/serializer. Actual department/worker/reference existence and SAP business rules require backend integration testing.
