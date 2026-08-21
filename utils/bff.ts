import { getLogtoAccessToken } from "~/utils/logto";

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

export type BffErrorDetails =
  | Record<string, string | number | boolean | null | undefined>
  | string
  | null
  | undefined;

type BffErrorEnvelope = {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: BffErrorDetails;
  };
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
};

type BffEnvelope<T> = BffSuccessEnvelope<T> | BffErrorEnvelope;

type BffHeaderMap = Record<string, string>;

type BffRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: JsonValue | FormData;
  headers?: BffHeaderMap;
  timeoutMs?: number;
  requireAuth?: boolean;
};

export class BffRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly details?: BffErrorDetails,
  ) {
    super(message);
    this.name = "BffRequestError";
  }
}

const getBffBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_BFF_API_URL;
  if (!url) {
    throw new Error(
      "Server aplikasi belum dikonfigurasi. Hubungi administrator.",
    );
  }
  return url.replace(/\/+$/, "");
};

const createRequestId = () =>
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const parseJson = (text: string): JsonValue => {
  if (!text) return null;
  try {
    // SAFETY: JSON.parse result conforms to JsonValue shape.
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
};

const isFormData = (
  candidate: BffRequestOptions["body"],
): candidate is FormData => candidate instanceof FormData;

const getErrorMessage = (cause: unknown, status: number) => {
  if (
    cause !== null &&
    cause !== undefined &&
    Object.prototype.hasOwnProperty.call(cause, "success")
  ) {
    // SAFETY: Verified property existence before reading error envelope.
    const envelope = cause as BffErrorEnvelope;
    if (envelope.success === false) {
      const message = envelope.error?.message;
      if (message) return message;
    }
  }

  if (
    cause !== null &&
    cause !== undefined &&
    Object.prototype.hasOwnProperty.call(cause, "message")
  ) {
    // SAFETY: Verified property existence before reading message property.
    const message = (cause as { message?: unknown }).message;
    if (Object.prototype.toString.call(message) === "[object String]") {
      return String(message);
    }
  }

  return `Permintaan server gagal (${status}).`;
};

export async function bffRequest<T>(
  path: string,
  options: BffRequestOptions = {},
): Promise<T> {
  const accessToken =
    options.requireAuth === false ? null : await getLogtoAccessToken();
  if (options.requireAuth !== false && !accessToken) {
    throw new BffRequestError("Sesi tidak valid. Silakan login ulang.", 401);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const body = options.body;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-Request-Id", createRequestId());
  headers.set("X-Astra-Contract-Version", "v1");
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }

  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: controller.signal,
  };

  if (body !== undefined) {
    if (isFormData(body)) {
      requestInit.body = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestInit.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${getBffBaseUrl()}${path}`, requestInit);
    const contractVersion = response.headers.get("X-Astra-Contract-Version");
    if (contractVersion !== "v1") {
      throw new BffRequestError(
        "Versi kontrak server tidak kompatibel. Silakan perbarui aplikasi.",
        502,
        "CONTRACT_VERSION_UNSUPPORTED",
      );
    }
    const parsedText = parseJson(await response.text());
    // SAFETY: Network response parsed from JSON into expected envelope contract.
    const parsed = parsedText as BffEnvelope<T> | null;

    if (!response.ok) {
      let envelope: BffErrorEnvelope | null = null;
      if (
        parsed !== null &&
        parsed !== undefined &&
        Object.prototype.hasOwnProperty.call(parsed, "success")
      ) {
        // SAFETY: Envelope verified before narrowing to BffErrorEnvelope.
        const candidate = parsed as BffErrorEnvelope;
        if (candidate.success === false) {
          envelope = candidate;
        }
      }
      throw new BffRequestError(
        getErrorMessage(parsed, response.status),
        response.status,
        envelope?.error?.code,
        envelope?.error?.details,
      );
    }

    if (
      parsed !== null &&
      parsed !== undefined &&
      Object.prototype.hasOwnProperty.call(parsed, "success")
    ) {
      // SAFETY: Verified envelope shape before checking success flag.
      const candidate = parsed as BffSuccessEnvelope<T>;
      if (candidate.success === true) {
        return candidate.data;
      }
    }

    throw new BffRequestError("Respons server tidak valid.", response.status);
  } catch (cause: unknown) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new BffRequestError(
        "Permintaan server melebihi batas waktu. Silakan coba lagi.",
        408,
      );
    }
    throw cause;
  } finally {
    clearTimeout(timeoutId);
  }
}
