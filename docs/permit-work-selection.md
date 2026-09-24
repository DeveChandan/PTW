# Permit work selection and SAP backend contract

Permit creation now starts with work selection, followed by the existing six
permit steps. Users choose Corrective, Predictive, Preventive, Inspection,
Shutdown or Other, then a reference source and inclusive From/To dates. They
search, select a reference and continue. Other steps and submission stay locked
until selection is confirmed. Changing search criteria clears the selection and
cancels the previous request. Reference keys in General Details are read-only.

Work category is the requester's classification; it does not guess a mapping
between each maintenance category and an SAP order type. The 85% / 13% / 2%
labels reflect the distribution supplied for notification/order/shutdown work.

## Backend team: extend PMIntegration

The user supplied an OData V4 response from `PMIntegration` with PermitNo, Status,
Qmnum, Aufnr, Auart, Tplnr, Equnr, Werks and Arbpl. The frontend calls this entity
under the configured OData service root using the existing SAP session.

Add these filterable properties to support the requested first step:

| Property | OData type | Required behavior |
| --- | --- | --- |
| WorkDate | Edm.Date, non-null | Date used for work lookup, serialized YYYY-MM-DD. Both From and To are inclusive. |
| Qmart | Edm.String | Notification type, M2 for the notification route. Empty for work without a notification. |
| IsShutdown | Edm.Boolean, non-null | True for shutdown work; false for other work. |

Retain the existing properties and support filtering on Qmnum, Aufnr and Auart.
Return the full matching `value` collection, or standard `@odata.nextLink` for
server paging. Currently, a paged response asks users to narrow their dates
instead of silently displaying an incomplete list.

Source filters sent by the frontend:

- Notification: Qmart = M2, Auart = PM02, nonempty Qmnum, IsShutdown = false.
- Order: Auart in PM01/PM03/PM05/PM06/PM07/PM08 (or the chosen type), nonempty
  Aufnr, IsShutdown = false.
- Shutdown: IsShutdown = true. Identify each row by Aufnr, Qmnum or PermitNo.

PM02 follows the user's original notification mapping. Keep the work category
separate from source selection. If business rules allow an M2 notification
without a PM02 order, adjust that filter in permitWorkLookup.api.ts.

Example order request (shown unencoded for readability):

```http
GET PMIntegration?$filter=WorkDate ge 2026-09-01 and WorkDate le 2026-09-24 and (Auart eq 'PM01') and Aufnr ne '' and IsShutdown eq false&sap-client=200
```

Example extended record:

```json
{
  "PermitNo": "PTW000001",
  "Status": "DUMM",
  "Qmnum": "10000123",
  "Aufnr": "40001234",
  "Auart": "PM01",
  "Tplnr": "PLANT-AREA-001",
  "Equnr": "10001234",
  "Werks": "1000",
  "Arbpl": "MECH-001",
  "WorkDate": "2026-09-24",
  "Qmart": "M2",
  "IsShutdown": false,
  "JobDesc": "Inspect process equipment"
}
```

The sample belongs to the order route because its Auart is PM01. A notification
result must match the notification filter above. Wrap results in `{ "value": [...] }`.

Optional autofill properties: JobDesc (or Description), AreaLoc, Assembly,
Priority, Revision, PersonResp, PlannerGroup, PmBasicStartD, PmBasicFinishD,
PmFinalDueD, ExecDept and DefaultPermitType. Missing values clear prior source
values so a notification cannot retain an unrelated order. Missing descriptive
fields remain available for manual completion in General Details.

## Frontend configuration

Defaults are PMIntegration, WorkDate and IsShutdown eq true. Override these with
VITE_PTW_WORK_ENTITY, VITE_PTW_WORK_DATE_FIELD and VITE_PTW_SHUTDOWN_FILTER when
needed. The date property must be Edm.Date. Restart Vite after changing config.
Backend errors are shown as errors; lookups never substitute dummy records.

Category and reference are included in the existing CreatorComment. No unknown
properties are added to PermitInfo. The lookup's PermitNo is not copied into the
new permit's identifier. Existing sample payload tools and downstream submission
behavior are outside this change. Loading a sample returns to step one and
invalidates the reference. Live integration remains pending the backend fields.
