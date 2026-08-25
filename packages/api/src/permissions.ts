import type { ClusterVisibility, MemberRole } from "@zentryx/db/schema";

export type { ClusterVisibility, MemberRole };
export type ClusterAccess = "granted" | "joinable" | "locked";

export const ROLE_RANK: Record<MemberRole, number> = {
  owner: 4,
  navigator: 3,
  moderator: 2,
  member: 1,
};

export function hasRole(role: MemberRole, min: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function canManageConstellation(role: MemberRole): boolean {
  return hasRole(role, "navigator");
}

export function resolveClusterAccess(params: {
  role: MemberRole | null;
  visibility: ClusterVisibility;
  isClusterMember: boolean;
}): ClusterAccess {
  if (params.role === null) return "locked";
  if (hasRole(params.role, "moderator")) return "granted";
  if (params.visibility === "public") return "granted";
  if (params.isClusterMember) return "granted";
  return params.visibility === "members" ? "joinable" : "locked";
}
