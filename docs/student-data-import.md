# Student Data Import & Entry — Nabeeh

## Overview

Teachers need multiple ways to get student data into the system. The method depends on how many students they have and where the data currently lives.

---

## 1. Import Methods

### Method 1: Manual Entry (One at a Time)
**Best for:** Adding 1-5 students, or adding a student mid-term.

**Flow:**
1. Teacher clicks [Add Student] on Students page
2. Form opens with required fields (name, student_code) and optional fields
3. Teacher fills form → saves → student created
4. Form stays open with a "Add another" option for bulk manual entry

**Fields:**
- `name` (required)
- `student_code` (required, unique per teacher)
- `phone` (optional)
- `email` (optional)
- `gender` (optional: male/female)
- `date_of_birth` (optional)
- `address` (optional)
- `notes` (optional)
- `parent_name` (optional)
- `parent_phone` (optional)
- `parent_relationship` (optional: father/mother/guardian)

---

### Method 2: Excel/CSV Import
**Best for:** Adding 10-500 students from a spreadsheet.

**Flow:**
1. Teacher clicks [Import from Excel] on Students page
2. System shows upload area (drag-and-drop or click to upload)
3. Teacher uploads `.xlsx` or `.csv` file
4. System auto-detects columns by header name (smart mapping)
5. System shows preview table with validation:
   - "Found 45 students"
   - "3 have missing phone numbers" (warning, can still import)
   - "2 have duplicate student codes" (error, must fix)
   - "1 has invalid phone format" (warning)
6. Teacher reviews → clicks [Import]
7. Success report: "42 students imported. 3 skipped (duplicate codes)."

**Column Auto-Detection:**

| CSV Header | Maps To | Required? |
|-----------|---------|-----------|
| name, student name, اسم الطالب | `name` | ✅ Yes |
| code, student code, كود | `student_code` | ✅ Yes |
| phone, tel, تليفون, موبايل | `phone` | No |
| email, البريد | `email` | No |
| gender, جنس, الجنس | `gender` | No |
| dob, date of birth, تاريخ الميلاد | `date_of_birth` | No |
| address, العنوان | `address` | No |
| notes, ملاحظات | `notes` | No |
| parent name, اسم ولي الأمر | `parent_name` | No |
| parent phone, تليفون ولي الأمر | `parent_phone` | No |
| relationship, صلة القرابة | `parent_relationship` | No |

**Validation Rules:**
- `name`: Must not be empty
- `student_code`: Must be unique within this teacher's students
- `phone`: Must match phone format (optional but validated if provided)
- `email`: Must be valid email format (optional but validated if provided)
- `gender`: Must be 'male' or 'female' (optional)
- `date_of_birth`: Must be valid date (optional)
- `parent_relationship`: Must be one of: father, mother, guardian, grandmother, grandfather, uncle, aunt, other

**Error Handling:**
- Duplicate student_code → skip row, report in results
- Missing required field → skip row, report in results
- Invalid format → skip field (keep rest of row), warn in results
- File too large (>10MB) → reject with message
- Wrong file type → reject with message

---

### Method 3: Copy-Paste from Excel/Google Sheets
**Best for:** Adding 5-30 students quickly without saving a file.

**Flow:**
1. Teacher clicks [Paste from Excel] on Students page
2. Opens a textarea + column mapping UI
3. Teacher copies cells from Excel/Sheets → pastes into textarea
4. System auto-detects columns (same logic as CSV import)
5. Shows preview table (same as CSV import)
6. Teacher confirms → students imported

**Technical:**
- Parse tab-separated values (TSV) from clipboard
- Auto-detect columns by header row
- If no header row, show column mapping dropdowns
- Same validation as CSV import

---

### Method 4: Student Self-Registration via WhatsApp
**Best for:** Letting students fill their own data. Teacher sends a link, student does the work.

**Flow:**
1. Teacher creates a group and clicks [Invite Students]
2. System generates a unique link: `nabeeh.com/enroll/{group_id}/{token}`
3. Teacher shares link via WhatsApp, SMS, or in person
4. Student clicks link → opens a web form
5. Student fills: name, phone, parent name, parent phone
6. System auto-generates student_code (or teacher configures format)
7. Student is enrolled in the group
8. Teacher sees new enrollment in dashboard

**Web Form Fields:**
- `name` (required)
- `phone` (required)
- `parent_name` (required)
- `parent_phone` (required)
- `parent_relationship` (required: father/mother/guardian)
- `notes` (optional — student can add anything)

**Token Behavior:**
- Token expires after 7 days or 50 registrations (whichever comes first)
- Token is per-group (student enrolls in the specific group)
- Teacher can revoke token at any time
- Token is single-use per phone number (prevents duplicates)

**Auto-Generated student_code:**
- Format: `{group_prefix}-{sequence}` (e.g., `M10-001`, `M10-002`)
- Group prefix configured by teacher when creating the group
- Sequence auto-increments

---

## 2. Configurable Required Fields

Teachers can configure which fields are required for their students.

### Default Config
```json
{
  "required_fields": ["name", "student_code"],
  "optional_fields": ["phone", "email", "gender", "date_of_birth", "address", "notes", "parent_name", "parent_phone", "parent_relationship"]
}
```

