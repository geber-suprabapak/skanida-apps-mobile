import { formatDateWIB, toWIB } from "~/lib/utils";
import { bffRequest } from "~/utils/bff";

export type BffAttendanceAction = "check_in" | "check_out";

export type BffHealthStatus = "healthy" | "unhealthy";

export type BffCheckResult = {
  robin: "pass" | "fail";
  enrollment: "pass" | "fail";
  permit: "pass" | "fail";
  schedule: "pass" | "fail";
  location: "pass" | "fail";
};

export type BffScheduleWindow = {
  start_at: string;
  end_at: string | null;
  action: BffAttendanceAction;
  late_deadline: string | null;
};

export type BffAttendancePrecheck = {
  allowed: boolean;
  action_type: BffAttendanceAction | null;
  blocking_reason?: string | null;
  location_name?: string | null;
  schedule_window?: BffScheduleWindow | null;
  checks?: BffCheckResult;
};

export type MobileAttendanceAction = {
  actionable: boolean;
  action_type: BffAttendanceAction | "none";
  message: string;
  details?: {
    location_name?: string;
    status?: "Hadir" | "Terlambat";
  };
};

export type BffAttendanceSubmitResult = {
  attendance_type: BffAttendanceAction;
  status_label: string;
  processed_ms: number;
};

export type BffEnrollmentStatus = {
  status: "enrolled" | "not_enrolled";
  embeddingCount: number;
  message: string;
};

export type BffEnrollmentResult = {
  imagesProcessed: number;
  imagesFailed: number;
  totalEmbeddings: number;
};

export type BffDashboard = {
  profile: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    nis: string | null;
    class_name: string | null;
    absence_number: string | null;
    avatar_url: string | null;
    role?: string | null;
  };
  attendance: {
    today_status: "pending" | "present" | "absent" | "leave";
    has_checked_in: boolean;
    has_checked_out: boolean;
    check_in_time: string | null;
    check_out_time: string | null;
    total_work_hours: number | null;
  };
  schedule: {
    day_key: string;
    start_check_in_at: string | null;
    end_check_in_at: string | null;
    start_check_out_at: string | null;
    end_check_out_at: string | null;
    compensation_minutes: number | null;
  } | null;
  face: {
    server_status: BffHealthStatus;
    enrollment_status: "enrolled" | "not_enrolled";
    message: string;
  };
  permit: {
    has_active_permit: boolean;
    active_category: string | null;
  };
  primary_action:
    | {
        allowed: false;
        type: null;
        reason_code: string;
        label: string;
        reason_message: string;
      }
    | {
        allowed: true;
        type: BffAttendanceAction;
        reason_code: null;
        label: string;
        reason_message: null;
      };
  server_time: {
    now: string;
    timezone: string;
    source: "bff";
  };
};

export type BffDashboardPrimaryAction = BffDashboard["primary_action"];

export type MobileAttendanceStatus = {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  checkInStatus?: "Hadir" | "Terlambat";
  totalWorkHours?: string;
  todayStatus: "present" | "absent" | "leave" | "pending";
};

export type MobileAttendanceSchedule = {
  mulai_masuk: string | null;
  selesai_masuk: string | null;
  mulai_pulang: string | null;
  selesai_pulang: string | null;
  kompensasi_waktu: number | null;
};

export type BffPermit = {
  id: string;
  category: string;
  description: string;
  date: string;
  approval_status: "pending" | "approved" | "rejected" | null;
  attachment_url: string | null;
  created_at?: string;
  rejection_reason?: string | null;
  rejected_at?: string | null;
};

export type MobilePermit = {
  id: string;
  kategori_izin: "sakit" | "pergi" | "izin" | "cuti";
  deskripsi: string;
  approval_status: "pending" | "approved" | "rejected" | null;
  tanggal: string;
  created_at: string;
  rejection_reason?: string | null;
  rejected_at?: string | null;
};

export type BffProfile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | number | null;
  gender?: string | null;
  role?: string | null;
  avatar_url: string | null;
};

export type BffServerTime = {
  now: string;
  timezone: string;
  source: "bff";
  epoch_ms: number;
};

type FilePart = {
  uri: string;
  name: string;
  type: string;
};

