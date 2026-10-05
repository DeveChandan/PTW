> Historical review/proposal: frontend fixes are now implemented. See [current implementation and backend handoff](ptw-frontend-metadata-update.md). Statements below describing the old serializer or generic action are retained as review history, not the current integration contract.

# PTW department, isolation and gas prerequisite handoff

Date: 29 September 2026. Requested workflow; proposed backend contract, not a description of deployed SAP actions.

## Business rule

Execution department is mandatory. The requester explicitly selects Yes or No for isolation and gas testing. There is no default answer. Hot work and confined-space work require gas testing in the site form; confined space also requires isolation. SAP must independently enforce applicable site rules, including combined work categories.

| Isolation required | Gas required | Initial status | Condition for CRTD |
|---|---|---|---|
| No | No | CRTD | No prerequisite approvals needed |
| Yes | No | INTD | Isolation approved |
| No | Yes | INTD | Gas test approved and current |
| Yes | Yes | INTD | Both approved and current |

INTD means initiated with prerequisites pending. CRTD only enables the subsequent permit approval/issue process; it never authorizes field work. Module users add evidence after creation. A requester need not supply isolation points or gas readings at creation.

## 1. Existing creation endpoint

Keep `POST PermitInfo`, server numbering, authentication and current order/notification linkage. Add mandatory `ExecDept` validation (trimmed, up to 40 characters). Prefer a department master/allowlist validated by SAP; the frontend currently accepts department text because no department master API was supplied.

The current metadata has `IsolationRequired` but no header `GasTestRequired`. The frontend persists gas choice as exactly one `_Safety` row, Category `PTW`, ItemCode `GREQ`, Response `YES` or `NO`. `GasTestRequired` is frontend-only and is NOT transmitted as a header property. Do not infer gas requirement from a nonempty test interval or from the absence of readings. Old records without GREQ need explicit reconciliation, never a default No.

Merge these fields into the existing deep-create payload (this fragment is not a complete permit):

```json
{
  "ExecDept": "Mechanical Maintenance",
  "IsolationRequired": "Y",
  "IsolationStatus": "INTD",
  "GasTestFreqHr": "2",
  "Status": "INTD",
  "_Safety": [{
    "ItemNo": "1",
    "Category": "PTW",
    "ItemCode": "GREQ",
    "Response": "YES",
    "ValueText": "Gas testing required",
    "ValueNum": 0,
    "Unit": "",
    "ReferenceNo": "",
    "ResponsibleUser": "",
    "VerifiedBy": "",
    "VerifiedAt": null,
    "Remarks": ""
  }]
}
```

Existing plan/safety rows must remain alongside GREQ with unique ItemNo values. Optional requester isolation points are planning only: ignore client-supplied signatures, completed flags or approval status. When isolation is No, omit isolation rows and clear its status. When gas is No, send an empty GasTestFreqHr and GREQ=NO. SAP computes initial status independently, rejects invalid combinations and returns the actual permit number and status. The frontend flags an unexpected/missing returned status as unconfirmed and prevents a blind duplicate create.

## 2. Proposed bound action

Please implement one transactional OData V4 bound action and supply its fully qualified name from `$metadata`:

```http
POST PermitInfo('0000000001')/<namespace>.UpdatePrerequisite
Content-Type: application/json
If-Match: W/"current-permit-version"
Prefer: return=representation
X-CSRF-Token: <existing SAP token>
```

`<namespace>.UpdatePrerequisite` is a placeholder, not a verified endpoint. Configure the real action name as `VITE_PTW_PREREQUISITE_ACTION` after metadata and integration tests are confirmed. The existing SAP client supplies session/client context and CSRF. No new login or PMIntegration lookup is required.

Common action parameters:

| Field | Contract |
|---|---|
| RequestId | UUID string, max 36, idempotency and audit correlation |
| Kind | `ISOLATION` or `GAS` |
| Decision | `SAVE`, `APPROVE`, `REJECT` |
| Comments | Required nonblank string, max 255 |
| IsolationPoints | Present only for ISOLATION/SAVE, full current point list |
| GasTest | Present only for GAS/SAVE, one new immutable gas test |

