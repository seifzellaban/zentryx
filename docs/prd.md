# Zentryx — Product Requirements Document

**Version:** 2.0-draft (revises v1.0 internal draft)
**Date:** 2026-08-25
**Owner:** Mason (Seif Zakaria), Masons Studio
**Formerly:** BLVCKPRINT platform
**Status:** Active — all decisions ratified 2026-08-25 (see Decision Log)

---

## Document Control

| Version | Date       | Author       | Changes                                                                                                                                                                                                            |
| ------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0     | —          | Seif Zakaria | Initial draft (Go/chi stack, Paymob-only)                                                                                                                                                                          |
| 2.0     | 2026-08-25 | Seif Zakaria | Aligned stack to scaffolded TS monorepo; dual-rail payments; resolved open questions into Decision Log; added Epics 0/6/7/8; added NFR-007–010; measurable success-metric targets; release gates and risk register |
| 2.1     | 2026-08-25 | Seif Zakaria | Added Platform Expansion section (Atlas WhatsApp-agent wedge, D-08); FR-021 amended to pluggable transports; added FR-032 internal API surface; added risk R-09 (WhatsApp economics/policy)                        |
| 2.2     | 2026-08-25 | Seif Zakaria | Owner ratified D-04 (zero take-rate), D-05 (TS monorepo), D-06 (self-hosted LiveKit w/ cloud triggers), D-07 (dual-rail payments), D-08 (Atlas v2 wedge commitment); document status → Active                      |

---

## Executive Summary

Zentryx is a live learning and mentorship community platform built around **constellations** (skill-based groups), **navigators** (admins/mentors), **clusters** (sub-groups within a constellation), and **magnitude** (a reputation score tracking contribution and standing). It combines real-time video (1:1, group, workshop) with async content and a monetization layer for mentors.

**Product shape (decided):** Ship the current architecture as the v1 community core, with v1.1 scoped now for the minimum structure (session **series** + **checkpoints**) that makes "structured mentorship platform" true. Learning-OS features (assessment, certification) remain a v2+ bet gated on traction.

**v1 positioning one-liner:** _A branded home for skill-based mentors to run a live community and get paid for it — not a nicer Discord, not a course warehouse._

---

## Problem Statement

Skill-based mentorship today is fragmented across Discord servers (rich community, no structure or monetization), Discord/Telegram + Calendly + Stripe stitched together (structure but no cohesion), or course platforms like Kajabi/Skool (structure and monetization, but weak live/community feel and generic branding). No single home gives a mentor a branded live community _and_ a way to actually teach and get paid for it without duct tape.

**Market note:** Launch market is MENA-first (Paymob rail), with an international rail planned. Arabic-language member content must render correctly even though the UI shell is not localized at v1 (see FR-031).

---

## Decision Log

The v1.0 draft carried four open questions plus three raised during revision. All decisions below were **ratified by the owner on 2026-08-25**; re-open any of them only with new evidence (e.g., the predefined D-04/D-06 triggers).

