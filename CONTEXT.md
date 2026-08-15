# Skanida Student Attendance

Domain language for Skanida's student attendance and leave application.

## Language

### Attendance
A student's attendance record for a check-in or check-out action on a WIB date.
_Avoid_: Absence as the primary domain concept.

### Attendance Workflow
A two-phase workflow a student uses to prepare and complete attendance; location, schedule, permission, face-verification readiness, or capture failures may block it.
_Avoid_: Attendance Attempt as the primary domain term; use Attendance Workflow.

### Face Enrollment
The process of registering a student's face photos for attendance verification.
_Avoid_: Face Readiness as the primary domain term.

### Face Verification Readiness
The combined state indicating that verification is available and the student's face is enrolled.
_Avoid_: A binary readiness flag without the combined verification state.

### Leave Request
A student's request to skip attendance on a specific date, with a category, description, and attachment.
_Avoid_: Permit as the primary domain term.
