# Figma typography and text colours

Read from the Figma file (duplicate `pMNsQw4Eze8zoH8ERvQhdJ`, page "Design") on 22 Oct 2026 with a
read-only script that listed every visible text layer of each module's section, grouped by
font / weight / size / colour. "x12" is how many layers use that style. Sample texts show where it
is used. Pasted leftovers from other frames (the Payroll dashboard's "Salary Frequency / Daily /
Hour / Seamless Solutions…" header, sample avatars) are ignored.

Sizes are px at the frame's own width (1320 to 1697 px wide frames); the app uses them as px
(1rem = 16px).

## Families

The design uses two families:

- **Poppins** for the app chrome and lists: sidebar, sub menus, page titles, tabs, table headers
  and cells, status chips, list toolbar buttons, row menus in Requests.
- **Inter** for forms and dialogs: dialog titles, field labels, field values and placeholders,
  dialog footer buttons (Save, Cancel, Reset, Search, Save Preset), the employee card in
  dialogs, the pager. The older frames (Warning, Settings → Control Panel, Roster, Scheduling,
  Attendance overview and time sheets) use Inter for most of the page as well.

## Shell (newest Side Menu component `2699:67267`, Requests Sub Menu `2693:14257`)

| Element                                      | Style                                       |
| -------------------------------------------- | ------------------------------------------- |
| User name                                    | Poppins Medium 16 #FFFFFF                   |
| User role                                    | Poppins Light 11 #D1D4D8                    |
| Menu item                                    | Poppins Regular 13 #B9BDC4                  |
| Menu item, current                           | Poppins Regular 13 #FFFFFF on #293749       |
| Menu child link (Payroll, Requests children) | Poppins Regular 13 #D9D9D9; current #FFFFFF |
| Sub menu card item                           | Poppins Regular 14 #707070                  |
| Sub menu card item, current                  | Poppins Medium 14 #17263A on #E8EAEC        |

## Lists

| Element                                        | Requests, Attendance logs / settings / overtime, Payroll settings                                                     | Payroll lists, Leave Encashment, Assets, Clearance, End of Employment, Checklist, Request Settings |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Page title                                     | Poppins Medium 20 #303030                                                                                             | Poppins Medium 24 #303030                                                                          |
| Page tabs (Request / Approvals, settings tabs) | Poppins Regular 13 #5C5C5C; current Poppins Medium 14 #17263A                                                         | same                                                                                               |
| Status tabs ("All (8)", "Pending (2)")         | Poppins Regular 13 #5C5C5C; current Poppins Medium 14 #17263A                                                         | —                                                                                                  |
| Table header                                   | Poppins Medium 11 #303030                                                                                             | Poppins Medium 14 #303030                                                                          |
| Table cell                                     | Requests: Poppins Regular 12 #707070 (Punch) / 9 (Transfer); Attendance, Payroll settings: Poppins Regular 11 #707070 | Poppins Regular 14 #303030                                                                         |
| Person cell                                    | name Poppins Medium 11 #505050 (Requests 9), code Poppins Regular 9 #707070 (Requests 7)                              | name Poppins Medium 11 #202020, code Poppins Regular 9 #707070                                     |
| Status chip                                    | Poppins Medium 10, colour by status                                                                                   | Poppins Medium 10                                                                                  |
| Toolbar button (+ Create, Filters, Import)     | Poppins Medium 12 #FFFFFF                                                                                             | Poppins Medium 12 #FFFFFF                                                                          |
| Filter (outlined)                              | Poppins Medium 14 #17263A                                                                                             | —                                                                                                  |
| Approved / Unapproved                          | Poppins Medium 14 #FFFFFF                                                                                             | Poppins Medium 14 #FFFFFF                                                                          |
| Row menu                                       | Poppins Medium 12 #303030                                                                                             | Inter Regular 14 #475569                                                                           |
| Pager                                          | Inter Regular 14.2 #D9D9D9; current Inter Medium 14.2 #FFFFFF                                                         | same                                                                                               |

Status chip colours: Approved / Active / Completed / Run / Released / Allocated #51B969; Pending
#EBA51E (Requests), #F08035 at 90% (Clearance, End of Employment), #FF8A1D (Balances); Rejected
#D83838; Cancelled #8B5CF6; Cancelling #F87927; Closed / Ready to Release #2975FB; On Hold /
In Active #E50141; Unavailable #EF493E.

## Dialogs and forms (Inter)

| Element                                                                  | Style                                                                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Dialog title                                                             | Inter Medium 24 #000000                                                                                                 |
| Field label                                                              | Inter Regular 16 #000000                                                                                                |
| Required mark                                                            | Inter Regular 18 #E50141 (Requests: Inter Regular 16 #D80027)                                                           |
| Placeholder                                                              | Inter Regular 16 #707070 (Requests, Leave Encashment, Balances) / Inter Regular 14 #475569 (Payroll, Assets, Clearance) |
| Field value                                                              | Inter Regular 14 #475569                                                                                                |
| Footer buttons (Save, Cancel, Reset, Search, Save Preset, Flow, History) | Inter Medium 16 #FFFFFF                                                                                                 |
| Attach                                                                   | Inter Regular 14 #FFFFFF (Payroll, Assets) / Inter Regular 16 #707070 (Requests)                                        |
| Employee card                                                            | name Inter Medium 24 #000000; "Location:" labels Inter Semi Bold 17 #000000; values Inter Regular 16 #000000            |
| "Are you sure you want to …"                                             | Inter Regular 22 #000000                                                                                                |
| "No Record Found"                                                        | Inter Medium 16 #000000 (lists) / Inter Medium 23 (time sheet)                                                          |

Attendance Logs, Overtime and Attendance Settings draw their dialogs in Poppins instead:
title Poppins SemiBold 20 #202020, labels Poppins Regular 14 #303030, placeholder Poppins
Regular 14 #A4A4A4, required mark Poppins Regular 14 #D83838, buttons Poppins Medium 15 #FFFFFF
(Settings: 14), settings switches' labels Poppins Regular 14 #303030.

## Older frames (Inter pages)

| Module                            | Title                   | Table header                               | Table cell                                                                                       | Labels / fields                                                                                                                               |
| --------------------------------- | ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Warning                           | Inter Medium 20 #000000 | Inter Semi Bold 16.2 #1E293B               | Inter Regular 16.2 #1E293B                                                                       | labels Inter Regular 13.2 #94A3B8; form fields Poppins Regular 16 #303030; buttons Inter Regular 14 #334155 / Inter Regular 14 #FFFFFF (Save) |
| Settings → Control Panel          | Inter Medium 20 #000000 | —                                          | —                                                                                                | labels Inter Regular 16 #000000; placeholder Inter Regular 16 #707070; Save / Cancel Inter Medium 16 #FFFFFF; menu Inter Regular 10 #303030   |
| Roster                            | Inter Medium 20 #000000 | Inter Medium 20 #FFFFFF on the dark header | Inter Medium 20 #303030 (group titles), Inter Medium 14 #303030 (dates)                          | Inter Medium 16 #FFFFFF buttons                                                                                                               |
| Scheduling                        | Inter Medium 20 #000000 | Inter Medium 16 #585858 (days)             | Inter Medium 12 #585858 (shift times), person Inter Medium 14 #101828 + Inter Regular 12 #475467 | filters Inter Regular 14 #475569; dialogs Inter Medium 24 #000000, labels Inter Regular 16 #000000                                            |
| Attendance overview / time sheets | Inter Medium 20 #000000 | Inter Medium 16 #FFFFFF                    | Inter Medium 16 #303030                                                                          | filters Inter Regular 14 #475569                                                                                                              |
