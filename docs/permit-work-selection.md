# Unified PMIntegration lookup

Updated against the supplied OData V4 metadata and ZI_PTW_PM_INTEGRATION CDS.
PMIntegration is read-only. Its composite key is ReferenceId + ReferenceSource.
WorkDate is nullable Edm.Date. Date filters are inclusive. The source values are
NOTIFICATION and ORDER; shutdown is an ORDER categorized as SHUTDOWN.

## Filter mapping

| UI category | UI source | ReferenceSource | WorkCategory | OrderNotifType |
| --- | --- | --- | --- | --- |
| Corrective | Notification | NOTIFICATION | CORRECTIVE | M2 |
| Corrective | Maintenance order | ORDER | CORRECTIVE | PM06 |
| Preventive | Maintenance order | ORDER | PREVENTIVE | PM01 |
| Shutdown | Shutdown | ORDER | SHUTDOWN | PM03 |
| Inspection | Maintenance order | ORDER | INSPECTION | PM05 |
| Other | Maintenance order | ORDER | OTHER | PM07 / PM08 |

Predictive remains visible but disabled: the supplied CDS contains no PREDICTIVE
branch. Category selection restricts reference sources and the order-type menu.
Switching category, source, type or dates invalidates previous results/selection
and aborts the in-flight lookup. Subsequent permit steps require a confirmed row.

Example (unencoded for readability):

```http
GET PMIntegration?$filter=WorkDate ge 2026-09-01 and WorkDate le 2026-09-25 and WorkCategory eq 'CORRECTIVE' and ReferenceSource eq 'NOTIFICATION' and (OrderNotifType eq 'M2')
```

The CDS itself excludes notification phase 3 and orders with PHAS2 = X; the
frontend does not treat those two different source status fields as a common
status code. It no longer filters on the absent lookup properties Qmart, Auart,
Qmnum, Aufnr or IsShutdown. Notification selection does not require a PM02 order.

## Autofill into PermitInfo

| Unified property | PermitInfo destination |
| --- | --- |
| ReferenceId | Qmnum for NOTIFICATION, Aufnr for ORDER |
| OrderNotifType | Qmart for NOTIFICATION, Auart for ORDER |
| JobDescription | JobDesc; also Qmtxt for NOTIFICATION |
| WorkDate | Qmdat for NOTIFICATION, PmBasicStartD for ORDER |
| Plant | Werks |
| EquipmentTag | Equnr |
| FunctionalLocation | Tplnr |
| PlannerGroup | PlannerGroup |
| Priority | Priority |

Opposite-source linkage is cleared. Leading zeroes are preserved. Fields absent
from the unified lookup (work center, finish date, area, assembly, revision,
execution department) are cleared instead of retaining sample/prior work data.
Permit hazard category is independent of the maintenance work category.

Metadata mismatch: FunctionalLocation allows 40 characters while PermitInfo.Tplnr
allows only 30. Values are not silently truncated; submission is blocked for an
overlength value so the SAP team can resolve this contract difference.

## Configuration and validation

VITE_PTW_WORK_ENTITY defaults to PMIntegration under VITE_ODATA_BASE_URL.
The old VITE_PTW_WORK_DATE_FIELD and VITE_PTW_SHUTDOWN_FILTER settings are no longer
used. WorkDate and the source/category/type properties now follow the metadata.
No additional Qmart or IsShutdown property is needed on PMIntegration.

Run `npm test`, `npm run lint` and `npm run build`. Unit tests cover each CDS branch,
invalid combinations, dates, key identity, response parsing, and permit mapping.
Live SAP data has not been tested; the supplied XML verifies the schema, not the
execution of CDS joins, authorizations or backend filtering.

## Real permit creation

The create screen starts empty and no longer ships sample workers, PPE, hazards,
gas results, signatures, attachments, approvals, renewals or random permit IDs.
The requester chooses a real reference, enters the actual work and crew, records
hazards/controls and adds the real PPE and safety requirements. Empty gas-testing
and approval evidence is intentionally not created. Creating a CRTD request is
not issuing a permit or authorizing work.

The user confirmed SAP generates Permit_No. The create serializer omits that key
and child PermitNo foreign keys from the deep insert, requests a returned entity,
and only displays success with SAP's returned permit number. It uses a property
schema extracted from the supplied XML to exclude FormRev/unknown properties and
validate lengths, dates, times and numeric values. Complete validity, supervisor,
work reference, crew and controls are checked before posting.

The POST has no automatic network retry. Missing returned identifiers, timeouts
and server errors are treated as unconfirmed outcomes; the screen blocks another
submission and asks the requester to check SAP before starting another request.
A successful save replaces the form with the returned number and status.

SAP login now requires a successful userinfo request and a real PTW role. The
SAP-returned role Z_MOBILE_PI_SHEET also grants all module access for testing,
as requested. This is an exact role match, not a username or offline login bypass.
The
old offline/mock bypass paths are removed. Passwords are not stored in browser
storage, and session restoration revalidates with SAP. The obsolete v1 browser
session is cleared. The selected SAP client is applied to all service requests.
SAP login HTML (including HTTP 200 with sap-authenticated: pending) is rejected.
CSRF token failure prevents a modifying request from being sent.

Read-only connectivity was checked on 2026-09-25: the SAP development host was
reachable and returned an authentication-pending login page. No authenticated
lookup or real permit was created during verification. Sign in to the local
application and perform the real workflow to verify SAP numbering and deep insert
behavior. Server-side authorization and business validation remain SAP's responsibility.
