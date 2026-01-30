"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatPlayerName } from "@/lib/players";
import { getClubDisplayName } from "@/lib/clubs";
import LoadingState from "@/components/layout/loading-state";
import InlineError from "@/components/layout/inline-error";
import EmptyState from "@/components/layout/empty-state";
import SectionCard from "@/components/layout/section-card";
import {
  getLastNameKey,
  getNameSearchRank,
  normalizeSearchText,
} from "@/lib/search";
import { useModal } from "@/components/overlays/modal-provider";
import { useSheet, type SheetAction } from "@/components/overlays/sheet-provider";
import { useToast } from "@/components/overlays/toast-provider";
import { useOverlayPresets } from "@/components/overlays/presets";

type PlayerAvailabilityStatus = "FREE_AGENT" | "WAIVERS" | "ROSTERED";

type AvailablePlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: "GK" | "DEF" | "MID" | "FWD";
  club: { slug: string; shortName: string | null; name: string } | null;
  status: PlayerAvailabilityStatus;
  waiverAvailableAt?: string;
  rosteredByFantasyTeamId?: string;
  rosteredByTeamName?: string;
};

type AvailablePlayersResponse = {
  leagueId: string;
  now: string;
  counts: Record<PlayerAvailabilityStatus, number>;
  players: AvailablePlayer[];
};

type PendingWaiverClaim = {
  id: string;
  status: "PENDING";
  createdAt: string;
  priorityNumberAtSubmit: number;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: AvailablePlayer["position"];
  };
  dropPlayer: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: AvailablePlayer["position"];
  } | null;
  waiverAvailableAt: string | null;
};

type ResolvedWaiverClaim = {
  id: string;
  status: "WON" | "LOST";
  processedAt: string | null;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: AvailablePlayer["position"];
  };
};

type Props = {
  leagueId: string;
};

type StatusFilter = "ALL" | PlayerAvailabilityStatus;
type PositionFilter = "ALL" | AvailablePlayer["position"];
type SortOption = "NAME_ASC" | "STATUS" | "WAIVER_SOON";
type DensityMode = "COMFORTABLE" | "COMPACT";
type PositionGroup = AvailablePlayer["position"];

type RosterSlot = {
  id: string;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    jerseyNumber: number | null;
    position: AvailablePlayer["position"];
    club: { slug: string; shortName: string | null } | null;
  } | null;
};

type RosterResponse = {
  team: { id: string; name: string };
  slots: RosterSlot[];
  lockInfo?: {
    isLocked: boolean;
    matchWeekNumber: number | null;
    status: "OPEN" | "LOCKED" | "FINALIZED";
  } | null;
};

const statusOrder: Record<PlayerAvailabilityStatus, number> = {
  FREE_AGENT: 0,
  WAIVERS: 1,
  ROSTERED: 2,
};

const formatDateTime = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildClubLabel = (club: AvailablePlayer["club"]) => {
  if (!club) return "Unknown club";
  return getClubDisplayName(club.slug, club.name);
};

const buildRosterClubLabel = (
  club: { slug: string; shortName: string | null } | null,
) => {
  if (!club) return "Unknown club";
  return getClubDisplayName(club.slug, null);
};

