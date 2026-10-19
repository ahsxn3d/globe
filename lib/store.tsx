"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { geoErrorMessage } from "@/lib/geo";
import { overallAverage, scoreFor } from "@/lib/ratings";
import { COMMUNITY_SCORES, DEFAULT_CRITERIA, SEED_PINS } from "@/lib/seed";
import { loadState, saveState } from "@/lib/storage";
import {
  DEVICE_PIN_ID,
  type Criterion,
  type LiveFix,
  type Pin,
  type PinCategory,
  type PinDraft,
  type UserRating,
} from "@/lib/types";

type FlyRequest = {
  lat: number;
  lng: number;
  zoom: number;
  token: number;
};

type Toast = { id: number; text: string } | null;

type State = {
  hydrated: boolean;
  pro: boolean;
  userPins: Pin[];
  deletedSeedIds: string[];
  criteria: Criterion[];
  removedCriterionIds: string[];
  ratings: UserRating[];
  query: string;
  category: PinCategory | "All";
  ratingCriterionId: string;
  ratingMin: number;
  selectedId: string | null;
  draft: PinDraft | null;
  pricingOpen: boolean;
  live: boolean;
  locating: boolean;
  livePos: LiveFix | null;
  fly: FlyRequest | null;
  geoError: string | null;
  toast: Toast;
};

type Action =
  | { type: "hydrate"; state: ReturnType<typeof loadState> }
  | { type: "set-pro"; pro: boolean }
  | { type: "set-query"; query: string }
  | { type: "set-category"; category: PinCategory | "All" }
  | { type: "set-rating-filter"; criterionId: string; min: number }
  | { type: "select"; id: string | null }
  | { type: "draft"; draft: PinDraft | null }
  | { type: "pricing"; open: boolean }
  | { type: "save-pin"; pin: Pin }
  | { type: "delete-pin"; id: string }
  | { type: "add-criterion"; criterion: Criterion }
  | { type: "remove-criterion"; id: string }
  | { type: "rate"; rating: UserRating }
  | { type: "live"; live: boolean }
  | { type: "locating"; locating: boolean }
  | { type: "live-pos"; pos: LiveFix }
  | { type: "fly"; lat: number; lng: number; zoom?: number }
  | { type: "geo-error"; message: string | null }
  | { type: "toast"; text: string }
  | { type: "clear-toast" };

const initialState: State = {
  hydrated: false,
  pro: false,
  userPins: [],
  deletedSeedIds: [],
  criteria: DEFAULT_CRITERIA,
  removedCriterionIds: [],
  ratings: [],
  query: "",
  category: "All",
  ratingCriterionId: "",
  ratingMin: 0,
  selectedId: null,
  draft: null,
  pricingOpen: false,
  live: false,
  locating: false,
  livePos: null,
  fly: null,
  geoError: null,
  toast: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        hydrated: true,
        pro: action.state.pro,
        userPins: action.state.userPins,
        deletedSeedIds: action.state.deletedSeedIds,
        criteria: action.state.criteria,
        removedCriterionIds: action.state.removedCriterionIds,
        ratings: action.state.ratings,
      };
    case "set-pro":
      return {
        ...state,
        pro: action.pro,
        live: action.pro ? state.live : false,
        livePos: action.pro ? state.livePos : null,
        ratingCriterionId: action.pro ? state.ratingCriterionId : "",
        ratingMin: action.pro ? state.ratingMin : 0,
        selectedId:
          !action.pro &&
          state.selectedId &&
          [...SEED_PINS, ...state.userPins].find((pin) => pin.id === state.selectedId)
            ?.visibility === "private"
            ? null
            : state.selectedId,
      };
    case "set-query":
      return { ...state, query: action.query };
    case "set-category":
      return { ...state, category: action.category };
    case "set-rating-filter":
      return {
        ...state,
        ratingCriterionId: action.criterionId,
        ratingMin: action.min,
      };
    case "select":
      return { ...state, selectedId: action.id };
    case "draft":
      return { ...state, draft: action.draft };
    case "pricing":
      return { ...state, pricingOpen: action.open };
    case "save-pin": {
      const exists = state.userPins.some((pin) => pin.id === action.pin.id);
      const userPins = exists
        ? state.userPins.map((pin) => (pin.id === action.pin.id ? action.pin : pin))
        : [action.pin, ...state.userPins];
      return {
        ...state,
        userPins,
        draft: null,
        selectedId: action.pin.id,
      };
    }
    case "delete-pin": {
      const seed = SEED_PINS.some((pin) => pin.id === action.id);
      return {
        ...state,
        userPins: state.userPins.filter((pin) => pin.id !== action.id),
        deletedSeedIds: seed
          ? [...new Set([...state.deletedSeedIds, action.id])]
          : state.deletedSeedIds,
        ratings: state.ratings.filter((rating) => rating.pinId !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }
    case "add-criterion":
      return { ...state, criteria: [...state.criteria, action.criterion] };
    case "remove-criterion":
      return {
        ...state,
        criteria: state.criteria.filter((criterion) => criterion.id !== action.id),
        removedCriterionIds: [...new Set([...state.removedCriterionIds, action.id])],
        ratings: state.ratings.filter((rating) => rating.criterionId !== action.id),
        ratingCriterionId:
          state.ratingCriterionId === action.id ? "" : state.ratingCriterionId,
      };
    case "rate": {
      const rest = state.ratings.filter(
        (rating) =>
          !(
            rating.pinId === action.rating.pinId &&
            rating.criterionId === action.rating.criterionId
          ),
      );
      return { ...state, ratings: [...rest, action.rating] };
    }
    case "live":
      return {
        ...state,
        live: action.live,
        livePos: action.live ? state.livePos : null,
        geoError: action.live ? null : state.geoError,
      };
    case "locating":
      return { ...state, locating: action.locating, geoError: action.locating ? null : state.geoError };
    case "live-pos":
      return { ...state, livePos: action.pos, geoError: null };
    case "fly":
      return {
        ...state,
        fly: {
          lat: action.lat,
          lng: action.lng,
          zoom: action.zoom ?? 15,
          token: (state.fly?.token ?? 0) + 1,
        },
      };
    case "geo-error":
      return { ...state, geoError: action.message, locating: false };
    case "toast":
      return { ...state, toast: { id: (state.toast?.id ?? 0) + 1, text: action.text } };
    case "clear-toast":
      return { ...state, toast: null };
    default:
      return state;
  }
}

