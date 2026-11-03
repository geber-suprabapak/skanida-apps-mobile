import { BffRequestError, bffRequest } from "../utils/bff";
import { waitFor } from "@testing-library/react-native";

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/logto", () => ({
  getLogtoAccessToken: jest.fn(async () => "synthetic-access-token"),
}));

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  responseText = "";
  status = 0;
  timeout = 0;
  abortCalls = 0;
  open = jest.fn();
  send = jest.fn();
  setRequestHeader = jest.fn();
  getResponseHeader = jest.fn(() => "v1");

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  abort() {
    this.abortCalls += 1;
    this.onabort?.();
  }
}

const getLatestXhr = () => MockXMLHttpRequest.instances.at(-1) ?? null;

describe("BFF multipart cancellation", () => {
  const originalXmlHttpRequest = Object.getOwnPropertyDescriptor(
    globalThis,
    "XMLHttpRequest",
  );

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BFF_API_URL = "http://127.0.0.1:3000";
    MockXMLHttpRequest.instances = [];
    Object.defineProperty(globalThis, "XMLHttpRequest", {
      configurable: true,
      writable: true,
      value: MockXMLHttpRequest,
    });
  });

  afterEach(() => {
    if (originalXmlHttpRequest) {
      Object.defineProperty(
        globalThis,
        "XMLHttpRequest",
        originalXmlHttpRequest,
      );
    } else {
      Reflect.deleteProperty(globalThis, "XMLHttpRequest");
    }
    delete process.env.EXPO_PUBLIC_BFF_API_URL;
  });

  it("aborts the active XHR and rejects once with a cancellation code", async () => {
    const controller = new AbortController();
    const request = bffRequest("/v1/mobile/face/enrollment", {
      method: "POST",
      body: new FormData(),
      signal: controller.signal,
    });
    const rejection = expect(request).rejects.toMatchObject({
      name: "BffRequestError",
      code: "REQUEST_ABORTED",
      status: 0,
    } satisfies Partial<BffRequestError>);
    await waitFor(() => expect(getLatestXhr()).not.toBeNull());
    const xhr = getLatestXhr();
    if (!xhr)
      throw new Error("Expected the multipart request to create an XHR.");

    controller.abort();

    await rejection;
    expect(xhr.abortCalls).toBe(1);
    expect(xhr.send).toHaveBeenCalledTimes(1);
  });

  it("does not send a request when its signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    MockXMLHttpRequest.instances = [];
    const request = bffRequest("/v1/mobile/face/enrollment", {
      method: "POST",
      body: new FormData(),
      signal: controller.signal,
    });
    const rejection = expect(request).rejects.toMatchObject({
      name: "BffRequestError",
      code: "REQUEST_ABORTED",
    } satisfies Partial<BffRequestError>);
    await waitFor(() => expect(getLatestXhr()).not.toBeNull());
    const xhr = getLatestXhr();
    if (!xhr)
      throw new Error("Expected the multipart request to create an XHR.");

    await rejection;
    expect(xhr.send).not.toHaveBeenCalled();
  });
});
