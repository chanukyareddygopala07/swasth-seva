import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  api,
  clearSession,
  getRefreshToken,
  getStoredUser,
  getToken,
  getWsUrl,
  storeSession,
} from "./api";

const TOKEN_KEY = "ss_access_token";
const REFRESH_KEY = "ss_refresh_token";
const USER_KEY = "ss_user";

const user = {
  id: "u1",
  email: "patient@demo.com",
  full_name: "Test Patient",
  role: "patient",
  is_verified: true,
  language: "en",
  theme: "light",
};

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

let storage: MemoryStorage;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("session helpers", () => {
  it("returns null before a session is stored", () => {
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("stores and retrieves a session", () => {
    storeSession({ access_token: "at", refresh_token: "rt" }, user);
    expect(getToken()).toBe("at");
    expect(getRefreshToken()).toBe("rt");
    expect(getStoredUser()).toEqual(user);
  });

  it("clears a session", () => {
    storeSession({ access_token: "at", refresh_token: "rt" }, user);
    clearSession();
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBeNull();
    expect(storage.getItem(USER_KEY)).toBeNull();
  });

  it("returns null for corrupted stored user JSON", () => {
    storage.setItem(USER_KEY, "{not json");
    expect(getStoredUser()).toBeNull();
  });
});

describe("api", () => {
  it("sends GET with Authorization header and returns JSON", async () => {
    storeSession({ access_token: "at", refresh_token: "rt" }, user);
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(jsonResponse({ ok: true }));

    const result = await api("/tokens/mine");

    expect(result).toEqual({ ok: true });
    const [url, init] = mock.mock.calls[0];
    expect(url).toContain("/api/v1/tokens/mine");
    expect(new Headers(init!.headers).get("Authorization")).toBe("Bearer at");
  });

  it("skips auth when skipAuth is set", async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(jsonResponse({ ok: true }));

    await api("/hospitals", { skipAuth: true });

    const [, init] = mock.mock.calls[0];
    expect(new Headers(init!.headers).has("Authorization")).toBe(false);
  });

  it("refreshes the token once on 401 and retries", async () => {
    storeSession({ access_token: "old", refresh_token: "rt" }, user);
    const mock = vi.mocked(fetch);
    mock
      .mockResolvedValueOnce(jsonResponse({ detail: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "new", refresh_token: "rt2" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await api("/tokens/mine");

    expect(result).toEqual({ ok: true });
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls[1][0]).toContain("/auth/refresh");
    expect(getToken()).toBe("new");
    expect(getRefreshToken()).toBe("rt2");
    const retryHeaders = new Headers(mock.mock.calls[2][1]!.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer new");
  });

  it("clears the session and throws ApiError when refresh fails", async () => {
    storeSession({ access_token: "old", refresh_token: "rt" }, user);
    const mock = vi.mocked(fetch);
    mock
      .mockResolvedValueOnce(jsonResponse({ detail: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid token" }, 401));

    await expect(api("/tokens/mine")).rejects.toMatchObject({
      status: 401,
      message: "Session expired. Please login again.",
    });
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("throws ApiError with backend detail message on error", async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(jsonResponse({ detail: "Hospital not found" }, 404));

    await expect(api("/hospitals/xyz")).rejects.toMatchObject({
      status: 404,
      message: "Hospital not found",
    });
  });

  it("throws ApiError with status text when body is not JSON", async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(new Response("boom", { status: 500, statusText: "Internal Server Error" }));

    await expect(api("/x")).rejects.toMatchObject({ status: 500, message: "Internal Server Error" });
  });

  it("sets Content-Type when a JSON body is provided", async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(jsonResponse({ ok: true }));

    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.c", password: "x" }),
      skipAuth: true,
    });

    const [, init] = mock.mock.calls[0];
    expect(new Headers(init!.headers).get("Content-Type")).toBe("application/json");
  });

  it("does not override an explicit Content-Type", async () => {
    const mock = vi.mocked(fetch);
    mock.mockResolvedValue(jsonResponse({ ok: true }));

    await api("/upload", {
      method: "POST",
      body: "raw",
      headers: { "Content-Type": "text/plain" },
      skipAuth: true,
    });

    const [, init] = mock.mock.calls[0];
    expect(new Headers(init!.headers).get("Content-Type")).toBe("text/plain");
  });
});

describe("getWsUrl", () => {
  it("builds websocket URLs per kind", () => {
    expect(getWsUrl("queue", "q1")).toBe("/ws/queue/q1");
    expect(getWsUrl("user", "u1")).toBe("/ws/user/u1");
    expect(getWsUrl("admin", "h1")).toBe("/ws/admin/h1");
  });
});

describe("ApiError", () => {
  it("is an Error with a status", () => {
    const err = new ApiError(503, "down");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.message).toBe("down");
  });
});