import { describe, expect, test } from "bun:test";

import {
  canManageConstellation,
  hasRole,
  resolveClusterAccess,
} from "../src/permissions";

describe("hasRole", () => {
  test("ranks correctly", () => {
    expect(hasRole("owner", "navigator")).toBe(true);
    expect(hasRole("navigator", "owner")).toBe(false);
    expect(hasRole("member", "member")).toBe(true);
    expect(hasRole("moderator", "navigator")).toBe(false);
  });
});

describe("canManageConstellation", () => {
  test("navigator and above manage", () => {
    expect(canManageConstellation("owner")).toBe(true);
    expect(canManageConstellation("navigator")).toBe(true);
    expect(canManageConstellation("moderator")).toBe(false);
    expect(canManageConstellation("member")).toBe(false);
  });
});

describe("resolveClusterAccess", () => {
  const base = { isClusterMember: false };

  test("non-members are always locked", () => {
    expect(resolveClusterAccess({ ...base, role: null, visibility: "public" })).toBe(
      "locked",
    );
    expect(
      resolveClusterAccess({ role: null, visibility: "invite", isClusterMember: true }),
    ).toBe("locked");
  });

  test("moderators and above see everything", () => {
    expect(resolveClusterAccess({ ...base, role: "moderator", visibility: "invite" })).toBe(
      "granted",
    );
    expect(resolveClusterAccess({ ...base, role: "navigator", visibility: "members" })).toBe(
      "granted",
    );
  });

  test("public clusters granted to any constellation member", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "public" })).toBe(
      "granted",
    );
  });

  test("members-only is joinable, not granted", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "members" })).toBe(
      "joinable",
    );
    expect(
      resolveClusterAccess({
        role: "member",
        visibility: "members",
        isClusterMember: true,
      }),
    ).toBe("granted");
  });

  test("invite-only stays locked without explicit grant", () => {
    expect(resolveClusterAccess({ ...base, role: "member", visibility: "invite" })).toBe(
      "locked",
    );
    expect(
      resolveClusterAccess({
        role: "member",
        visibility: "invite",
        isClusterMember: true,
      }),
    ).toBe("granted");
  });
});
