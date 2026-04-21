import { formatDateWIB } from "~/lib/utils";
import { bffRequest } from "~/utils/bff";

export type BffAttendanceAction = "check_in" | "check_out";

export type BffAttendancePrecheck = {
  allowed: boolean;
  action_type: BffAttendanceAction;
  blocking_reason?: string | null;
  location_name?: string | null;
  schedule_window?: string | null;
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
    nis?: string | null;
    class_name?: string | null;
    role?: string | null;
    avatar_url: string | null;
  };
  today_date: string;
  today_status: {
    today: "pending" | "present" | "absent" | "leave";
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    checkInStatus: "Hadir" | "Terlambat" | null;
  };
  primary_action:
    | {
        allowed: false;
        type: null;
        reason_code: string;
        label: string;
      }
    | {
        allowed: true;
        type: BffAttendanceAction;
        reason_code: null;
        label: string;
      };
  schedule: {
    mulai_masuk: string | null;
    selesai_masuk: string | null;
    mulai_pulang: string | null;
    selesai_pulang: string | null;
    kompensasi_waktu: number | null;
  } | null;
  service_operational: boolean;
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

const attendanceMessage = (result: BffAttendancePrecheck) => {
  if (!result.allowed) {
    return result.blocking_reason ?? "Presensi belum dapat dilakukan.";
  }
  return result.action_type === "check_out"
    ? "Silakan lanjut presensi pulang."
    : "Silakan lanjut presensi masuk.";
};

export async function getDashboard() {
  return bffRequest<BffDashboard>("/v1/mobile/dashboard");
}

export async function getMobileHealth() {
  return bffRequest<{ operational: boolean }>("/v1/mobile/health");
}

export async function getServerTime() {
  return bffRequest<BffServerTime>("/v1/mobile/time");
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
    action_type: result.allowed ? result.action_type : "none",
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
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file as unknown as Blob);
  });

  return bffRequest<BffEnrollmentResult>("/v1/mobile/face/enrollment", {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
}

export async function listPermits(): Promise<MobilePermit[]> {
  const permits = await bffRequest<BffPermit[]>("/v1/mobile/permits");
  return permits.map((permit) => ({
    id: permit.id,
    kategori_izin: permit.category as MobilePermit["kategori_izin"],
    deskripsi: permit.description,
    approval_status: permit.approval_status,
    tanggal: permit.date,
    created_at: permit.created_at ?? permit.date,
    rejection_reason: permit.rejection_reason,
    rejected_at: null,
  }));
}

export async function createPermit(params: {
  category: "sakit" | "pergi";
  description: string;
  attachment?: FilePart | null;
}) {
  const form = new FormData();
  form.append("category", params.category);
  form.append("description", params.description);
  form.append("date", formatDateWIB(new Date()));
  if (params.attachment) {
    form.append("attachment", params.attachment as unknown as Blob);
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

  const form = new FormData();
  form.append("file", file as unknown as Blob);
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