function mergePins(userPins: Pin[], deletedSeedIds: string[]) {
  const deleted = new Set(deletedSeedIds);
  const seeds = SEED_PINS.filter((pin) => !deleted.has(pin.id));
  const seedIds = new Set(seeds.map((pin) => pin.id));
  return [...userPins.filter((pin) => !seedIds.has(pin.id)), ...seeds];
}

type GlobeContextValue = State & {
  pins: Pin[];
  visiblePins: Pin[];
  filteredPins: Pin[];
  hiddenPrivateCount: number;
  selected: Pin | null;
  community: typeof COMMUNITY_SCORES;
  setPro: (pro: boolean) => void;
  setQuery: (query: string) => void;
  flyTo: (lat: number, lng: number, zoom: number) => void;
  setCategory: (category: PinCategory | "All") => void;
  setRatingFilter: (criterionId: string, min: number) => void;
  selectPin: (id: string | null, fly?: boolean) => void;
  openCreate: (lat: number, lng: number) => void;
  openEdit: (pinId: string) => void;
  closeDraft: () => void;
  openPricing: () => void;
  closePricing: () => void;
  savePin: (pin: Pin) => void;
  deletePin: (id: string) => void;
  addCriterion: (name: string, max: number) => void;
  removeCriterion: (id: string) => void;
  ratePin: (pinId: string, criterionId: string, value: number) => void;
  locateMe: () => void;
  toggleLive: () => void;
  sharePin: (pin: Pin) => Promise<void>;
  shareLive: () => Promise<void>;
  dismissToast: () => void;
  pinScore: (pinId: string, criterionId: string) => ReturnType<typeof scoreFor>;
  pinAverage: (pinId: string) => number | null;
};

const GlobeContext = createContext<GlobeContextValue | null>(null);