No client `Status`, approver name, verification timestamp or signature is accepted. Actor and authorization come from the SAP session. Approval/rejection always operate on saved evidence under the supplied ETag, not simultaneously submitted evidence.

### Save isolation evidence

```json
{
  "RequestId": "6492bf66-791e-4bfd-a3bd-c448a2f96883",
  "Kind": "ISOLATION",
  "Decision": "SAVE",
  "Comments": "Isolation points checked on site",
  "IsolationPoints": [{
    "IsolationPoint": "Pump P101 main electrical isolator",
    "IsolType": "ELEC",
    "IsolMethod": "LOTO",
    "LockTagNo": "LOCK-101",
    "IsIsolated": true,
    "ZeroEnergyConf": true
  }]
}
```

IsolationPoint max60; IsolType max6; IsolMethod max10; LockTagNo max30. Booleans are action inputs; SAP maps these to existing Y/N storage and records authenticated actor/time for each verification. Validate allowed types/methods against SAP master data. Save the complete point set atomically, allocate point keys and isolation number in SAP, and retain removed/changed evidence in the audit history. Saving is not approval. Invalidate previous approval of the edited prerequisite.

### Save gas-test evidence

```json
{
  "RequestId": "8246f0cb-7c01-499a-bb74-d96c2c927d29",
  "Kind": "GAS",
  "Decision": "SAVE",
  "Comments": "Atmosphere sampled before planned entry",
  "GasTest": {
    "TestAt": "2026-09-29T10:15:00+05:30",
    "TestLocation": "Vessel V101, top / middle / bottom as recorded",
    "MeterId": "GAS-METER-01",
    "PolicyRef": "HSE-APPROVED-POLICY-REV-ID",
    "BumpTestOk": true,
    "O2Pct": "20.9",
    "LelPct": "0",
    "CoPpm": "0",
    "H2sPpm": "0"
  }
}
```

GasTest is a proposed complex action parameter: TestAt is Edm.DateTimeOffset, the four readings are decimal strings (define action parameters as strings or support the OData decimal string representation), BumpTestOk is boolean. Location, meter ID and policy reference are strings up to100; agree final limits/mapping in metadata before enabling. CO/H2S units here are explicitly ppm; convert or reject if the storage/site policy uses different units. The example numbers demonstrate syntax, not an approved acceptance table. SAP stores TestSeq, date/time, tester and meter/calibration evidence, retaining all prior tests. If multiple sampling locations or additional gases are required, the backend must reject incomplete clearance; agree an expanded sampling payload before enabling such work.

No automatic frontend "safe" decision is made. The source PDF has conflicting acceptance limits on pages11,14,24. HSE supplies the authoritative, versioned gas policy. SAP looks it up by PolicyRef and validates it for plant, work categories and date. A typed reference alone is not approval of that policy. Verify meter calibration, bump test, actual sample time, required sample coverage, gas units, acceptance limits and expiry/retest interval. Save failing results as evidence but do not permit approval.

### Approve or reject saved evidence

```json
{
  "RequestId": "5b49cd4a-a7a1-4875-9625-e3a4a9d4ac61",
  "Kind": "ISOLATION",
  "Decision": "APPROVE",
  "Comments": "Reviewed all saved points and zero-energy verification"
}
```

Use Kind=GAS for gas approval. Use Decision=REJECT with a mandatory reason for rejection. Do not include IsolationPoints or GasTest for these decisions.

## 3. Atomic SAP processing and permissions