| ID   | Question                                          | Decision                                                                                                                                                                                                                                                                                                                                                                                                                   | Rationale / Consequence                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Positioning: mentorship community vs learning OS? | **Option B path.** v1 = Option A core; v1.1 adds series + checkpoints (FR-007, FR-010); Option C deferred until retention data supports it.                                                                                                                                                                                                                                                                                | Avoids "nicer Discord" trap without betting against funded EdTech incumbents.                                                                                                                                                                      |
| D-02 | Magnitude formula ownership                       | **Platform-standard base formula** with navigator-configurable weights per action category, bounded to 0.5×–2× of default. Formula and current weights are documented in-product.                                                                                                                                                                                                                                          | Keeps scores comparable across constellations (discovery value) while letting navigators reward what their community values. Bounded weights prevent reputation inflation races.                                                                   |
| D-03 | Series vs cohort semantics                        | **Series = ordered list of sessions inside any cluster. Cohort = a cluster of type `cohort` with optional start/end dates.** Rolling mid-series join is allowed by default; navigator can lock a series to its cohort's date range.                                                                                                                                                                                        | Decouples the two concepts; scheduling logic only needs date bounds when the navigator opts in.                                                                                                                                                    |
| D-04 | Pricing model for Zentryx itself                  | **Zero platform take-rate at v1.** Navigators pay processing fees only. Revisit take-rate or SaaS tier after first 10 paying constellations. Dashboard shows gross and net-from-day-one so the switch is data-driven. _Ratified 2026-08-25._                                                                                                                                                                               | Seeds supply side, which is the cold-start bottleneck. Changing later is easy; charging before value-proven is not.                                                                                                                                |
| D-05 | Backend stack                                     | **TypeScript monorepo as scaffolded**: Next.js web (`apps/web`), Elysia + tRPC API (`apps/server`), Better Auth, Drizzle ORM on managed Neon Postgres, Bun workspaces, Docker Compose deploy. Supersedes v1.0's Go/chi + self-hosted Postgres.                                                                                                                                                                             | Matches the existing repo; one language across web/API; Neon removes Postgres ops burden from a single-developer studio.                                                                                                                           |
| D-06 | Live video infra                                  | **Self-hosted LiveKit + coturn on Hetzner at v1** (cost control, data residency). Predefined switch triggers to LiveKit Cloud: >200 concurrent participants platform-wide, or >8 engineer-hours/month of media-ops toil. _Ratified 2026-08-25._                                                                                                                                                                            | Cheapest correct option at expected scale; triggers prevent death-by-ops.                                                                                                                                                                          |
| D-07 | Payment rails                                     | **Dual rail behind a `PaymentProvider` interface. Paymob ships first** (EGP, cards + wallets), Stripe second (international, USD/EUR). See FR-024. _Ratified 2026-08-25._                                                                                                                                                                                                                                                  | MENA-first launch without painting into a regional corner; abstraction cost is modest if built before payments logic spreads.                                                                                                                      |
| D-08 | Platform expansion beyond the core platform?      | **Atlas = WhatsApp agent wedge for teachers and educational institutes, planned as a v2 sub-product**, phased: notifications bridge → two-way agent → AI tutor over library content. Tenancy: an institute is an **org tier on a constellation**, not a new tenant type. Gated on entry criteria (see Platform Expansion). _Ratified 2026-08-25 — commit to v2 wedge; FR-021/FR-032 enablers build during normal v1 work._ | WhatsApp is the incumbent channel for education in MENA — meeting teachers where they already are makes Atlas the top-of-funnel wedge into constellations. Org-on-constellation keeps one tenancy model; phasing contains COGS/policy risk (R-09). |

---

## Target Users

- **Navigators (mentors/admins):** Independent experts or small teams monetizing skill-based mentorship (coding, design, trading, languages, fitness) who want a branded space instead of a generic Discord/Skool.
- **Members:** People paying for structured access to a mentor's community — live sessions, direct feedback, peer accountability.
- **Discovery participants:** Prospective members sampling public clusters free before paying.
- **Platform operators (internal):** Masons Studio staff administering the platform itself (suspend constellation, resolve escalated reports, view revenue).

---

## Core Terminology

| Term           | Definition                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constellation  | Top-level community, owned by one or more navigators, organized around a skill or niche.                                                             |
| Navigator      | Admin/mentor role with moderation and monetization control within a constellation. Also: moderator (delegate) and owner roles below it — see FR-018. |
| Cluster        | Sub-group within a constellation: discussion, cohort, or resource-library type.                                                                      |
| Magnitude      | Reputation score reflecting contribution and standing across a constellation.                                                                        |
| Series         | Ordered set of related sessions within a cluster (D-03).                                                                                             |
| Checkpoint     | Navigator-defined progress marker within a cluster/series (FR-010).                                                                                  |
| Discovery tier | Free access level limited to public clusters; upgrade prompts at defined trigger points.                                                             |

---

