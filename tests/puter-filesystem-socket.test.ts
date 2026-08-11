import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Puter does not publish declarations for its internal module classes.
// @ts-expect-error Testing the pinned dependency implementation is intentional.
import { PuterJSFileSystemModule } from "@heyputer/puter.js/src/modules/FileSystem/index.js";

type PuterSocketGlobal = typeof globalThis & {
  __IKM_DISABLE_PUTER_FS_SOCKET__?: boolean;
};

beforeEach(() => {
  delete (globalThis as PuterSocketGlobal).__IKM_DISABLE_PUTER_FS_SOCKET__;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Puter AI-only filesystem socket opt-out", () => {
  it("does not construct a socket or register an auth reconnect listener", () => {
    (globalThis as PuterSocketGlobal).__IKM_DISABLE_PUTER_FS_SOCKET__ = true;
    const onAuthStateChanged = vi.fn();
    const initializeSocket = vi
      .spyOn(PuterJSFileSystemModule.prototype, "initializeSocket")
      .mockImplementation(() => undefined);

    const filesystem = new PuterJSFileSystemModule({
      APIOrigin: "https://api.puter.com",
      authToken: null,
      env: "web",
      onAuthStateChanged,
    });

    expect(initializeSocket).not.toHaveBeenCalled();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
    expect(filesystem.read).toBeTypeOf("function");
  });

  it("leaves the upstream socket behavior intact without the opt-out", () => {
    const onAuthStateChanged = vi.fn();
    const initializeSocket = vi
      .spyOn(PuterJSFileSystemModule.prototype, "initializeSocket")
      .mockImplementation(() => undefined);

    new PuterJSFileSystemModule({
      APIOrigin: "https://api.puter.com",
      authToken: null,
      env: "web",
      onAuthStateChanged,
    });

    expect(initializeSocket).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  });
});
