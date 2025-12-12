# 📄 Product Requirements Document (PRD)

**Project:** School Employee ID System **Status:** Draft v1 **Primary Users:**
Teachers, School Administrators **Secondary Users:** General Public
(verification only)

---

## 1. Problem Statement

Teachers need an official, verifiable school ID to access discounts and
institutional benefits. The school wants a secure, centrally managed way to
issue and verify employee IDs without manual card production or ad-hoc
documents.

Currently:

- No unified digital ID system exists.
- Verification by third parties is difficult.
- Employee status changes (inactive staff) are not automatically reflected.

---

## 2. Goals & Success Criteria

### Goals

1. Allow employees to securely **view and download** their own school ID.
2. Allow administrators to **manage IDs** for all employees.
3. Provide a **public verification page** accessible via QR code.
4. Ensure IDs automatically reflect employment status from the SIS.

### Success Metrics

- 100% of active employees have a generated ID.
- Verification page loads without authentication.
- Deactivated employees’ IDs immediately show invalid status.
- IDs are printable and mobile-friendly.

---

## 3. User Roles & Permissions

### 3.1 Employees

- Authenticate via Google OAuth (school email).
- View and download **only their own** ID.
- Cannot upload photos or edit metadata.

### 3.2 Administrators

- View and download **any** employee ID.
- Upload or replace employee photos.
- Set or override expiration dates.
- View SIS-linked status (active/inactive).

### 3.3 Public Users

- No authentication.
- Can access verification pages via QR code.
- Cannot view or download the ID card itself.

---

## 4. Employee ID Specification

### 4.1 Front of ID

- Full Name
- Job Title
- Employee ID Number
- Expiration Date
- Official School Logo
- Official School Colors
- Employee Photo (admin-uploaded)

### 4.2 Back of ID

- QR Code linking to verification URL:

  ```
  https://<app-domain>/verify/:employeeId
  ```

---

## 5. Verification Page

### Behavior

- Publicly accessible.
- Displays:
  - Employee name
  - Job title
  - Active / Inactive status
  - Expiration date
  - School branding

- No sensitive data (no email, no ID number).

### Status Rules

- **Valid** if:
  - SIS status = active
  - Current date ≤ expiration date

- **Invalid** otherwise.

---

## 6. Expiration Logic

- Default expiration date: **July 1 of the current school year**
- Admins may override manually.
- Expiration date stored locally (not SIS-derived).

---

## 7. ID Formats & Delivery

### Required

- **PDF** (print-ready, wallet-size layout)

### Recommended (Phase 2)

- PNG (mobile-friendly)
- Apple Wallet / Google Wallet pass (future)

---

## 8. Data Sources

- **FACTS SIS (REST API)**:
  - Employee ID
  - Full name
  - Job title
  - Employment status
  - School email (primary key)

FACTS SIS is a widely used Catholic school SIS with documented REST access for
personnel data .

---

## 9. Non-Goals (Explicitly Out of Scope)

- Physical card printing services
- Student IDs
- Editing employee data (read-only from SIS)
- Photo uploads by employees

---

## 10. Risks & Mitigations

| Risk             | Mitigation                             |
| ---------------- | -------------------------------------- |
| SIS API downtime | Cache last-known-good employee records |
| Photo misuse     | Admin-only upload, audit logging       |
| Public scraping  | Rate-limit verification endpoint       |

---