## Functional Requirements

> Numbering is stable from v1.0: existing IDs keep their meaning; new requirements are appended (FR-016+). Amendments to existing requirements are marked.

### Epic 0 — Accounts, Auth & Onboarding _(new)_

**Business value:** Nothing else works without trustworthy identity; onboarding determines activation.

- **FR-016: MUST — Sign-up/sign-in via email+password and Google OAuth, using Better Auth.**
  - AC: Email verification required before constellation creation; password reset flow completes end-to-end; sessions survive page reloads and are revocable by the user ("log out everywhere").
- **FR-017: MUST — User profile with display name, avatar, bio, skills.**
  - AC: Profile shows memberships and magnitude within each joined constellation; profiles are visible to co-members only, not the open web, unless the user opts in.
- **FR-018: MUST — Role model enforced server-side: constellation owner > navigator > moderator > member > discovery participant.**
  - AC: Every permission-gated tRPC procedure rejects unauthorized callers server-side (not just hidden UI); role changes take effect on the affected user's next request without re-login.
- **FR-019: SHOULD — Guided onboarding: first-run flow offers "create a constellation" (navigators) or "find constellations to join" (members).**
  - AC: A new navigator reaches a created constellation with one default public cluster in ≤ 3 steps after signup.

### Epic 1 — Constellation & Cluster Management

**Business value:** Lets navigators structure their community instead of running one flat chat.

- **FR-001: MUST — Navigator creates a constellation with name, description, cover image, skill category.**
  - AC: Discoverable via search once published; draft state is navigator-only; slug is unique and editable pre-publication.
- **FR-002: MUST — Navigator creates clusters with visibility level (public / members-only / invite-only).**
  - AC: Members see only clusters they can access; a permission change propagates to affected clients within 5 seconds (revalidation on next request or push).
- **FR-003: SHOULD — Cluster type (discussion / cohort / resource-library) changes default layout.**
  - AC: Cohort clusters show a session schedule tab; resource-library clusters show organized content instead of chat-first.
- **FR-004: MUST — Members join public constellations and request access to gated clusters.**
  - AC: Requests visible to navigators with approve/deny; requester notified of outcome in-app and by email.

### Epic 2 — Live & Async Sessions

**Business value:** The core value prop — live mentorship, not just chat.

- **FR-005: MUST — Navigator schedules 1:1, group, or workshop sessions tied to a cluster, hosted on LiveKit.** _(amended: timezone clause)_
  - AC: Session appears on cluster calendar; eligible members RSVP; capacity enforced for group/workshop; scheduling handles IANA time zones correctly including DST transitions — a session created for 19:00 Africa/Cairo displays as 19:00 local for every participant.
- **FR-006: MUST — Sessions support screen share, recording, automatic post-session upload to the cluster library.**
  - AC: Recording available in-cluster ≤ 10 min after session end (egress → object storage → library entry); failed uploads surface to navigator with retry, never silently vanish.
- **FR-007: SHOULD — Navigator groups related sessions into a series with ordered agenda.** _(semantics per D-03)_
  - AC: Series progress (attended / total) visible to member and navigator; mid-series joins see past-session recordings automatically.
- **FR-008: COULD — Async posts within a cluster (text/image/video), threaded, pinnable by navigators.**
  - AC: Posts render member content in any language including RTL text correctly.
- **FR-020: MUST — Session lifecycle notifications: reminder 24h and 15min before start; cancellation/reschedule notifies all RSVP'd members immediately.**
  - AC: Members with calendar access get .ics download per session and per series.

### Epic 3 — Reputation (Magnitude) & Progress

**Business value:** Gives members a reason to stay engaged beyond the next session; gives navigators a lightweight seriousness signal.

- **FR-009: MUST — Magnitude updates on defined actions (attendance, posts, peer endorsements) using a visible formula.** _(amended per D-02)_
  - AC: Members see score breakdown by category; weight changes apply prospectively (historical breakdowns stay auditable); score cannot go negative.