const formatIsoAsWIBTime = (value: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const wib = toWIB(date);
  const hours = String(wib.getUTCHours()).padStart(2, "0");
  const minutes = String(wib.getUTCMinutes()).padStart(2, "0");
  const seconds = String(wib.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const formatWorkHours = (hours: number | null) => {
  if (hours === null || !Number.isFinite(hours)) return undefined;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2)} jam`;
};

const attendanceMessage = (result: BffAttendancePrecheck) => {
  if (!result.allowed) {
    return result.blocking_reason ?? "Presensi belum dapat dilakukan.";
  }
  return result.action_type === "check_out"
    ? "Silakan lanjut presensi pulang."
    : "Silakan lanjut presensi masuk.";
};

export const toMobileAttendanceStatus = (
  attendance: BffDashboard["attendance"],
): MobileAttendanceStatus => ({
  hasCheckedIn: attendance.has_checked_in,
  hasCheckedOut: attendance.has_checked_out,
  checkInTime: attendance.check_in_time ?? undefined,
  checkOutTime: attendance.check_out_time ?? undefined,
  checkInStatus: attendance.has_checked_in ? "Hadir" : undefined,
  totalWorkHours: formatWorkHours(attendance.total_work_hours),
  todayStatus: attendance.today_status,
});

export const toMobileAttendanceSchedule = (
  schedule: BffDashboard["schedule"],
): MobileAttendanceSchedule | null =>
  schedule
    ? {
        mulai_masuk: formatIsoAsWIBTime(schedule.start_check_in_at),
        selesai_masuk: formatIsoAsWIBTime(schedule.end_check_in_at),
        mulai_pulang: formatIsoAsWIBTime(schedule.start_check_out_at),
        selesai_pulang: formatIsoAsWIBTime(schedule.end_check_out_at),
        kompensasi_waktu: schedule.compensation_minutes,
      }
    : null;

export async function getDashboard() {
  return bffRequest<BffDashboard>("/v1/mobile/dashboard");
}

export async function getMobileHealth() {
  return bffRequest<{ status: BffHealthStatus }>("/v1/mobile/health");
}

export async function getServerTime() {
  return bffRequest<{ server_time: string }>("/v1/mobile/time");
}

export async function precheckAttendance(params: {
  latitude: number;
  longitude: number;
}): Promise<MobileAttendanceAction> {
  const result = await bffRequest<BffAttendancePrecheck>(
    "/v1/mobile/attendance/precheck",
    {
      method: "POST",
      body: params,
    },
  );

  return {
    actionable: result.allowed,
    action_type:
      result.allowed && result.action_type ? result.action_type : "none",
    message: attendanceMessage(result),
    details: result.location_name
      ? {
          location_name: result.location_name,
        }
      : undefined,
  };
}

export async function submitAttendance(params: {
  action_type: BffAttendanceAction;
  image_base64: string;
  latitude: number;
  longitude: number;
}) {
  return bffRequest<BffAttendanceSubmitResult>("/v1/mobile/attendance/submit", {
    method: "POST",
    body: params,
    timeoutMs: 45_000,
  });
}

export async function getEnrollmentStatus() {
  return bffRequest<BffEnrollmentStatus>("/v1/mobile/face/enrollment/status");
}

export async function submitEnrollment(files: FilePart[]) {
  const form: ReactNativeFormData = new FormData();
  files.forEach((file) => {
    form.append("files", file);
  });

  return bffRequest<BffEnrollmentResult>("/v1/mobile/face/enrollment", {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
}

export async function listPermits(): Promise<MobilePermit[]> {
  const result = await bffRequest<{ items: BffPermit[] }>("/v1/mobile/permits");
  return result.items.map((permit) => ({
    id: permit.id,
    kategori_izin:
      permit.category === "sakit" ||
      permit.category === "pergi" ||
      permit.category === "cuti"
        ? permit.category
        : "izin",
    deskripsi: permit.description,
    approval_status: permit.approval_status,
    tanggal: permit.date,
    created_at: permit.created_at ?? permit.date,
    rejection_reason: permit.rejection_reason,
    rejected_at: permit.rejected_at ?? null,
  }));
}

export async function createPermit(params: {
  category: "sakit" | "pergi";
  description: string;
  attachment?: FilePart | null;
}) {
  const form: ReactNativeFormData = new FormData();
  form.append("category", params.category);
  form.append("description", params.description);
  form.append("date", formatDateWIB(new Date()));
  if (params.attachment) {
    form.append("attachment", params.attachment);
  }

  return bffRequest<BffPermit>("/v1/mobile/permits", {
    method: "POST",
    body: form,
    timeoutMs: 45_000,
  });
}

export async function getProfile() {
  return bffRequest<BffProfile>("/v1/mobile/profile");
}

export async function updateAvatar(
  file: FilePart | null,
  clear = false,
): Promise<string | null> {
  if (clear) {
    const result = await bffRequest<{ avatar_url: string | null }>(
      "/v1/mobile/profile/avatar",
      {
        method: "PATCH",
        body: { clear: true },
      },
    );
    return result.avatar_url;
  }

  if (!file) {
    throw new Error("File avatar tidak valid.");
  }

  const form: ReactNativeFormData = new FormData();
  form.append("file", file);
  const result = await bffRequest<{ avatar_url: string | null }>(
    "/v1/mobile/profile/avatar",
    {
      method: "PATCH",
      body: form,
      timeoutMs: 45_000,
    },
  );
  return result.avatar_url;
}

export async function changePassword(params: {
  current_password: string;
  new_password: string;
}) {
  return bffRequest<null>("/v1/mobile/profile/password", {
    method: "PATCH",
    body: params,
  });
}