export function GlobeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const liveArmed = useRef(false);

  useEffect(() => {
    dispatch({ type: "hydrate", state: loadState() });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    saveState({
      userPins: state.userPins,
      deletedSeedIds: state.deletedSeedIds,
      criteria: state.criteria,
      removedCriterionIds: state.removedCriterionIds,
      ratings: state.ratings,
      pro: state.pro,
    });
  }, [
    state.hydrated,
    state.userPins,
    state.deletedSeedIds,
    state.criteria,
    state.removedCriterionIds,
    state.ratings,
    state.pro,
  ]);

  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => dispatch({ type: "clear-toast" }), 2400);
    return () => window.clearTimeout(timer);
  }, [state.toast]);

  useEffect(() => {
    if (!state.hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("lat") || !params.has("lng")) return;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    dispatch({ type: "fly", lat, lng, zoom: 14 });
  }, [state.hydrated]);

  useEffect(() => {
    if (!state.pro || !state.live) {
      liveArmed.current = false;
      return;
    }
    if (!navigator.geolocation) {
      dispatch({
        type: "geo-error",
        message: "This browser has no Geolocation API.",
      });
      dispatch({ type: "live", live: false });
      return;
    }

    let watchId = 0;
    let stopped = false;

    const onFix = (position: GeolocationPosition) => {
      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        updatedAt: Date.now(),
      };
      dispatch({ type: "live-pos", pos: next });
      if (!liveArmed.current) {
        liveArmed.current = true;
        dispatch({ type: "fly", lat: next.lat, lng: next.lng, zoom: 16 });
      }
    };

    const onError = (error: GeolocationPositionError) => {
      dispatch({ type: "geo-error", message: geoErrorMessage(error) });
      if (error.code === error.PERMISSION_DENIED) {
        dispatch({ type: "live", live: false });
      }
    };

    const arm = () => {
      if (stopped) return;
      watchId = navigator.geolocation.watchPosition(onFix, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      });
    };

    arm();
    const interval = window.setInterval(() => {
      navigator.geolocation.clearWatch(watchId);
      arm();
    }, 4000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [state.pro, state.live]);

  const pins = useMemo(
    () => mergePins(state.userPins, state.deletedSeedIds),
    [state.userPins, state.deletedSeedIds],
  );

  const visiblePins = useMemo(
    () => pins.filter((pin) => pin.visibility === "public" || state.pro),
    [pins, state.pro],
  );

  const hiddenPrivateCount = pins.filter((pin) => pin.visibility === "private" && !state.pro).length;

  const filteredPins = useMemo(() => {
    const query = state.query.trim().toLowerCase();
    return visiblePins
      .filter((pin) => {
        if (state.category !== "All" && pin.category !== state.category) return false;
        if (query) {
          const blob = `${pin.title} ${pin.note} ${pin.place} ${pin.category}`.toLowerCase();
          if (!blob.includes(query)) return false;
        }
        if (state.pro && state.ratingCriterionId && state.ratingMin > 0) {
          const score = scoreFor(
            pin.id,
            state.ratingCriterionId,
            COMMUNITY_SCORES,
            state.ratings,
          );
          if (score.average == null || score.average < state.ratingMin) return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [
    visiblePins,
    state.query,
    state.category,
    state.pro,
    state.ratingCriterionId,
    state.ratingMin,
    state.ratings,
  ]);

  const selected = visiblePins.find((pin) => pin.id === state.selectedId) ?? null;

  const setPro = useCallback((pro: boolean) => dispatch({ type: "set-pro", pro }), []);
  const setQuery = useCallback((query: string) => dispatch({ type: "set-query", query }), []);
  const flyTo = useCallback(
    (lat: number, lng: number, zoom: number) => dispatch({ type: "fly", lat, lng, zoom }),
    [],
  );
  const setCategory = useCallback(
    (category: PinCategory | "All") => dispatch({ type: "set-category", category }),
    [],
  );
  const setRatingFilter = useCallback(
    (criterionId: string, min: number) =>
      dispatch({ type: "set-rating-filter", criterionId, min }),
    [],
  );
  const selectPin = useCallback((id: string | null, fly = true) => {
    dispatch({ type: "select", id });
    if (!id || !fly) return;
    const pin = mergePins(
      state.userPins,
      state.deletedSeedIds,
    ).find((item) => item.id === id);
    if (!pin) return;
    dispatch({ type: "fly", lat: pin.lat, lng: pin.lng, zoom: 15 });
  }, [state.userPins, state.deletedSeedIds]);

  const openCreate = useCallback((lat: number, lng: number) => {
    dispatch({ type: "draft", draft: { mode: "create", lat, lng } });
  }, []);
  const openEdit = useCallback((pinId: string) => {
    dispatch({ type: "draft", draft: { mode: "edit", pinId } });
  }, []);
  const closeDraft = useCallback(() => dispatch({ type: "draft", draft: null }), []);
  const openPricing = useCallback(() => dispatch({ type: "pricing", open: true }), []);
  const closePricing = useCallback(() => dispatch({ type: "pricing", open: false }), []);

  const savePin = useCallback(
    (pin: Pin) => {
      if (pin.visibility === "private" && !state.pro) {
        dispatch({ type: "pricing", open: true });
        return;
      }
      dispatch({ type: "save-pin", pin });
      dispatch({ type: "fly", lat: pin.lat, lng: pin.lng, zoom: 15 });
      dispatch({ type: "toast", text: pin.id === DEVICE_PIN_ID ? "Pinned your exact location" : "Pin saved on this device" });
    },
    [state.pro],
  );

  const deletePin = useCallback((id: string) => {
    dispatch({ type: "delete-pin", id });
    dispatch({ type: "toast", text: "Pin removed from this device" });
  }, []);

  const addCriterion = useCallback((name: string, max: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({
      type: "add-criterion",
      criterion: {
        id: `criterion-${crypto.randomUUID()}`,
        name: trimmed.slice(0, 32),
        max,
      },
    });
  }, []);

  const removeCriterion = useCallback((id: string) => {
    dispatch({ type: "remove-criterion", id });
  }, []);

  const ratePin = useCallback((pinId: string, criterionId: string, value: number) => {
    dispatch({ type: "rate", rating: { pinId, criterionId, value } });
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch({ type: "geo-error", message: "This browser has no Geolocation API." });
      return;
    }
    dispatch({ type: "locating", locating: true });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const existing = state.userPins.find((pin) => pin.id === DEVICE_PIN_ID);
        const pin: Pin = existing
          ? { ...existing, lat, lng }
          : {
              id: DEVICE_PIN_ID,
              title: "My location",
              note: "Exact fix from this device. Free shares round it to about 1 km.",
              place: "This device",
              category: "City",
              lat,
              lng,
              visibility: "public",
              source: "user",
              createdAt: Date.now(),
            };
        dispatch({ type: "locating", locating: false });
        dispatch({ type: "save-pin", pin });
        dispatch({ type: "fly", lat, lng, zoom: 17 });
        dispatch({ type: "toast", text: "Pinned your exact location" });
      },
      (error) => {
        dispatch({ type: "geo-error", message: geoErrorMessage(error) });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [state.userPins]);

  const toggleLive = useCallback(() => {
    if (!state.pro) {
      dispatch({ type: "pricing", open: true });
      return;
    }
    dispatch({ type: "live", live: !state.live });
  }, [state.pro, state.live]);

  const copyOrShare = useCallback(async (title: string, text: string, toast: string) => {
    const small = window.matchMedia("(max-width: 767px)").matches;
    if (small && navigator.share) {
      try {
        await navigator.share({ title, text });
        dispatch({ type: "toast", text: toast });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    dispatch({ type: "toast", text: toast });
  }, []);

  const sharePin = useCallback(
    async (pin: Pin) => {
      const { buildShareText } = await import("@/lib/geo");
      const precise = state.pro;
      const payload = buildShareText(pin.title, pin.lat, pin.lng, precise, window.location.origin);
      await copyOrShare(
        pin.title,
        payload.text,
        precise ? "Copied precise location" : "Copied approximate location (~1 km)",
      );
    },
    [copyOrShare, state.pro],
  );

  const shareLive = useCallback(async () => {
    if (!state.livePos) return;
    const { buildShareText } = await import("@/lib/geo");
    const payload = buildShareText(
      "Live location",
      state.livePos.lat,
      state.livePos.lng,
      true,
      window.location.origin,
    );
    await copyOrShare("Live location", payload.text, "Copied precise live location");
  }, [copyOrShare, state.livePos]);

  const dismissToast = useCallback(() => dispatch({ type: "clear-toast" }), []);

  const pinScore = useCallback(
    (pinId: string, criterionId: string) =>
      scoreFor(pinId, criterionId, COMMUNITY_SCORES, state.ratings),
    [state.ratings],
  );

  const pinAverage = useCallback(
    (pinId: string) => overallAverage(pinId, state.criteria, COMMUNITY_SCORES, state.ratings),
    [state.criteria, state.ratings],
  );

  const value = useMemo<GlobeContextValue>(
    () => ({
      ...state,
      pins,
      visiblePins,
      filteredPins,
      hiddenPrivateCount,
      selected,
      community: COMMUNITY_SCORES,
      setPro,
      setQuery,
      flyTo,
      setCategory,
      setRatingFilter,
      selectPin,
      openCreate,
      openEdit,
      closeDraft,
      openPricing,
      closePricing,
      savePin,
      deletePin,
      addCriterion,
      removeCriterion,
      ratePin,
      locateMe,
      toggleLive,
      sharePin,
      shareLive,
      dismissToast,
      pinScore,
      pinAverage,
    }),
    [
      state,
      pins,
      visiblePins,
      filteredPins,
      hiddenPrivateCount,
      selected,
      setPro,
      setQuery,
      flyTo,
      setCategory,
      setRatingFilter,
      selectPin,
      openCreate,
      openEdit,
      closeDraft,
      openPricing,
      closePricing,
      savePin,
      deletePin,
      addCriterion,
      removeCriterion,
      ratePin,
      locateMe,
      toggleLive,
      sharePin,
      shareLive,
      dismissToast,
      pinScore,
      pinAverage,
    ],
  );

  return <GlobeContext.Provider value={value}>{children}</GlobeContext.Provider>;
}

export function useGlobe() {
  const context = useContext(GlobeContext);
  if (!context) throw new Error("useGlobe must be used within GlobeProvider");
  return context;
}