- **FR-010: SHOULD — Navigator defines checkpoints within a cluster/series that members mark or navigators verify.**
  - AC: Completion visible on member profile within that constellation; no assessment engine required.
- **FR-011: WON'T (v1) — Automated skill assessment, scored quizzes, certification. Deferred until Option C is greenlit.**

### Epic 4 — Monetization

**Business value:** How navigators get paid; without it Zentryx is a feature, not a business.

- **FR-012: MUST — Constellation- or cluster-level pricing (one-time, subscription).** _(amended: dual rail)_
  - AC: Payment failure blocks renewed access without deleting history; retry flow available; subscription renewals execute automatically via stored payment tokens where the provider supports recurring billing — see Risk R-01 for the Paymob caveat and fallback.
- **FR-013: MUST — Navigator revenue dashboard: revenue, active subscribers, churn over time.**
  - AC: Data refreshes ≤ 24h; CSV export; shows gross collected and net after processing fees (prerequisite for D-04's future take-rate decision).
- **FR-014: SHOULD — Free discovery tier on public clusters drives top-of-funnel.**
  - AC: Upgrade prompt fires at defined triggers (gated-cluster join attempt, session RSVP beyond free allowance); prompt frequency capped to avoid nag-fatigue (max once per trigger per 7 days).
- **FR-024: MUST — `PaymentProvider` interface abstracting provider specifics; Paymob implementation ships v1, Stripe second.** _(new, implements D-07)_
  - AC: Switching or adding a provider requires no changes outside the payments module; all provider callbacks (webhooks) are idempotent and verified (signature validation); no primary account number (PAN) ever persists on Zentryx infrastructure.
- **FR-025: MUST — Refunds and cancellations.**
  - AC: Navigator can issue full/partial refund via provider API within a configurable window; refund revokes paid access but preserves member content history; member is notified with reason and amount.
- **FR-026: MUST — Dunning: failed renewal retries on a schedule (default: 3 attempts over 10 days), then downgrade to discovery tier preserving all history.**
  - AC: Member receives email before first retry and before final downgrade; grace period configurable per constellation (default: 3 days access retained during retries).
- **FR-027: SHOULD — Multi-currency handling: EGP native on Paymob rail; USD/EUR on Stripe rail; prices display in the constellation's declared currency.**
  - AC: Currency mismatch between buyer's card and price currency is handled by the provider, never silently converted by Zentryx math.

### Epic 5 — Search & Discovery

- **FR-015: SHOULD — Full-text search across constellations, clusters, and library content (Postgres tsvector/tsquery).**
  - AC: Results ranked by relevance, returned < 500ms p95 for typical query volume; results respect permissions (members never see gated content they lack access to).

### Epic 6 — Notifications _(new)_

**Business value:** Retention mechanics — sessions attended, approvals unblocked, communities felt alive.

- **FR-021: MUST — In-app notification center + transactional email (join decisions, mentions, session reminders, payment receipts/failures).** _(amended: pluggable transports)_
  - AC: Every notification type has per-user opt-out except payment-critical emails; emails deliver ≤ 60s of triggering event.
  - AC: All notifications flow through an internal, transport-agnostic channel interface; adding a new channel (e.g., WhatsApp in Atlas Phase A) requires zero changes to notification-producing features.
- **FR-022: SHOULD — Weekly digest email per membership: upcoming sessions, new library content, magnitude movement.**
  - AC: Digest suppresses automatically when there is nothing new; one-click unsubscribe compliant with anti-spam norms.

### Epic 7 — Trust & Safety _(new)_

**Business value:** One harassment incident or scam constellation can kill an early platform; moderation is table stakes for paying members.

- **FR-023: MUST — Reporting and moderation: report post/user/session; navigator-level actions (delete content, remove member, mute); platform-admin escalation (suspend constellation, ban account).**
  - AC: Reports triaged within defined SLA once platform staff exists (placeholder: 48h at beta); reporter sees status of their report.
- **FR-028: MUST — Audit log for security-relevant events: role changes, moderation actions, payment events, permission changes.**
  - AC: Entries immutable, timestamped, actor-attributed; exportable by platform admins.
- **FR-029: SHOULD — Upload safety: file-type allowlist, size limits, media processed/transcoded rather than served raw from user input paths.**

### Epic 8 — Platform Operations & Instrumentation _(new)_

**Business value:** You cannot manage what you don't measure; Success Metrics depend on this epic.

- **FR-030: MUST — Analytics event instrumentation for the Success Metrics taxonomy (signup, constellation_created, cluster_paid_offer_created, rsvp_created, session_attended, payment_succeeded, payment_failed, member_retained_60d, etc.).**
  - AC: Every success metric computable from emitted events alone, verified before launch; events include constellation and cluster identifiers for per-navigator analysis.
- **FR-031: COULD — RTL-safe rendering of member-generated Arabic content (UI shell remains LTR English at v1).**
  - AC: Mixed Arabic/English posts, names, and titles render readably; no mirrored punctuation artifacts.
- **FR-032: SHOULD — Internal API + webhook surface (enabler for Platform Expansion).**
  - AC: Authorized internal clients (Atlas agents, future integrations) can read schedule/membership/content data and receive webhooks for key events (`session.scheduled`, `payment.succeeded`, `cluster.posted`) using the same server-side permission model as tRPC procedures; no client bypasses permissions via direct DB access.
  - AC: Atlas Phase B consumes this surface — it is the API's first consumer, so its needs define the v1.x endpoint set.

---

## Non-Functional Requirements

- **NFR-001: MUST — Live session join latency < 3s** on standard broadband (self-hosted LiveKit + coturn). _Measurement: automated Playwright join test from a consumer connection, run weekly._
- **NFR-002: MUST — ≥ 50 concurrent participants per workshop session at v1**, with hard capacity enforcement and clear messaging past the ceiling rather than silent degradation. _Measurement: load test with recorded participant traces before GA._
- **NFR-003: MUST — PCI-DSS SAQ-A posture:** card data handled exclusively inside provider-hosted fields (Paymob hosted checkout / Stripe Elements); no PAN touches Zentryx servers, logs, or databases — verified by code search in CI.
- **NFR-004: SHOULD — 99.5% uptime for core chat/scheduling** (excludes live media, which inherits LiveKit's reliability profile). Error-budget approach: budget exhaustion freezes feature deploys for stability work.
- **NFR-005: SHOULD — Mobile-responsive web at v1; WCAG 2.1 AA as design target for primary flows (auth, purchase, join session).** Native apps out of scope until post-launch traction data exists.
- **NFR-006: MUST — Deployment topology (supersedes v1.0 "all self-hosted"):** managed Neon Postgres (pooled connections via Neon pooler; branches for dev/CI preview environments); app containers deployable to Hetzner/Coolify via the repo's docker-compose; self-hosted LiveKit + coturn per D-06. No new infrastructure dependencies beyond these.
- **NFR-007: MUST — Data durability & recovery:** Neon point-in-time recovery enabled; recording/object storage versioned; RPO ≤ 15 min, RTO ≤ 4h; restore drill executed once before GA.
- **NFR-008: SHOULD — API performance:** p95 < 300ms for tRPC reads under normal load; p95 < 500ms search (aligns with FR-015).
- **NFR-009: MUST — Abuse controls:** rate limiting on auth, payment, upload, and messaging endpoints; upload size/type limits; webhook signature verification (see FR-024).
- **NFR-010: SHOULD — Observability:** structured logs, error tracking, uptime checks on API/web/media endpoints; alerts route to the operator within 5 minutes of core-service failure.
- **NFR-011: MUST — Data protection compliance baseline:** personal data encrypted in transit and at rest; account deletion request purges or anonymizes personal data within 30 days (aligned with Egypt PDPL 151/2020 expectations and GDPR-style norms for international users).

---

## Out of Scope (v1)

1. Automated assessment, quizzes, certification (Option C territory — FR-011).
2. Curriculum authoring tools / structured course builder (Option C).
3. Native mobile apps (responsive web only).
4. Localized platform UI shell (Arabic member _content_ renders correctly per FR-031, but menus/navigation remain English).
5. Algorithmic recommendations across constellations (basic search only).
6. Direct payouts reconciliation/accounting exports beyond the FR-013 CSV (no QuickBooks-class integrations).
7. Private messaging between arbitrary members (intra-cluster posting covers v1 needs; DMs invite harassment surface area).

**Future considerations (post-v1):** Stripe rail GA (FR-027 completion), take-rate introduction per D-04, LiveKit Cloud migration per D-06 triggers, localized Arabic UI, mobile apps, Atlas Phase A per entry gate (Platform Expansion).

---

## Success Metrics (v1)

Targets are provisional pending beta baselines; the instrumentation requirement is FR-030 — a metric without an emitting event is a launch blocker.

| Metric               | Definition                                                                              | Provisional target              | Source event                          |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------- |
| Navigator activation | % of new navigators creating ≥ 1 paid offering within 14 days of constellation creation | ≥ 40%                           | `cluster_pricing_enabled`             |
| Session health       | Attendance ÷ RSVP per session                                                           | ≥ 60%                           | `rsvp_created`, `attendance_recorded` |
| Paid retention       | 60-day retention of members inside paid clusters                                        | ≥ 50%                           | `member_active_in_paid_cluster`       |
| Revenue              | GMV processed per active constellation, month-over-month growth                         | Positive MoM trend from month 2 | `payment_succeeded`                   |
| Discovery conversion | % of discovery-tier participants converting to paid within 30 days                      | ≥ 8%                            | `upgrade_completed`                   |
| Reliability          | Uptime of core services vs NFR-004 target                                               | ≥ 99.5%                         | uptime checks                         |

---

## Release Plan

### M1 — Foundation (gate: usable skeleton)

Auth/profiles (Epic 0), constellations/clusters CRUD + permissions (FR-001–004, 016–018), deployment pipeline live on Hetzner with Neon branching.
**Exit criteria:** a real user signs up, creates a constellation, invites a second user who sees only permitted clusters.

### M2 — Community & Live (gate: the product's reason to exist)

Chat/posts, session scheduling + LiveKit integration + recordings (FR-005, 006, 008, 020), magnitude v1 (FR-009), notifications in-app (FR-021).
**Exit criteria:** one pilot constellation runs a real recorded session with ≥ 10 participants; recordings appear in-library ≤ 10 min.

### M3 — Monetization & Polish (gate: revenue possible)

Payments via Paymob through the provider interface (FR-012, 013, 024–027), dunning/refunds, discovery tier + upgrade prompts (FR-014), search (FR-015), email notifications/digests, moderation + audit log (FR-023, 028), analytics events verified (FR-030).
**Exit criteria:** first real payment succeeds end-to-end including webhook reconciliation; refund and dunning paths tested; success-metrics dashboard renders from live events.

### v1.1 — Structure bridge (Option B becomes true)

Series (FR-007), checkpoints (FR-010), series progress surfaces, calendar subscriptions.
Sequenced immediately after v1 based on pilot feedback — do not let v1 linger as "nicer Discord."

---

## Platform Expansion — Atlas (v2 Wedge)

**What:** Zentryx Atlas, a WhatsApp agent for teachers and educational institutes — the first sub-product on top of the core platform. Decision recorded as D-08; **not in v1 scope.**

**Why this wedge:** In MENA, WhatsApp is the incumbent — teachers already run classes out of WA groups today; Discord/Skool never won that ground. Atlas meets teachers where they are and funnels them into full constellations ("land with a utility, expand to a platform"). Brand architecture stays coherent: Constellation → Cluster → Navigator → Magnitude → **Atlas**.

**Entry gate (all required before Phase A starts):**

1. M3 exit criteria met (payments live end-to-end).
2. ≥ 10 paying constellations **or** documented pull from a pilot teacher cohort (supply signal, not founder conviction).

**Phases:**

| Phase                                   | Scope                                                                                                          | Exit criteria                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A — Notifications bridge                | Session reminders, RSVP links, payment receipts via WhatsApp utility templates over FR-021's channel interface | Reminder delivery ≥ 95%; measurable attendance lift vs email-only cohort in pilot           |
| B — Two-way agent                       | Booking, schedule lookup, FAQ via FR-032 API surface; rules/templates first, LLM later                         | WA-initiated bookings convert at parity with web; support-question deflection measured      |
| C — AI tutor (RAG over cluster library) | Answers grounded in the constellation's own content, with citations to library entries                         | Navigator-sampled answer accuracy ≥ agreed threshold; hallucination/escalation path defined |

**Standing constraints:**

- **Unit economics:** Atlas pricing must cover pass-through WhatsApp messaging costs plus margin floor; Meta rate card reviewed quarterly (per-message billing since Jul 2025; AI-reply per-token charges from Aug 2026; service-window messages billable from Oct 2026 — see R-09).
- **Tenancy:** Institute = org tier on a constellation (org-admin > instructors > members). No second tenant type is introduced.
- **Compliance:** WhatsApp template approval, per-user opt-in management, and Meta commerce/messaging policies are product requirements for Atlas, not afterthoughts.
- **Attribution:** `atlas_onboarded`, `atlas_reminder_delivered`, `atlas_booking_created` events added to FR-030 taxonomy so funnel contribution is measurable from day one.

---

## Risks & Mitigations

| ID   | Risk                                                                                                                                                                                                                                              | Impact                         | Likelihood  | Mitigation                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Paymob recurring-billing support varies by merchant account/integration; subscriptions may need tokenized-card charges driven by Zentryx cron rather than native billing plans                                                                    | High — breaks FR-012 core loop | Medium      | Verify Paymob tokenization/recurring capability during M3 spike, before building subscription UI. Fallback: payment-link renewal reminders + manual re-entry; Stripe rail accelerates.                                                              |
| R-02 | Self-hosted LiveKit/coturn ops burden (TURN reachability, NAT traversal, upgrades) consumes disproportionate time for a solo developer                                                                                                            | Medium                         | Medium      | D-06 switch triggers predefined; coturn deployed and tested behind real corporate/school networks during M2, not assumed working.                                                                                                                   |
| R-03 | Cold-start marketplace problem: empty platform attracts neither mentors nor members                                                                                                                                                               | High                           | High        | Supply-first strategy: hand-recruit 3 pilot navigators before GA; zero take-rate (D-04) as recruiting lever.                                                                                                                                        |
| R-04 | Solo-developer bus factor and scope creep toward Option C                                                                                                                                                                                         | High                           | Medium      | This PRD's WON'T list is contractual; v1.1 scope frozen until M3 exit.                                                                                                                                                                              |
| R-05 | Recording storage costs grow unpredictably with successful sessions                                                                                                                                                                               | Low                            | Medium      | Storage quotas per constellation tier; egress-to-storage lifecycle policy (archive after N days); cost alerting.                                                                                                                                    |
| R-06 | Moderation incidents (harassment, scams) damage trust early                                                                                                                                                                                       | High                           | Medium      | Epic 7 ships in M3 not "later"; report SLA published; constellation suspension tool exists before scale.                                                                                                                                            |
| R-07 | Neon scale-to-zero cold starts add latency spikes to infrequently-used pilot constellations                                                                                                                                                       | Low                            | Medium      | Pooled connections; keep-alive pinger during pilot phase; measure p95 (NFR-008) before assuming problem.                                                                                                                                            |
| R-08 | Chargebacks/disputes on Paymob rail create liability ambiguity with navigators                                                                                                                                                                    | Medium                         | Low         | Terms of service define navigator-as-merchant-of-record; dispute data surfaced in FR-013 dashboard.                                                                                                                                                 |
| R-09 | WhatsApp platform economics/policy shifts break Atlas unit economics: per-message billing (Jul 2025), Meta Business Agent per-token AI-reply fee (Aug 2026), service-window messages billable (Oct 2026), template-approval and opt-in compliance | Medium (v2)                    | Medium-High | Price Atlas with pass-through messaging costs + margin floor; prefer utility-category templates and in-window replies; quarterly Meta rate-card review; email/in-app channels remain fully functional fallback so core product never depends on WA. |

---

## Assumptions & Dependencies

**Assumptions**

1. Pilot navigators will accept a zero-take-rate launch (D-04) in exchange for early-adopter influence.
2. Hetzner/Coolify hosting remains acceptable for app/media workloads; Neon remains acceptable for Postgres through v1.
3. Better Auth covers OAuth + session needs without custom auth engineering.
4. EGP pricing satisfies the MENA pilot segment; international demand waits for the Stripe rail.

**Dependencies**

| Dependency                                                  | Type              | Status               | Risk             | Mitigation                                              |
| ----------------------------------------------------------- | ----------------- | -------------------- | ---------------- | ------------------------------------------------------- |
| Neon Postgres (managed DB, branching)                       | External service  | In use via scaffold  | Low-Med (vendor) | Standard Postgres via Drizzle keeps migration path open |
| LiveKit OSS + coturn (self-hosted)                          | External software | To deploy (M2)       | Med              | D-06 cloud-switch triggers                              |
| Paymob merchant account w/ tokenization                     | External service  | To verify (M3 spike) | High (R-01)      | Stripe fallback rail                                    |
| Transactional email provider (e.g., Resend)                 | External service  | To select (M2)       | Low              | Swap-in behind mail interface                           |
| Object storage for recordings (Hetzner Object Storage / R2) | External service  | To select (M2)       | Low-Med          | S3-compatible API keeps options open                    |

---

## Traceability Matrix

| Requirement(s)           | Epic  | Business goal                          | Metric                               |
| ------------------------ | ----- | -------------------------------------- | ------------------------------------ |
| FR-016–019               | 0     | Usable foundation                      | Navigator activation                 |
| FR-001–004               | 1     | Structured community                   | Navigator activation, paid retention |
| FR-005, 006, 020         | 2     | Live mentorship core                   | Session health                       |
| FR-007, 010              | 1/2/3 | Differentiation (Option B)             | Paid retention                       |
| FR-008, 021, 022         | 2/6   | Engagement between sessions            | Paid retention                       |
| FR-009                   | 3     | Engagement/seriousness signal          | Paid retention                       |
| FR-012–014, 024–027      | 4     | Monetization                           | GMV, discovery conversion            |
| FR-015                   | 5     | Discovery                              | Discovery conversion                 |
| FR-023, 028, 029         | 7     | Trust                                  | Paid retention (proxy)               |
| FR-030, 031              | 8     | Measurability / MENA fit               | All (enabler)                        |
| FR-021 (amended), FR-032 | 6/8   | Platform expansion enabler (Atlas, v2) | Atlas Phase A/B exit criteria        |
| NFR-001–011              | —     | Quality attributes                     | Reliability                          |

---

## Appendix A — Revised Architecture Snapshot (per D-05)

```
apps/web        Next.js (React 19, Tailwind 4)          :3001 dev
apps/server     Elysia + tRPC, Better Auth              :3000 dev
packages/db     Drizzle ORM → Neon Postgres (pooled)
packages/auth   Better Auth config shared
packages/api    tRPC routers shared types
infra           docker-compose → Hetzner/Coolify
media           LiveKit SFU + coturn + egress → object storage
payments        PaymentProvider port → Paymob (v1) → Stripe (v1.x)
```

Realtime delivery for chat/notifications uses WebSockets terminated by the Elysia server; permission revalidation per FR-002/FR-018 rides the same connection.

---

_End of document._
