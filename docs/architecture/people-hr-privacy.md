# People & HR privacy operations

This is a deployment guide and notice template, not legal sign-off. The workspace's organization
is responsible for assessing each purpose and lawful basis, identifying its controller/processor
roles and recipients, and approving retention before collecting employee records. Review the
[Data Privacy Act](https://privacy.gov.ph/data-privacy-act/) and its
[implementing rules](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/)
with the organization's privacy officer. Do not assume employee consent alone authorizes every
employment purpose or collection of sensitive documents.

## Notice to adapt before production collection

Provide a notice in the organization's onboarding policy linked by the onboarding template. Fill
in the organization-specific items before use:

- **Controller/contact:** organization name, privacy officer and contact/address.
- **Purposes and basis:** workspace identity/directory, employment administration, attendance,
  leave/approval processing, payroll calculation/review and onboarding. Record the assessed basis
  for each purpose and any additional conditions for sensitive information.
- **Data and necessity:** member name/avatar, optional employment code/title/department/manager,
  employment dates/location, schedules/punches, requests, required supporting documents, restricted
  compensation and payroll results. Identify what is mandatory and the consequence of omission.
  Do not request unrelated government, banking, family or medical details through general forms.
- **Recipients:** authorized employment administrators, assigned approvers, explicitly granted
  payroll staff and contracted hosting/storage processors. Ordinary directory viewers receive no
  salary, medical document or private request reason. Describe any approved external disclosure.
- **Location and transfers:** actual hosting/backup regions, subprocessors, contractual safeguards
  and any cross-border processing. Do not infer these from a workspace's timezone.
- **Retention:** approved durations and triggers by record class, legal holds and secure deletion
  process. Specify how long private attachments and backups persist after employment/access ends.
- **Rights and contact process:** the organization's authenticated process for access, correction,
  objections and other applicable rights, response ownership, and escalation to its privacy officer.

## Access and handling

Owners should separately grant people/leave, approval, onboarding and payroll capabilities. Review
grants periodically and whenever job responsibilities change. A generic admin cannot self-escalate.
A person may have different profiles and grants in multiple workspaces. Review both grants and
manager assignments; direct-report access does not expose salary. Avoid giving all-request access
to reviewers who only need their assigned queue. Verification and own-unreleased-pay restrictions
provide separation of duties, but the organization must assign qualified independent reviewers.

Use HTTPS to the API, encrypted database disks and backups, restricted database credentials,
private S3 encryption and bucket policies, short-lived signed URLs, and the existing authenticated
Electron key-store/session handling. HR object prefixes are isolated from general Drive. Do not
share signed URLs outside the authorized workflow or place them in analytics. Logs must retain
sanitized identifiers/actions and never raw salary snapshots, cookies or attachment bodies.

HR audit records intentionally contain restricted before/after change data. The viewer requires
both payroll read and permission-administration capability. Database/backup operators remain
privileged; restrict and audit their access separately. There is no application-level salary field
encryption or automatic document malware scanner. Use the deployment's database/object encryption
and approved document-scanning procedure when required by the organization's risk assessment.

## Retention, correction and offboarding

Define a record schedule for employment history, punch/correction evidence, requests/medical
attachments, payroll and verification, onboarding documents, access logs and backups. Have the
privacy/payroll owners verify applicable requirements; this implementation does not prescribe one
universal statutory retention period.

Membership removal revokes live application access and preserves historical pay/requests/audit.
It is not an erasure request. Closed payroll is immutable; corrections are explicit void/reissue or
subsequent-period adjustments with source references. The current product has no general workspace
retention/deletion engine. Use a reviewed operational job to apply approved retention, legal holds
and secure object/backup deletion; do not delete database references without reconciling associated
private objects and historical accounting requirements. Staging upload cleanup handles abandoned
uploads, not retention of completed employee evidence.

## Incident response and evidence

Follow the organization's incident process. Restrict/revoke affected grants and sessions, preserve
HR audit events plus provider/API/storage access logs, record discovery time, affected workspaces,
record classes and remediation owners, and investigate access to signed URLs/object versions.
Keep the incident record restricted and avoid copying document contents into general workspace
activity or public issue trackers. The privacy officer must assess any notification duties using
current NPC guidance; this software does not decide reportability or automatically notify parties.

Test backup restoration and access revocation with synthetic records, retain evidence of the test,
and verify that restored environments preserve grant restrictions and private object permissions.
