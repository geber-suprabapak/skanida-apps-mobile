import { ensureSupabaseInitialized, supabase } from "~/utils/supabase";

const DEFAULT_TIMEOUT_MS = 30_000;

type BffSuccessEnvelope<T> = {
  success: true;
  message: string;
  data: T;
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
};

type BffErrorEnvelope = {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
};

type BffEnvelope<T> = BffSuccessEnvelope<T> | BffErrorEnvelope;

type BffRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class BffRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BffRequestError";
  }
}

const getBffBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_BFF_API_URL as string | undefined;
  if (!url) {
    throw new Error(
      "Server aplikasi belum dikonfigurasi. Hubungi administrator.",
    );
  }
  return url.replace(/\/+$/, "");
};

const createRequestId = () =>
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const parseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isFormData = (value: unknown): value is FormData =>
  typeof FormData !== "undefined" && value instanceof FormData;

const getErrorMessage = (body: unknown, status: number) => {
  if (
    body &&
    typeof body === "object" &&
    "success" in body &&
    (body as BffErrorEnvelope).success === false
  ) {
    const message = (body as BffErrorEnvelope).error?.message;
    if (message) return message;
  }

  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return `Permintaan server gagal (${status}).`;
};

export async function bffRequest<T>(
  path: string,
  options: BffRequestOptions = {},
): Promise<T> {
  await ensureSupabaseInitialized();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new BffRequestError("Sesi tidak valid. Silakan login ulang.", 401);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const body = options.body;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${session.access_token}`,
    "X-Request-Id": createRequestId(),
    ...options.headers,
  };

  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: controller.signal,
  };

  if (body !== undefined) {
    if (isFormData(body)) {
      requestInit.body = body;
    } else {
      headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${getBffBaseUrl()}${path}`, requestInit);
    const parsed = parseJson(await response.text()) as BffEnvelope<T> | unknown;

    if (!response.ok) {
      const envelope =
        parsed &&
        typeof parsed === "object" &&
        "success" in parsed &&
        (parsed as BffErrorEnvelope).success === false
          ? (parsed as BffErrorEnvelope)
          : null;
      throw new BffRequestError(
        getErrorMessage(parsed, response.status),
        response.status,
        envelope?.error?.code,
        envelope?.error?.details,
      );
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "success" in parsed &&
      (parsed as BffSuccessEnvelope<T>).success === true
    ) {
      return (parsed as BffSuccessEnvelope<T>).data;
    }

    throw new BffRequestError("Respons server tidak valid.", response.status);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new BffRequestError(
        "Permintaan server melebihi batas waktu. Silakan coba lagi.",
        408,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