### Teacher Can Toggle
- Make `phone` required (for WhatsApp bot features)
- Make `parent_phone` required (for parent notifications)
- Make `gender` required (for reports)
- Hide fields they don't use (simpler form)

### Settings Location
Settings > Students > Required Fields (toggle each field on/off)

---

## 3. Import Preview & Validation

### Preview Table
Before importing, teacher sees a table:

| # | Name | Code | Phone | Parent Phone | Status |
|---|------|------|-------|-------------|--------|
| 1 | أحمد محمد | M10-001 | 01012345678 | 01098765432 | ✅ Ready |
| 2 | فاطمة علي | M10-002 | — | 01055555555 | ⚠️ Missing phone |
| 3 | عمر حسن | M10-001 | 01011111111 | — | ❌ Duplicate code |
| 4 | سارة أحمد | M10-003 | 01022222222 | 01033333333 | ✅ Ready |

### Summary Bar
```
Found 4 students
✅ 2 ready  ⚠️ 1 warning  ❌ 1 error
```

### Actions
- [Import All] — imports all rows, skips errors
- [Import Valid Only] — imports only ✅ rows
- [Cancel] — closes without importing

### Error Resolution
- Duplicate code → teacher edits the code in the preview table
- Missing phone → teacher can add it inline or skip
- Invalid format → teacher corrects inline

---

## 4. Post-Import Actions

After successful import:
1. Show success message: "42 students imported successfully"
2. Show skipped rows: "3 students skipped (duplicate codes)"
3. Offer next actions:
   - [View Students] — go to students page
   - [Enroll in Group] — select which group to enroll imported students
   - [Add Parents] — add parent contacts for imported students
   - [Import More] — go back to import screen

---

## 5. Import History

### Table: `student_imports`
```sql
CREATE TABLE student_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('manual', 'csv', 'paste', 'self_register')),
  file_name TEXT,                    -- original filename for CSV/Excel
  total_rows INT,
  imported_rows INT,
  skipped_rows INT,
  error_rows INT,
  errors JSONB,                      -- detailed error breakdown
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Admin Can See
- All imports per teacher
- Success/failure rates
- Common errors (to improve validation messages)

---

## 6. Technical Implementation

### CSV/Excel Parsing
- Library: `papaparse` (CSV) + `xlsx` (Excel)
- Auto-detect delimiter (comma, tab, semicolon)
- Handle BOM (UTF-8 Excel files)
- Support Arabic column headers

### Column Mapping Algorithm
```
1. Read first row as headers
2. For each header:
   - Normalize: lowercase, trim, remove whitespace
   - Match against known patterns (name, code, phone, etc.)
   - If match found → auto-map
   - If no match → show "Unknown column" warning, skip
3. Show mapping to teacher for confirmation
4. Allow teacher to remap columns manually
```

### Phone Number Normalization
- Remove spaces, dashes, parentheses
- Add +20 prefix if Egyptian number (010/011/012/015)
- Validate format after normalization

### Student Code Uniqueness
- Check against existing students for this teacher
- Check against other rows in the same import
- If duplicate found → skip row, report in results

---

## 7. UX Components

### Components to Build
1. `StudentImportModal` — main import modal with tabs (Upload / Paste / Self-Register)
2. `FileUploadZone` — drag-and-drop file upload area
3. `ColumnMapper` — auto-detected column mapping with manual override
4. `ImportPreviewTable` — validation preview with status indicators
5. `ImportResults` — post-import summary with actions
6. `SelfRegistrationLink` — generate and share enrollment link
7. `SelfRegistrationForm` — public web form for student self-enrollment
8. `RequiredFieldsConfig` — settings toggle for required fields

### Import Modal Layout
```
┌─────────────────────────────────────────────────┐
│ Import Students                          [Close] │
├─────────────────────────────────────────────────┤
│ [Upload Excel] [Paste from Excel] [Self-Reg]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Drag and drop your Excel or CSV file here     │
│  or click to browse                            │
│                                                 │
│  📥 Download template                           │
│                                                 │
├─────────────────────────────────────────────────┤
│ Preview: 45 students found                     │
│ ✅ 42 ready  ⚠️ 2 warnings  ❌ 1 error         │
│                                                 │
│ [Import All] [Import Valid Only] [Cancel]       │
└─────────────────────────────────────────────────┘
```

---

## 8. Implementation Tasks

### Backend
1. Create CSV/Excel upload endpoint (`POST /api/students/import`)
2. Implement column auto-detection logic
3. Implement validation pipeline (required fields, format, uniqueness)
4. Create student import history table
5. Create self-registration link generation endpoint (`POST /api/students/enroll-link`)
6. Create self-registration web form endpoint (`GET /api/enroll/:token`)
7. Create self-registration submission endpoint (`POST /api/enroll/:token`)

### Frontend
8. Build `StudentImportModal` component
9. Build `FileUploadZone` component (drag-and-drop)
10. Build `ColumnMapper` component
11. Build `ImportPreviewTable` component
12. Build `ImportResults` component
13. Build `SelfRegistrationLink` component (generate + share)
14. Build `SelfRegistrationForm` (public page, no auth required)
15. Build `RequiredFieldsConfig` (settings page)
16. Add import button to Students page
17. Add copy-paste textarea with column detection