export default function PlayersClient({ leagueId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const modal = useModal();
  const sheet = useSheet();
  const toast = useToast();
  const { openSelector } = useOverlayPresets();
  const [data, setData] = useState<AvailablePlayersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingPlayerId, setClaimingPlayerId] = useState<string | null>(null);
  const [rosterSlots, setRosterSlots] = useState<RosterSlot[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [lockInfo, setLockInfo] = useState<RosterResponse["lockInfo"]>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDropPlayerId, setSelectedDropPlayerId] =
    useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"ADD" | "CLAIM" | null>(
    null,
  );
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<PendingWaiverClaim[]>([]);
  const [resolvedClaims, setResolvedClaims] = useState<ResolvedWaiverClaim[]>(
    [],
  );
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [notifications, setNotifications] = useState<
    Array<{ id: string; message: string }>
  >([]);
  const shownResolvedIds = useRef(new Set<string>());
  const hasInitializedResolved = useRef(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [positionFilter, setPositionFilter] =
    useState<PositionFilter>("ALL");
  const [clubFilter, setClubFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("NAME_ASC");
  const [density, setDensity] = useState<DensityMode>("COMFORTABLE");
  const [collapsedPositions, setCollapsedPositions] = useState<
    Record<PositionGroup, boolean>
  >({
    GK: false,
    DEF: false,
    MID: false,
    FWD: false,
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const hasInitializedFilters = useRef(false);
  const lastSyncedQuery = useRef<string | null>(null);
  const hasLoadedPreferences = useRef(false);
  const filterDraftRef = useRef({
    statusFilter: "ALL" as StatusFilter,
    positionFilter: "ALL" as PositionFilter,
    clubFilter: "ALL",
    sortOption: "NAME_ASC" as SortOption,
  });

  const loadPlayers = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/leagues/${leagueId}/players`, {
          cache: "no-store",
          signal,
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load players");
        }
        setData(payload);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [leagueId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPlayers(controller.signal);
    return () => controller.abort();
  }, [loadPlayers]);

  useEffect(() => {
    if (hasLoadedPreferences.current) return;
    hasLoadedPreferences.current = true;
    try {
      const storedDensity = window.localStorage.getItem("players-density");
      if (storedDensity === "COMPACT" || storedDensity === "COMFORTABLE") {
        setDensity(storedDensity);
      }
      const storedCollapsed = window.localStorage.getItem("players-collapsed");
      if (storedCollapsed) {
        const parsed = JSON.parse(storedCollapsed) as Partial<
          Record<PositionGroup, boolean>
        >;
        setCollapsedPositions((prev) => ({
          GK: parsed.GK ?? prev.GK,
          DEF: parsed.DEF ?? prev.DEF,
          MID: parsed.MID ?? prev.MID,
          FWD: parsed.FWD ?? prev.FWD,
        }));
      }
    } catch {
      // ignore localStorage parsing issues
    }
  }, []);

  useEffect(() => {
    if (!actionError) return;
    const timeout = window.setTimeout(() => {
      setActionError(null);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTerm(searchInput);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setRosterError(null);
    fetch(`/api/leagues/${leagueId}/team/roster`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | (RosterResponse & { error?: string })
          | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load roster");
        }
        setRosterSlots(payload?.slots ?? []);
        setLockInfo(payload?.lockInfo ?? null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setRosterError(err instanceof Error ? err.message : "Failed to load");
      });

    return () => controller.abort();
  }, [leagueId]);

  useEffect(() => {
    const controller = new AbortController();
    setClaimsError(null);
    fetch(`/api/leagues/${leagueId}/waivers/claims`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | {
              pendingClaims?: PendingWaiverClaim[];
              resolvedClaims?: ResolvedWaiverClaim[];
              error?: string;
            }
          | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to load claims");
        }
        const nextPending = payload?.pendingClaims ?? [];
        const nextResolved = payload?.resolvedClaims ?? [];
        setPendingClaims(nextPending);
        setResolvedClaims(nextResolved);
        if (!hasInitializedResolved.current) {
          nextResolved.forEach((claim) => {
            shownResolvedIds.current.add(claim.id);
          });
          hasInitializedResolved.current = true;
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setClaimsError(err instanceof Error ? err.message : "Failed to load");
      });

    return () => controller.abort();
  }, [leagueId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const claimedPlayerIds = useMemo(
    () => new Set(pendingClaims.map((claim) => claim.player.id)),
    [pendingClaims],
  );

  useEffect(() => {
    if (resolvedClaims.length === 0) return;
    const newNotifications: Array<{ id: string; message: string }> = [];

    resolvedClaims.forEach((claim) => {
      if (shownResolvedIds.current.has(claim.id)) return;
      shownResolvedIds.current.add(claim.id);
      const message =
        claim.status === "WON"
          ? `Waiver won: ${formatPlayerName(
              claim.player.name,
              claim.player.jerseyNumber,
            )} added`
          : `Waiver lost: ${formatPlayerName(
              claim.player.name,
              claim.player.jerseyNumber,
            )} (higher priority team)`;
      newNotifications.push({ id: claim.id, message });
    });

    if (newNotifications.length === 0) return;

    setNotifications((prev) => [...newNotifications, ...prev]);
    newNotifications.forEach((notice) => {
      window.setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((item) => item.id !== notice.id),
        );
      }, 6000);
    });
  }, [resolvedClaims]);

  const formatClaimCountdown = (value: string | null) => {
    if (!value) return "Clears soon";
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return "Clears soon";
    const localTime = formatDateTime(value);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return "Processing waivers...";
    const totalMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return localTime
        ? `Clears in ${hours}h ${minutes}m (at ${localTime})`
        : `Clears in ${hours}h ${minutes}m`;
    }
    return localTime
      ? `Clears in ${minutes}m (at ${localTime})`
      : `Clears in ${minutes}m`;
  };

  const rosteredPlayers = useMemo(
    () =>
      rosterSlots
        .filter((slot) => slot.player)
        .map((slot) => ({
          id: slot.player!.id,
          name: slot.player!.name,
          jerseyNumber: slot.player!.jerseyNumber ?? null,
          position: slot.player!.position,
          club: slot.player!.club,
          isStarter: slot.isStarter,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rosterSlots],
  );

  const rosterFull = useMemo(
    () => rosterSlots.length > 0 && rosterSlots.every((slot) => slot.player),
    [rosterSlots],
  );

  const refreshRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/team/roster`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        | (RosterResponse & { error?: string })
        | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load roster");
      }
      setRosterSlots(payload?.slots ?? []);
      setLockInfo(payload?.lockInfo ?? null);
      setRosterError(null);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [leagueId]);

  const refreshClaims = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/waivers/claims`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            pendingClaims?: PendingWaiverClaim[];
            resolvedClaims?: ResolvedWaiverClaim[];
            error?: string;
          }
        | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load claims");
      }
      const nextPending = payload?.pendingClaims ?? [];
      const nextResolved = payload?.resolvedClaims ?? [];
      setPendingClaims(nextPending);
      setResolvedClaims(nextResolved);
      if (!hasInitializedResolved.current) {
        nextResolved.forEach((claim) => {
          shownResolvedIds.current.add(claim.id);
        });
        hasInitializedResolved.current = true;
      }
      setClaimsError(null);
    } catch (err) {
      setClaimsError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [leagueId]);

  const openDropModal = (
    action: "ADD" | "CLAIM",
    playerId: string,
  ) => {
    setPendingAction(action);
    setPendingPlayerId(playerId);
    setSelectedDropPlayerId(null);
    setModalOpen(true);
  };

  const submitClaim = async (playerId: string, dropId?: string | null) => {
    setActionMessage(null);
    setActionError(null);
    setClaimingPlayerId(playerId);

    try {
      const claimPayload: Record<string, string> = { playerId };
      if (dropId) {
        claimPayload.dropPlayerId = dropId;
      }

      const res = await fetch(`/api/leagues/${leagueId}/waivers/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(claimPayload),
      });
      const responsePayload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(responsePayload?.error ?? "Unable to submit claim");
      }
      setActionMessage("Claim submitted.");
      await Promise.all([loadPlayers(), refreshRoster(), refreshClaims()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to submit claim");
    } finally {
      setClaimingPlayerId(null);
    }
  };

  const submitAdd = async (playerId: string, dropId?: string | null) => {
    setActionMessage(null);
    setActionError(null);
    setClaimingPlayerId(playerId);

    try {
      const addPayload: Record<string, string> = { playerId };
      if (dropId) {
        addPayload.dropPlayerId = dropId;
      }

      const res = await fetch(`/api/leagues/${leagueId}/free-agents/add`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(addPayload),
      });
      const responsePayload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(responsePayload?.error ?? "Unable to add player");
      }
      setActionMessage("Player added.");
      await Promise.all([loadPlayers(), refreshRoster(), refreshClaims()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to add player");
    } finally {
      setClaimingPlayerId(null);
    }
  };

  const submitPlayerAction = async (
    action: "ADD" | "CLAIM",
    playerId: string,
    dropId?: string | null,
  ) => {
    try {
      const payload: Record<string, string> = { playerId };
      if (dropId) payload.dropPlayerId = dropId;
      const url =
        action === "ADD"
          ? `/api/leagues/${leagueId}/free-agents/add`
          : `/api/leagues/${leagueId}/waivers/claim`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          message: responsePayload?.error ?? "Unable to submit request",
        } as const;
      }
      await Promise.all([loadPlayers(), refreshRoster(), refreshClaims()]);
      return { ok: true } as const;
    } catch (err) {
      return {
        ok: false,
        status: 500,
        message: err instanceof Error ? err.message : "Unable to submit request",
      } as const;
    }
  };

  const handleActionClick = (action: "ADD" | "CLAIM", playerId: string) => {
    if (action === "CLAIM" && claimedPlayerIds.has(playerId)) {
      return;
    }
    if (rosterFull) {
      openDropModal(action, playerId);
      return;
    }

    if (action === "ADD") {
      void submitAdd(playerId);
      return;
    }
    void submitClaim(playerId);
  };

  const handleModalConfirm = () => {
    if (!pendingAction || !pendingPlayerId) return;
    if (!selectedDropPlayerId) {
      setActionMessage("Select a drop player to continue.");
      return;
    }
    if (pendingAction === "ADD") {
      void submitAdd(pendingPlayerId, selectedDropPlayerId);
    } else {
      void submitClaim(pendingPlayerId, selectedDropPlayerId);
    }
    setModalOpen(false);
  };

  const clubs = useMemo(() => {
    const clubMap = new Map<string, string>();
    data?.players.forEach((player) => {
      if (!player.club) return;
      clubMap.set(player.club.slug, buildClubLabel(player.club));
    });
    return Array.from(clubMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([slug, label]) => ({ slug, label }));
  }, [data]);

  useEffect(() => {
    if (
      searchParamsString === "" &&
      lastSyncedQuery.current &&
      (searchTerm.trim() ||
        statusFilter !== "ALL" ||
        positionFilter !== "ALL" ||
        clubFilter !== "ALL" ||
        sortOption !== "NAME_ASC")
    ) {
      return;
    }
    const params = new URLSearchParams(searchParamsString);
    const query = params.get("q") ?? "";
    const statusParam = params.get("status") ?? "ALL";
    const positionParam = params.get("position") ?? "ALL";
    const clubParam = params.get("club") ?? "ALL";
    const sortParam = params.get("sort") ?? "NAME_ASC";

    const nextSearch = query.trim();
    const nextStatus =
      statusParam === "FREE_AGENT" ||
      statusParam === "WAIVERS" ||
      statusParam === "ROSTERED" ||
      statusParam === "ALL"
        ? (statusParam as StatusFilter)
        : "ALL";
    const nextPosition =
      positionParam === "GK" ||
      positionParam === "DEF" ||
      positionParam === "MID" ||
      positionParam === "FWD" ||
      positionParam === "ALL"
        ? (positionParam as PositionFilter)
        : "ALL";
    const clubKeys = new Set(clubs.map((club) => club.slug));
    const nextClub =
      clubParam === "ALL" || clubKeys.has(clubParam) ? clubParam : "ALL";
    const nextSort =
      sortParam === "STATUS" ||
      sortParam === "WAIVER_SOON" ||
      sortParam === "NAME_ASC"
        ? (sortParam as SortOption)
        : "NAME_ASC";

    if (nextSearch !== searchTerm) {
      setSearchTerm(nextSearch);
      setSearchInput(nextSearch);
    }
    if (nextStatus !== statusFilter) setStatusFilter(nextStatus);
    if (nextPosition !== positionFilter) setPositionFilter(nextPosition);
    if (nextClub !== clubFilter) setClubFilter(nextClub);
    if (nextSort !== sortOption) setSortOption(nextSort);
    hasInitializedFilters.current = true;
    lastSyncedQuery.current = params.toString();
  }, [
    searchParamsString,
    clubs,
    searchTerm,
    statusFilter,
    positionFilter,
    clubFilter,
    sortOption,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem("players-density", density);
    } catch {
      // ignore write errors
    }
  }, [density]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "players-collapsed",
        JSON.stringify(collapsedPositions),
      );
    } catch {
      // ignore write errors
    }
  }, [collapsedPositions]);

  useEffect(() => {
    if (!hasInitializedFilters.current) return;
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (positionFilter !== "ALL") params.set("position", positionFilter);
    if (clubFilter !== "ALL") params.set("club", clubFilter);
    if (sortOption !== "NAME_ASC") params.set("sort", sortOption);

    const nextQuery = params.toString();
    const currentQuery = searchParamsString;
    if (nextQuery === currentQuery || nextQuery === lastSyncedQuery.current) return;

    const url = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(url, { scroll: false });
    lastSyncedQuery.current = nextQuery;
  }, [
    searchTerm,
    statusFilter,
    positionFilter,
    clubFilter,
    sortOption,
    pathname,
    router,
    searchParamsString,
  ]);

  const filteredPlayers = useMemo(() => {
    const base = data?.players ?? [];
    const query = normalizeSearchText(searchTerm);

    const filtered = base.filter((player) => {
      if (statusFilter !== "ALL" && player.status !== statusFilter) {
        return false;
      }
      if (positionFilter !== "ALL" && player.position !== positionFilter) {
        return false;
      }
      if (clubFilter !== "ALL") {
        if (!player.club || player.club.slug !== clubFilter) {
          return false;
        }
      }
      if (query && getNameSearchRank(player.name, query) === 0) return false;
      return true;
    });

    const scored = filtered.map((player) => ({
      player,
      rank: query ? getNameSearchRank(player.name, query) : 0,
      lastName: getLastNameKey(player.name),
    }));

    scored.sort((a, b) => {
      if (query && a.rank !== b.rank) return b.rank - a.rank;
      if (!query) {
        if (sortOption === "STATUS") {
          const statusDiff = statusOrder[a.player.status] - statusOrder[b.player.status];
          if (statusDiff !== 0) return statusDiff;
        }
        if (sortOption === "WAIVER_SOON") {
          const aDate = a.player.waiverAvailableAt
            ? new Date(a.player.waiverAvailableAt).getTime()
            : Number.POSITIVE_INFINITY;
          const bDate = b.player.waiverAvailableAt
            ? new Date(b.player.waiverAvailableAt).getTime()
            : Number.POSITIVE_INFINITY;
          if (aDate !== bDate) return aDate - bDate;
        }
      }
      const lastNameDiff = a.lastName.localeCompare(b.lastName);
      if (lastNameDiff !== 0) return lastNameDiff;
      return a.player.name.localeCompare(b.player.name);
    });

    return scored.map((entry) => entry.player);
  }, [data, searchTerm, statusFilter, positionFilter, clubFilter, sortOption]);

  const groupedPlayers = useMemo(() => {
    const groups: Record<PositionGroup, AvailablePlayer[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    filteredPlayers.forEach((player) => {
      groups[player.position].push(player);
    });
    return groups;
  }, [filteredPlayers]);

  const selectedPlayer =
    selectedPlayerId && data
      ? data.players.find((player) => player.id === selectedPlayerId) ?? null
      : null;

  const densityClasses =
    density === "COMPACT"
      ? {
          row: "py-2",
          name: "text-sm",
          meta: "text-[10px]",
        }
      : {
          row: "py-3",
          name: "text-sm",
          meta: "text-xs",
        };

  const counts = data?.counts ?? {
    FREE_AGENT: 0,
    WAIVERS: 0,
    ROSTERED: 0,
  };

  const positionOrder: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];

  const togglePosition = (key: PositionGroup) => {
    setCollapsedPositions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openFiltersModal = () => {
    filterDraftRef.current = {
      statusFilter,
      positionFilter,
      clubFilter,
      sortOption,
    };

    modal.open({
      id: "players-filters",
      title: "Filter & Sort",
      render: () => (
        <MobileFiltersContent
          initial={filterDraftRef.current}
          clubs={clubs}
          onChange={(next) => {
            filterDraftRef.current = next;
          }}
        />
      ),
      footer: {
        leftAction: {
          key: "clear",
          label: "Clear",
          onPress: () => {
            setStatusFilter("ALL");
            setPositionFilter("ALL");
            setClubFilter("ALL");
            setSortOption("NAME_ASC");
            modal.close({ type: "submit" });
          },
        },
        rightAction: {
          key: "apply",
          label: "Apply",
          onPress: () => {
            const draft = filterDraftRef.current;
            setStatusFilter(draft.statusFilter);
            setPositionFilter(draft.positionFilter);
            setClubFilter(draft.clubFilter);
            setSortOption(draft.sortOption);
            modal.close({ type: "submit" });
          },
        },
      },
    });
  };

  const openPlayerSheet = (player: AvailablePlayer) => {
    const clubLabel = buildClubLabel(player.club);
    const primaryAction =
      player.status === "WAIVERS"
        ? "CLAIM"
        : player.status === "FREE_AGENT"
          ? "ADD"
          : null;
    const primaryLabel =
      primaryAction === "CLAIM" ? "Claim" : primaryAction === "ADD" ? "Add" : "";
    const primaryDisabled =
      player.status === "ROSTERED" ||
      (player.status === "WAIVERS" && claimedPlayerIds.has(player.id));

    const actions = [
      { key: "close", label: "Close", tone: "secondary" },
      primaryAction
        ? {
            key: primaryAction,
            label: primaryLabel,
            tone: "primary",
            disabled: primaryDisabled,
            autoClose: false,
            onPress: async (ctx) => {
              ctx.setError(null);
              let dropId: string | null = null;
              if (rosterFull) {
                dropId = await openSelector({
                  id: `drop-${player.id}`,
                  title: "Choose drop player",
                  options: rosteredPlayers.map((entry) => ({
                    id: entry.id,
                    label: formatPlayerName(entry.name, entry.jerseyNumber),
                    subLabel: `${entry.position} · ${buildRosterClubLabel(entry.club)}`,
                    disabledReason:
                      lockInfo?.isLocked && entry.isStarter
                        ? "Starter locked"
                        : undefined,
                  })),
                  searchable: true,
                  emptyState: "No eligible players to drop.",
                });
                if (!dropId) return;
              }

              await sheet.replace({
                id: `confirm-${primaryAction}-${player.id}`,
                title: primaryAction === "ADD" ? "Confirm add" : "Confirm claim",
                subtitle:
                  primaryAction === "CLAIM"
                    ? formatClaimCountdown(player.waiverAvailableAt ?? null)
                    : "Free agent add",
                render: () => (
                  <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
                    <p>
                      {primaryAction === "ADD" ? "Add" : "Claim"}{" "}
                      {formatPlayerName(player.name, player.jerseyNumber)}.
                    </p>
                    {dropId ? (
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-xs text-[var(--text-muted)]">
                        Drop:{" "}
                        {formatPlayerName(
                          rosteredPlayers.find((entry) => entry.id === dropId)
                            ?.name ?? "Selected player",
                          rosteredPlayers.find((entry) => entry.id === dropId)
                            ?.jerseyNumber ?? null,
                        )}
                      </div>
                    ) : null}
                  </div>
                ),
                actions: [
                  { key: "cancel", label: "Cancel", tone: "secondary" },
                  {
                    key: "confirm",
                    label:
                      primaryAction === "ADD"
                        ? "Confirm add"
                        : "Confirm claim",
                    tone: "primary",
                    autoClose: false,
                    onPress: async (confirmCtx) => {
                      confirmCtx.setLoading(true);
                      const result = await submitPlayerAction(
                        primaryAction,
                        player.id,
                        dropId,
                      );
                      confirmCtx.setLoading(false);
                      if (!result.ok) {
                        confirmCtx.setError(result.message);
                        return;
                      }
                      toast.success(
                        primaryAction === "ADD"
                          ? "Player added."
                          : "Claim submitted.",
                      );
                      confirmCtx.close({
                        type: "action",
                        payload: { key: "confirm" },
                      });
                    },
                  },
                ],
              });
            },
          }
        : null,
    ].filter(Boolean) as SheetAction[];

    sheet.open({
      id: `player-${player.id}`,
      title: formatPlayerName(player.name, player.jerseyNumber),
      subtitle: `${player.position} · ${clubLabel}`,
      render: () => (
        <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            Status
          </p>
          <p>
            {player.status === "WAIVERS"
              ? `Waivers · Clears ${formatDateTime(player.waiverAvailableAt) ?? "soon"}`
              : player.status === "ROSTERED"
                ? `Rostered by ${player.rosteredByTeamName ?? "another team"}`
                : "Free agent"}
          </p>
          {rosterFull ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-xs text-[var(--text-muted)]">
              Roster full — you will be asked to choose a drop player.
            </div>
          ) : null}
        </div>
      ),
      actions,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-30 -mx-6 bg-[var(--background)] px-6 pb-3 pt-2 sm:hidden">
        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search players"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openFiltersModal}
              className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
            >
              Filter &amp; Sort
            </button>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {filteredPlayers.length} players
            </span>
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="fixed right-6 top-6 z-50 w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">Roster update blocked</p>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs font-semibold uppercase tracking-wide text-amber-700"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-sm">{actionError}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Free agents
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
            {counts.FREE_AGENT}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Waivers
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
            {counts.WAIVERS}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Rostered
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
            {counts.ROSTERED}
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-6 border-b border-[var(--border)] bg-[var(--surface)]/95 px-6 py-3 backdrop-blur md:-mx-10 md:px-10 sm:block hidden">
        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search players"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
          />
          <div className="grid gap-3 md:grid-cols-5">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Status
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="ALL">All</option>
                <option value="FREE_AGENT">Free agents</option>
                <option value="WAIVERS">Waivers</option>
                <option value="ROSTERED">Rostered</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Position
              <select
                value={positionFilter}
                onChange={(event) =>
                  setPositionFilter(event.target.value as PositionFilter)
                }
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="ALL">All</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Club
              <select
                value={clubFilter}
                onChange={(event) => setClubFilter(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="ALL">All</option>
                {clubs.map((club) => (
                  <option key={club.slug} value={club.slug}>
                    {club.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Sort
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="NAME_ASC">Name A-Z</option>
                <option value="STATUS">Status</option>
                <option value="WAIVER_SOON">Waiver clears soonest</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Density
              <select
                value={density}
                onChange={(event) => setDensity(event.target.value as DensityMode)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="COMFORTABLE">Comfortable</option>
                <option value="COMPACT">Compact</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <span>{filteredPlayers.length} players</span>
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
                setStatusFilter("ALL");
                setPositionFilter("ALL");
                setClubFilter("ALL");
                setSortOption("NAME_ASC");
              }}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              Clear filters
            </button>
          </div>
          {rosterError ? (
            <div className="text-xs text-[var(--warning)]">{rosterError}</div>
          ) : null}
        </div>
      </div>

      {actionMessage ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm text-[var(--text-muted)]">
          {actionMessage}
        </div>
      ) : null}
      {notifications.length > 0 ? (
        <div className="flex flex-col gap-2">
          {notifications.map((notice) => (
            <div
              key={notice.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-sm text-[var(--text)]"
            >
              {notice.message}
            </div>
          ))}
        </div>
      ) : null}

      <SectionCard
        title="Pending claims"
        description="Claims you have waiting on waivers."
        actions={
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {pendingClaims.length} pending
          </span>
        }
      >
        {claimsError ? (
          <InlineError message={claimsError} />
        ) : pendingClaims.length === 0 ? (
          <EmptyState
            title="No pending claims"
            description="Your waiver claims will appear here once submitted."
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {pendingClaims.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {formatPlayerName(
                      claim.player.name,
                      claim.player.jerseyNumber,
                    )}
                  </span>
                  {claim.dropPlayer ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      Drop:{" "}
                      {formatPlayerName(
                        claim.dropPlayer.name,
                        claim.dropPlayer.jerseyNumber,
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Drop: None</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">
                    Priority at submission: #{claim.priorityNumberAtSubmit}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatClaimCountdown(claim.waiverAvailableAt)}
                  </span>
                </div>
                <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {isLoading ? (
        <LoadingState label="Loading players…" />
      ) : error ? (
        <InlineError message={error} />
      ) : filteredPlayers.length === 0 ? (
        <EmptyState
          title="No players match these filters"
          description="Try adjusting your position, status, or search filters."
        />
      ) : (
        <div className="hidden sm:grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]">
          <div className="hidden sm:block">
            <SectionCard title="Players">
            <div className="flex flex-col gap-4">
              {positionOrder.map((positionKey) => {
                const group = groupedPlayers[positionKey];
                const isCollapsed = collapsedPositions[positionKey];
                return (
                  <div
                    key={positionKey}
                    className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <button
                      type="button"
                      onClick={() => togglePosition(positionKey)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                    >
                      <span>{positionKey}</span>
                      <span className="flex items-center gap-3">
                        <span>{group.length} players</span>
                        <span>{isCollapsed ? "＋" : "－"}</span>
                      </span>
                    </button>
                    {isCollapsed ? null : group.length === 0 ? (
                      <div className="border-t border-[var(--border)] p-4">
                        <EmptyState
                          title="No players"
                          description="No players match the current filters."
                        />
                      </div>
                    ) : (
                      <ul className="divide-y divide-[var(--border)]">
                        {group.map((player, index) => {
                          const clubLabel = buildClubLabel(player.club);
                          const statusClasses =
                            player.status === "FREE_AGENT"
                              ? "bg-emerald-100 text-emerald-700"
                              : player.status === "WAIVERS"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-[var(--surface2)] text-[var(--text-muted)]";
                          const isSelected = selectedPlayerId === player.id;
                          return (
                            <li
                              key={player.id}
                              className={`px-4 ${densityClasses.row} ${
                                index % 2 === 1 ? "bg-[var(--surface2)]" : "bg-[var(--surface)]"
                              }`}
                            >
                              <div
                                className="flex flex-wrap items-center justify-between gap-4"
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedPlayerId(player.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    setSelectedPlayerId(player.id);
                                  }
                                }}
                              >
                                <div className="flex flex-col gap-1">
                                  <p className={`${densityClasses.name} font-semibold text-[var(--text)]`}>
                                    {formatPlayerName(player.name, player.jerseyNumber)}
                                  </p>
                                  <p className={`${densityClasses.meta} text-[var(--text-muted)]`}>
                                    {player.position} · {clubLabel}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses}`}
                                  >
                                    {player.status.replace("_", " ")}
                                  </span>
                                  {player.status === "WAIVERS" ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleActionClick("CLAIM", player.id);
                                      }}
                                      disabled={
                                        claimingPlayerId === player.id ||
                                        claimedPlayerIds.has(player.id)
                                      }
                                      className="w-24 rounded-full bg-[var(--text)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--background)] disabled:opacity-60"
                                    >
                                      {claimedPlayerIds.has(player.id)
                                        ? "Claimed"
                                        : claimingPlayerId === player.id
                                          ? "Claiming..."
                                          : "Claim"}
                                    </button>
                                  ) : player.status === "FREE_AGENT" ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleActionClick("ADD", player.id);
                                      }}
                                      disabled={claimingPlayerId === player.id}
                                      className="w-24 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text)] disabled:opacity-60"
                                    >
                                      {claimingPlayerId === player.id ? "Adding..." : "Add"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled
                                      className="w-24 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                                    >
                                      Rostered
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isSelected ? (
                                <div className="mt-2 text-xs text-[var(--text-muted)] md:hidden">
                                  {player.status === "WAIVERS"
                                    ? `Clears: ${formatDateTime(player.waiverAvailableAt) ?? "TBD"}`
                                    : player.status === "ROSTERED"
                                      ? `Rostered by: ${player.rosteredByTeamName ?? "Unknown team"}`
                                      : "Free agent"}
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            </SectionCard>
          </div>

          <div className="hidden lg:block">
            <SectionCard
              title="Preview"
              description="Select a player to review details."
            >
              {selectedPlayer ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--text)]">
                      {formatPlayerName(
                        selectedPlayer.name,
                        selectedPlayer.jerseyNumber,
                      )}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      {selectedPlayer.position} · {buildClubLabel(selectedPlayer.club)}
                    </p>
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {selectedPlayer.status === "WAIVERS"
                      ? `Clears: ${formatDateTime(selectedPlayer.waiverAvailableAt) ?? "TBD"}`
                      : selectedPlayer.status === "ROSTERED"
                        ? `Rostered by: ${selectedPlayer.rosteredByTeamName ?? "Unknown team"}`
                        : "Free agent"}
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedPlayer.status === "WAIVERS" ? (
                      <button
                        type="button"
                        onClick={() => handleActionClick("CLAIM", selectedPlayer.id)}
                        disabled={
                          claimingPlayerId === selectedPlayer.id ||
                          claimedPlayerIds.has(selectedPlayer.id)
                        }
                        className="w-28 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--background)] disabled:opacity-60"
                      >
                        {claimedPlayerIds.has(selectedPlayer.id)
                          ? "Claimed"
                          : claimingPlayerId === selectedPlayer.id
                            ? "Claiming..."
                            : "Claim"}
                      </button>
                    ) : selectedPlayer.status === "FREE_AGENT" ? (
                      <button
                        type="button"
                        onClick={() => handleActionClick("ADD", selectedPlayer.id)}
                        disabled={claimingPlayerId === selectedPlayer.id}
                        className="w-28 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text)] disabled:opacity-60"
                      >
                        {claimingPlayerId === selectedPlayer.id ? "Adding..." : "Add"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-28 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        Rostered
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No player selected"
                  description="Choose a player from the list to preview details."
                />
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {filteredPlayers.length > 0 ? (
        <div className="grid gap-3 sm:hidden">
          {filteredPlayers.map((player) => {
            const clubLabel = buildClubLabel(player.club);
            const statusLabel = player.status.replace("_", " ");
            const actionLabel =
              player.status === "WAIVERS"
                ? claimedPlayerIds.has(player.id)
                  ? "Claimed"
                  : "Claim"
                : player.status === "FREE_AGENT"
                  ? "Add"
                  : "Rostered";
            const actionDisabled =
              player.status === "ROSTERED" ||
              (player.status === "WAIVERS" && claimedPlayerIds.has(player.id));
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => openPlayerSheet(player)}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-3 text-left"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {formatPlayerName(player.name, player.jerseyNumber)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {player.position} · {clubLabel}
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {statusLabel}
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    actionDisabled
                      ? "border border-[var(--border)] text-[var(--text-muted)]"
                      : "bg-[var(--accent)] text-[var(--background)]"
                  }`}
                >
                  {actionLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Select a drop player
                </h2>
                <p className="text-sm text-zinc-500">
                  Your roster is full. Choose a player to drop before{" "}
                  {pendingAction === "ADD" ? "adding" : "claiming"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm font-semibold text-zinc-400 hover:text-zinc-700"
              >
                Close
              </button>
            </div>

            {lockInfo?.isLocked ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Starters cannot be dropped while MatchWeek{" "}
                {lockInfo.matchWeekNumber ?? "?"} is {lockInfo.status}.
              </div>
            ) : null}

            <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-zinc-200">
              <ul className="divide-y divide-zinc-200">
                {rosteredPlayers.map((player) => {
                  const isStarter = player.isStarter;
                  const isBlocked = Boolean(lockInfo?.isLocked && isStarter);
                  const clubLabel = buildRosterClubLabel(player.club);
                  return (
                    <li key={player.id} className="p-3">
                      <label className="flex items-center gap-3 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="dropPlayer"
                          value={player.id}
                          disabled={isBlocked}
                          checked={selectedDropPlayerId === player.id}
                          onChange={() => setSelectedDropPlayerId(player.id)}
                        />
                        <span className="flex flex-col">
                          <span className="font-semibold text-zinc-900">
                            {formatPlayerName(player.name, player.jerseyNumber)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {player.position} · {clubLabel ?? "Unknown club"}
                            {isStarter ? " · Starter" : ""}
                            {isBlocked ? " · Locked" : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                disabled={!selectedDropPlayerId || claimingPlayerId !== null}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
              >
                {claimingPlayerId ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileFiltersContent({
  initial,
  clubs,
  onChange,
}: {
  initial: {
    statusFilter: StatusFilter;
    positionFilter: PositionFilter;
    clubFilter: string;
    sortOption: SortOption;
  };
  clubs: Array<{ slug: string; label: string }>;
  onChange: (next: {
    statusFilter: StatusFilter;
    positionFilter: PositionFilter;
    clubFilter: string;
    sortOption: SortOption;
  }) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>(initial.statusFilter);
  const [position, setPosition] = useState<PositionFilter>(initial.positionFilter);
  const [club, setClub] = useState(initial.clubFilter);
  const [sort, setSort] = useState<SortOption>(initial.sortOption);

  useEffect(() => {
    onChange({
      statusFilter: status,
      positionFilter: position,
      clubFilter: club,
      sortOption: sort,
    });
  }, [status, position, club, sort, onChange]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="ALL">All</option>
          <option value="FREE_AGENT">Free agents</option>
          <option value="WAIVERS">Waivers</option>
          <option value="ROSTERED">Rostered</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Position
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value as PositionFilter)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="ALL">All</option>
          <option value="GK">GK</option>
          <option value="DEF">DEF</option>
          <option value="MID">MID</option>
          <option value="FWD">FWD</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Club
        <select
          value={club}
          onChange={(event) => setClub(event.target.value)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="ALL">All</option>
          {clubs.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Sort
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="NAME_ASC">Name A-Z</option>
          <option value="STATUS">Status</option>
          <option value="WAIVER_SOON">Waiver clears soonest</option>
        </select>
      </label>
    </div>
  );
}