1. Validate session, plant scope, competence, module role and any required independent verifier/approver separation. Frontend visibility is not an authorization boundary. Admin/testing access must not bypass site competence requirements.
2. Lock the permit and verify the current ETag. Only this initial INTD workflow accepts these actions; reject other lifecycle states. Later retests, revalidation and suspension need their own controlled actions.
3. Reject actions for prerequisites not explicitly required. Reject missing/duplicate requirement rows and unknown requirement values. Do not allow this action to change the original requirements.
4. SAVE persists actual evidence, clears that prerequisite's previous approval and leaves the permit INTD. REJECT records the rejection and leaves INTD. APPROVE checks complete saved evidence and stamps a server audit/approval record tied to the current evidence version. Isolation needs every point physically isolated and zero energy verified; reject normalized/restored, partial or empty sets.
5. Recheck BOTH required prerequisites in the same transaction. Only set CRTD when all required approvals are valid. An expired gas test, revoked isolation, rejected evidence or changed evidence cannot count as approved. Keep INTD if another required check is pending.
6. Commit evidence, approval, audit and permit status together; increment the permit ETag for any child evidence change. No partial commit followed by a frontend header PATCH. Concurrent module users receive412 on an old ETag and reload/review before another decision.
7. Deduplicate RequestId by permit and authenticated actor. Same ID plus same payload must never duplicate tests/signatures; different payload with the same ID must fail409. Audit RequestId and provide a lookup for uncertain outcomes. The current frontend never auto-retries an uncertain write.
8. Subsequent issue/release actions must revalidate evidence freshness and current isolation, even if the permit was previously CRTD. Do not silently downgrade an active permit to INTD; use the site's suspension/revalidation workflow.

## 4. Response and errors

Return200 with the updated PermitInfo entity directly (no `d`, `value` or `Result` wrapper), a new `@odata.etag` (or ETag header), and expanded `_Safety`, `_Isolation`, `_GasTest`, `_Approval`, preferably `_AuditLog`. Return all normal permit header fields as in existing GET. Empty arrays are allowed only when there is genuinely no evidence. The UI refreshes from this response and displays the actual server status.

Schematic response (include all existing header fields and complete stored rows in production):

```json
{
  "@odata.etag": "W/\"next-permit-version\"",
  "Permit_No": "0000000001",
  "Status": "INTD",
  "ExecDept": "Mechanical Maintenance",
  "IsolationRequired": "Y",
  "IsolationStatus": "APPR",
  "GasTestFreqHr": "2",
  "_Safety": [{ "Category": "PTW", "ItemCode": "GREQ", "Response": "YES" }],
  "_Isolation": [],
  "_GasTest": [],
  "_Approval": [],
  "_AuditLog": []
}
```

Above is structural only: actual approved isolation must include its saved points and signature records. Overall status remains INTD in this example because gas approval is still pending. Existing permit GET must also return the latest ETag and expanded evidence.

Return OData errors:400 invalid input,403 unauthorized,409 wrong lifecycle/incomplete or failing evidence,412 stale ETag. Error messages should identify the pending or failed requirement. Roll back on errors. Network failures,5xx and incomplete success bodies are treated as uncertain by the UI; users must check the SAP audit before a new request.

## 5. Deliverables requested from backend team

- Updated `$metadata`, verified bound action name and full complex parameter definitions matching the examples (or the agreed differences).
- INTD allowed in the status domain, server creation derivation, mandatory department validation and GREQ persistence/readback.
- Transactional save/approve/reject implementation, roles and evidence-version handling.
- ETags on header GET and all action responses, including when child evidence changes.
- Approved gas-policy and calibration lookup logic; final sample coverage/extra-gas requirements.
- Department master endpoint if selection must be restricted to registered departments.
- Audit lookup by RequestId for ambiguous network outcomes.

## 6. Acceptance tests before enabling

Test all four requirement combinations, both approval orders, one-of-two approved staying INTD, rejected/failed/expired evidence, missing department/choices, unknown legacy GREQ, combined categories, unauthorized/other-plant users, stale ETags, concurrent approvals, duplicate RequestId, timeout after commit, and rollback after evidence persistence failure. Verify no signatures can be supplied through create. Confirm lookup/login behavior stays unchanged. The local frontend test matrix covers request validation and adapters using fixtures; it does not prove SAP enforcement.
