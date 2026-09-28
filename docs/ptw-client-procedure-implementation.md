# Client procedure implementation

## Delivered in this update

The existing login, session handling, notification/order lookup, source selection, filters and SAP work-reference mapping are preserved. The new client-procedure form is added after General Details and before Crew Muster. This update follows HSE/SAF/P/01 Rev-03 and its annexed HSE/SAF/02 Rev-08 form. The separate rights-managed DOCX remains unreadable and has not been treated as an equivalent source.

- All eleven primary category choices, including electrical and Other, and additional categories for combined work.
- Nature of work and tools/equipment from sections C and D.
- Signed JSA reference, joint site visit notes, planned shift end in IST, proposed issuer/acceptor/operator and Approver I/II/III IDs.
- Conditional fire-watch, standby, rescue, isolation-drawing, rigging, depth, chemical and radiation-permit planning fields.
- Job-specific preparation checklists. YES means requester-reported complete, NO means outstanding/pending, and NA requires a reason. None of these creates a verified signature.
- Time-based approval planning guidance with visible unresolved client decisions.
- New site requests must fit eight hours or the declared shift end, whichever is earlier. This is initial planned validity, not an authorized extension. No guessed site shift calendar is used.
- Combined hot/confined-space work cannot use a planned gas interval over two hours. Confined-space requests require an isolation plan. Initial request checks are not substitutes for backend field-release checks.
- Issuer and acceptor proposals must differ; area, execution department and JSA details are required.
- The free-text safety category now fits the six-character SAP field (`GEN`, replacing the invalid `GENERAL`).
- Permit Details, Approver, Issuer, Holder, Gas Tester and Isolation modules now have SAP-backed evidence review screens. The original role gates remain in place. These screens use actual PermitInfo field and navigation names and display missing evidence without assuming clearance.
- The gas helper no longer chooses a default policy from contradictory source clauses. Calibration errors/missing values no longer assert successful calibration. The legacy gas write is blocked until its actual SAP action is integrated.

## Persistence mapping

Creation still POSTs to PermitInfo through the existing create API. It still creates CRTD requests with server-assigned numbering. No signatures, gas readings, approvals, renewals or audit events are manufactured.

New planning data is serialized into the existing `_Safety` navigation with `Category=PTW`. All fields fit the supplied creation schema. `ItemNo` is regenerated across both procedure rows and additional user checks by the existing serializer. Category codes and custom item codes need backend/domain acceptance in integration testing; a structurally valid OData string does not prove that SAP business validation accepts the value.

| Item code | Meaning | Value location |
|---|---|---|
| DOCV | Procedure and source form identity | Remarks |
| TYPE | One row per applicable category | Remarks |
| NATR / TOOL | One row per selected nature / tool | Remarks |
| JSA1 | Signed JSA reference | ReferenceNo and Remarks |
| JSA2 | Joint visit / JSA team notes | Remarks |
| SHFT | Declared shift end, local ISO datetime in IST | Remarks |
| ISSR / ACCP / OPER | Proposed responsible SAP user IDs | Remarks; not verified signatures |
| AP01 / AP02 / AP03 | Proposed approvers | Remarks; not an approved route |
| DIST, FWAT, STBY, RESC, DRAW, RIGP, LOAD, DEPT, CHEM, RADP, OTHR, NOTE | Conditional plans and supporting references | Remarks; document references also use ReferenceNo |
| F001–F008 and activity-specific F codes | Preparations | Response and Remarks |

Descriptive rows use Response=NA because they are not yes/no attestations. Preparation rows default to NO while unassessed. `VerifiedBy` remains empty and `VerifiedAt` remains null. The detail screen explains these distinctions.

Primary category mapping retained: HOT, COLD, CONF, ELEC, HGHT. New proposed SAP codes: EXCV, LINE, RIGG, RAD, HYPN, OTHER. Confirm the permitted SAP values before rollout. Additional categories remain separate safety rows instead of encoding multiple values into PermitType.

## Remaining integration work

The delivered system is request entry and evidence review. It is not the complete digitally signed field workflow. The following need the SAP service implementation/metadata and controlled client decisions:

1. Confirm category/item code acceptance and verify that the `_Safety` deep insert saves and returns every planning row. If the backend constrains these codes, maintain the corresponding domains/checklists or provide dedicated planning fields.
2. Supply the bound SAP actions and payload/response contracts for submit, verify, approve/reject, accept, issue, gas-test recording, isolation certification, renew/revalidate, suspend/resume, trial energization, closure and power restoration. No speculative action names were added.
3. Enforce role eligibility, plant/activity competence, segregation of duties, signature order, ETags, current validity, fresh gas evidence and isolation requirements on the server. Requester-supplied signatory proposals do not establish authorization.
4. Reconcile the gas thresholds, K/L/M section references, 22:00/23:00 trigger, line-breaking and rigging routes. Supply current individual standards where those take precedence.
5. Provide an accessible export of the revision DOCX to confirm whether its fields differ from the PDF's embedded form.
6. Implement signed toolbox attendance, confined-space entry/exit sessions, shift/personnel handover, temporary trial records, supporting-file upload/display, controlled print copies, emergency suspension and retention/audit controls.
7. Implement approved exceptions separately, including fabrication-yard extended validity, emergency regularization, delegated approvals and deviations. The new ordinary request form does not implement exception authorization.

Existing legacy lifecycle mutation helpers remain outside the new review screens. They must be replaced with verified backend actions, not wired directly into buttons. Admin remains the existing placeholder.

## Verification

- TypeScript check and production Vite build passed.
- 28 tests passed: existing login/work-lookup regression tests plus new category serialization, combined-work rules, validity/shift boundaries, midnight, invalid calendar dates, signatory separation, NA reasons, gas-policy handling, calibration failures and metadata-based permit reads.
- Local browser fixture checked conditional combined-work fields, permit search/detail display and empty gas evidence. Fixture API calls were mocked locally; no live SAP transactions were made.
- File hashes confirmed login, authentication context/client, order/notification API and work selection component were unchanged by this update.

Run `npm test`, `npm run lint`, and `npm run build`. In this session the npm launcher hit a local path-permission error; the equivalent Node commands were run successfully against the installed project tools.
