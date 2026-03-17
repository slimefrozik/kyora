const CONFIG = {
  serverIp: "kyora.20tps.ru",
  minecraftVersion: "1.21.10",
  platform: "Java",
  discordUrl: "https://discord.gg/qVBGNTvapj",
  telegramUrl: "https://t.me/tikhomir_cherniltsev_bot",
  feedbackUrl: "https://t.me/slimefrozik"
};

const PAGE = document.body.dataset.page || "index";
const STORAGE_LANG_KEY = "Kyora_lang";
const STORAGE_THEME_KEY = "Kyora_theme";
const STORAGE_APPLY_DRAFT_KEY = "Kyora_apply_draft_v1";
const STORAGE_CHALLENGE_STREAK_KEY = "Kyora_challenge_streak_v1";
const SUPPORTED_LANGS = ["ru", "ua", "be", "kk"];
const EMBEDDED_DATA_PATH = "data/content.js";
const TELEGRAM_DELIVERY = window.Kyora_TELEGRAM || {};
const LANG_QUERY_PARAM = "lang";
const THEME_COLORS = {
  light: "#f7d9bb",
  dark: "#0f131a"
};
let embeddedDataPromise = null;
let edgePlayers = [];
let edgeResizeTimer = null;
let heroGalleryReady = false;

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage access errors (private mode / blocked storage).
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    // Ignore storage access errors.
  }
}

const state = {
  lang: "ru",
  i18n: { ru: {}, ua: {}, be: {}, kk: {} },
  mods: [],
  updates: [],
  plugins: [],
  challenges: []
};

function deepGet(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined), obj);
}

function t(key, fallback = "") {
  const value = deepGet(state.i18n[state.lang] || {}, key);
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  return fallback;
}

function getLocalizedField(item, baseField) {
  const suffix = state.lang === "ua" ? "Ua" : state.lang === "be" ? "Be" : state.lang === "kk" ? "Kk" : "";
  if (suffix) {
    const localizedField = `${baseField}${suffix}`;
    if (typeof item?.[localizedField] === "string" && item[localizedField].trim()) {
      return item[localizedField];
    }
  }
  return item?.[baseField] || "";
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  return response.json();
}

function getEmbeddedData() {
  if (window.Kyora_DATA && typeof window.Kyora_DATA === "object") {
    return window.Kyora_DATA;
  }
  return null;
}

async function loadEmbeddedData() {
  const existing = getEmbeddedData();
  if (existing) {
    return existing;
  }

  if (embeddedDataPromise) {
    return embeddedDataPromise;
  }

  embeddedDataPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EMBEDDED_DATA_PATH;
    script.async = true;
    script.onload = () => {
      const data = getEmbeddedData();
      if (data) {
        resolve(data);
        return;
      }
      reject(new Error("Embedded data is empty"));
    };
    script.onerror = () => {
      reject(new Error("Failed to load embedded data"));
    };
    document.head.append(script);
  });

  return embeddedDataPromise;
}

async function loadJsonWithEmbeddedFallback(path, pickFromEmbedded) {
  try {
    return await loadJson(path);
  } catch (error) {
    const embedded = await loadEmbeddedData();
    const fallback = pickFromEmbedded(embedded || {});
    if (fallback !== undefined && fallback !== null) {
      return fallback;
    }
    throw error;
  }
}

function showToast(message, durationMs = 2600) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => {
    toast.classList.remove("show");
  }, durationMs);
}

function sanitize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function getEdgeParticleCount() {
  return Math.max(10, Math.ceil(window.innerHeight / 90));
}

function buildEdgeParticle(name, containerWidth) {
  const particle = document.createElement("div");
  particle.className = "edge-particle";
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
  img.onerror = () => {
    particle.classList.add("edge-particle--fallback");
  };
  particle.append(img);

  const size = 40 + Math.random() * 18;
  const width = Math.max(80, containerWidth || 116);
  const x = Math.max(0, Math.random() * (width - size));
  const duration = 18 + Math.random() * 18;
  const delay = Math.random() * duration;
  const alpha = 0.45 + Math.random() * 0.35;
  const scale = 0.9 + Math.random() * 0.25;

  particle.style.setProperty("--size", `${size.toFixed(0)}px`);
  particle.style.setProperty("--x", `${x.toFixed(0)}px`);
  particle.style.setProperty("--dur", `${duration.toFixed(2)}s`);
  particle.style.setProperty("--delay", `-${delay.toFixed(2)}s`);
  particle.style.setProperty("--alpha", alpha.toFixed(2));
  particle.style.setProperty("--scale", scale.toFixed(2));
  return particle;
}

function renderEdgeParticles(names) {
  const streams = Array.from(document.querySelectorAll("[data-edge-stream]"));
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  const hasPlayers = list.length > 0;

  streams.forEach((stream) => {
    stream.textContent = "";
    stream.classList.toggle("is-empty", !hasPlayers);
    if (!hasPlayers) {
      return;
    }
    const count = getEdgeParticleCount();
    const width = stream.clientWidth;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const name = list[Math.floor(Math.random() * list.length)];
      fragment.append(buildEdgeParticle(name, width));
    }
    stream.append(fragment);
  });
}

function setupEdgeStreams() {
  renderEdgeParticles(edgePlayers);
  window.addEventListener("resize", () => {
    window.clearTimeout(edgeResizeTimer);
    edgeResizeTimer = window.setTimeout(() => {
      renderEdgeParticles(edgePlayers);
    }, 180);
  });
}

function updatePlayerEdgeStream(names) {
  edgePlayers = Array.isArray(names) ? names.filter(Boolean) : [];
  renderEdgeParticles(edgePlayers);
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function setupHeroGalleryMarquee() {
  if (heroGalleryReady) {
    return;
  }
  const ring = document.querySelector(".hero-gallery-bg .gallery-ring");
  if (!ring) {
    return;
  }
  const sources = Array.from(ring.querySelectorAll("img"))
    .map((img) => img.getAttribute("src"))
    .filter(Boolean);
  if (!sources.length) {
    return;
  }

  const order = shuffle(sources);
  ring.textContent = "";
  const fragment = document.createDocumentFragment();
  const buildImg = (src) => {
    const img = document.createElement("img");
    img.className = "gallery-orbit";
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  };

  order.forEach((src) => fragment.append(buildImg(src)));
  order.forEach((src) => fragment.append(buildImg(src)));
  ring.append(fragment);
  heroGalleryReady = true;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function setCoreFields() {
  document.querySelectorAll("[data-server-ip]").forEach((node) => {
    node.textContent = CONFIG.serverIp;
  });

  document.querySelectorAll("[data-server-version]").forEach((node) => {
    node.textContent = CONFIG.minecraftVersion;
  });

  document.querySelectorAll("[data-server-platform]").forEach((node) => {
    node.textContent = CONFIG.platform;
  });

  document.querySelectorAll("[data-discord-link]").forEach((node) => {
    node.setAttribute("href", "#");
    node.addEventListener("click", (event) => {
      event.preventDefault();
      showToast(t("common.discordSoonToast", "Discord скоро будет доступен."));
    });
  });

  document.querySelectorAll("[data-telegram-link]").forEach((node) => {
    node.setAttribute("href", CONFIG.telegramUrl);
  });

  document.querySelectorAll("[data-feedback-link]").forEach((node) => {
    node.setAttribute("href", CONFIG.feedbackUrl);
  });

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
}

function getStoredTheme() {
  const saved = safeStorageGet(STORAGE_THEME_KEY);
  return saved === "dark" || saved === "light" ? saved : "";
}

function updateThemeMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light);
  }
}

function updateThemeToggleText(theme) {
  const key = theme === "dark" ? "common.themeDark" : "common.themeLight";
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = t(key, button.textContent);
    button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  });
}

function applyTheme(theme, options = {}) {
  const { persist = true } = options;
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  if (persist) {
    safeStorageSet(STORAGE_THEME_KEY, next);
  }
  updateThemeMeta(next);
  updateThemeToggleText(next);
}

function setupThemeToggle() {
  const saved = getStoredTheme();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");
  applyTheme(initial, { persist: Boolean(saved) });

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });

  document.addEventListener("Kyora:language-changed", () => {
    const current = document.documentElement.dataset.theme || "light";
    updateThemeToggleText(current);
  });
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function translateStaticText() {
  const htmlLang = state.lang === "ua" ? "uk" : state.lang === "be" ? "be" : state.lang === "kk" ? "kk" : "ru";
  document.documentElement.lang = htmlLang;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key, node.textContent);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    node.setAttribute("placeholder", t(key, node.getAttribute("placeholder") || ""));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const key = node.getAttribute("data-i18n-title");
    node.setAttribute("title", t(key, node.getAttribute("title") || ""));
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    node.setAttribute("aria-label", t(key, node.getAttribute("aria-label") || ""));
  });

  document.querySelectorAll("[data-lang-switch]").forEach((button) => {
    button.classList.toggle("active", button.dataset.langSwitch === state.lang);
  });
}

function getLangFromUrl() {
  try {
    const value = new URL(window.location.href).searchParams.get(LANG_QUERY_PARAM);
    return SUPPORTED_LANGS.includes(value) ? value : "";
  } catch (_) {
    return "";
  }
}

function updateLanguageAwareLinks() {
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) {
      return;
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawHref, window.location.href);
    } catch (_) {
      return;
    }

    if (!/\.html$/i.test(targetUrl.pathname)) {
      return;
    }

    const isSameOrigin = window.location.protocol === "file:" || targetUrl.origin === window.location.origin;
    if (!isSameOrigin) {
      return;
    }

    targetUrl.searchParams.set(LANG_QUERY_PARAM, state.lang);
    let next = targetUrl.pathname + targetUrl.search;
    if (targetUrl.hash) {
      next += targetUrl.hash;
    }

    if (window.location.protocol === "file:") {
      const fileName = targetUrl.pathname.split("/").pop();
      next = fileName + targetUrl.search + targetUrl.hash;
    }

    anchor.setAttribute("href", next);
  });
}

function setLanguage(language, options = {}) {
  const { syncUrl = true } = options;
  state.lang = SUPPORTED_LANGS.includes(language) ? language : "ru";
  safeStorageSet(STORAGE_LANG_KEY, state.lang);
  if (syncUrl) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(LANG_QUERY_PARAM, state.lang);
      window.history.replaceState(null, "", url);
    } catch (_) {
      // Ignore URL rewrite failures in restricted contexts.
    }
  }
  updateLanguageAwareLinks();
  translateStaticText();
  renderPageDynamic();
  document.dispatchEvent(new CustomEvent("Kyora:language-changed"));
}

function setupLanguageSwitch() {
  const fromUrl = getLangFromUrl();
  const savedLang = safeStorageGet(STORAGE_LANG_KEY);
    state.lang = fromUrl || (savedLang && SUPPORTED_LANGS.includes(savedLang) ? savedLang : "ru");

  document.querySelectorAll("[data-lang-switch]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langSwitch || "ru", { syncUrl: true }));
  });

  setLanguage(state.lang, { syncUrl: true });
}

function setupLanguageMenu() {
  const menus = document.querySelectorAll("[data-lang-menu]");
  if (!menus.length) {
    return;
  }

  menus.forEach((menu) => {
    const toggle = menu.querySelector("[data-lang-toggle]");
    if (!toggle) {
      return;
    }

    const close = () => {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    const sync = () => {
      const open = menu.classList.contains("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("is-open");
      sync();
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target)) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
    });

    document.addEventListener("Kyora:language-changed", close);

    sync();
  });
}


function setupCopyIp() {
  document.querySelectorAll("[data-copy-ip]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await copyText(CONFIG.serverIp);
        showToast(t("common.toastIpCopied", "IP copied"));
      } catch (_) {
        showToast(`${t("common.toastIpFailed", "Copy failed")} ${CONFIG.serverIp}`);
      }
    });
  });
}

function setupReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((node) => node.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  nodes.forEach((node) => observer.observe(node));
}

function setupGolemBackground() {
  if (document.querySelector("[data-golem]")) {
    return;
  }

  const left = document.createElement("div");
  left.className = "golem-bg golem-left";
  left.setAttribute("aria-hidden", "true");
  left.dataset.golem = "left";

  const right = document.createElement("div");
  right.className = "golem-bg golem-right";
  right.setAttribute("aria-hidden", "true");
  right.dataset.golem = "right";

  document.body.prepend(right);
  document.body.prepend(left);
}

async function fetchServerStatus() {
  const statusNode = document.getElementById("server-status");
  const statusCard = document.querySelector("[data-status-card]");
  const statusPill = document.querySelector("[data-status-pill]");
  const statusPlayers = document.querySelector("[data-status-players]");
  const statusVersion = document.querySelector("[data-status-version]");
  const statusLatency = document.querySelector("[data-status-latency]");
  const statusMotd = document.querySelector("[data-status-motd]");

  if (!statusNode && !statusCard && !statusPill && !statusPlayers && !statusVersion && !statusLatency && !statusMotd) {
    return;
  }

  const setText = (node, value) => {
    if (node) {
      node.textContent = value;
    }
  };

  const setCardState = (state) => {
    if (!statusCard) {
      return;
    }
    statusCard.classList.toggle("is-online", state === "online");
    statusCard.classList.toggle("is-offline", state === "offline");
    statusCard.classList.toggle("is-unknown", state === "unknown");
  };

  setText(statusNode, t("common.statusLoading", "Проверяем статус..."));
  setText(statusPill, t("common.statusLoading", "Проверяем статус..."));
  setText(statusPlayers, "—");
  setText(statusVersion, CONFIG.minecraftVersion);
  setText(statusLatency, "—");
  setText(statusMotd, t("common.statusLoading", "Проверяем статус..."));
  setCardState("unknown");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  const startedAt = performance.now();

  try {
    const response = await fetch(`https://api.mcsrvstat.us/2/${encodeURIComponent(CONFIG.serverIp)}`, {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = await response.json();
    const online = Number(data?.players?.online);
    const max = Number(data?.players?.max);
    const latency = Math.max(0, Math.round(performance.now() - startedAt));
    const motdRaw = Array.isArray(data?.motd?.clean)
      ? data.motd.clean.join(" ").replace(/\s+/g, " ").trim()
      : "";
    const motd = decodeHtmlEntities(motdRaw);
    const version = typeof data?.version === "string" && data.version.trim()
      ? data.version.trim()
      : CONFIG.minecraftVersion;

    const rawList = Array.isArray(data?.players?.list) ? data.players.list : Array.isArray(data?.players?.sample) ? data.players.sample : [];
    const playersList = rawList.map((entry) => (typeof entry === "string" ? entry : entry?.name)).filter(Boolean);

    if (data?.online === true && Number.isFinite(online) && Number.isFinite(max)) {
      const statusText = `${t("common.statusOnline", "Онлайн")}: ${online}/${max}`;
      setText(statusNode, statusText);
      setText(statusPill, t("common.statusOnline", "Онлайн"));
      setText(statusPlayers, `${online}/${max}`);
      setText(statusVersion, version);
      setText(statusLatency, `${latency} ms`);
      setText(statusMotd, motd || t("common.statusOnline", "Онлайн"));
      setCardState("online");
      updatePlayerEdgeStream(playersList);
      return;
    }

    setText(statusNode, t("common.statusOffline", "Оффлайн"));
    setText(statusPill, t("common.statusOffline", "Оффлайн"));
    setText(statusMotd, t("common.statusOffline", "Оффлайн"));
    setCardState("offline");
    updatePlayerEdgeStream([]);
  } catch (_) {
    setText(statusNode, t("common.statusUnknown", "Статус недоступен"));
    setText(statusPill, t("common.statusUnknown", "Статус недоступен"));
    setText(statusMotd, t("common.statusUnknown", "Статус недоступен"));
    setCardState("unknown");
    updatePlayerEdgeStream([]);
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractTelegramUsername(link) {
  try {
    const url = new URL(link);
    if (url.hostname !== "t.me" && url.hostname !== "www.t.me") {
      return "";
    }
    return url.pathname.replace(/^\/+/, "").split("/")[0].trim();
  } catch (_) {
    return "";
  }
}


function setupFeedbackButton() {
  if (!document.body) {
    return;
  }

  const link = document.createElement("a");
  link.className = "feedback-fab";
  link.href = CONFIG.feedbackUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const syncText = () => {
    link.textContent = t("common.feedback", "Ideas and bug reports");
    link.setAttribute("aria-label", t("common.feedbackAria", "Open Telegram for feedback and bug reports"));
    link.title = t("common.feedbackAria", "Open Telegram for feedback and bug reports");
  };

  document.body.append(link);
  document.addEventListener("Kyora:language-changed", syncText);
  syncText();
}

function setupGalleryLightbox() {
  const figures = Array.from(document.querySelectorAll("[data-lightbox-src]"));
  if (!figures.length) {
    return;
  }

  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Gallery preview");

  const image = document.createElement("img");
  image.alt = "";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";

  const syncLightboxText = () => {
    close.setAttribute("aria-label", t("common.close", "Закрыть"));
  };

  const open = (src, alt) => {
    image.src = src;
    image.alt = alt || "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    lightbox.classList.remove("open");
    image.removeAttribute("src");
    document.body.style.overflow = "";
  };

  close.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("open")) {
      closeLightbox();
    }
  });
  document.addEventListener("Kyora:language-changed", syncLightboxText);

  figures.forEach((figure) => {
    figure.addEventListener("click", () => {
      const src = figure.getAttribute("data-lightbox-src");
      const alt = figure.getAttribute("data-lightbox-alt") || "";
      if (src) {
        open(src, alt);
      }
    });
  });

  lightbox.append(close, image);
  document.body.append(lightbox);
  syncLightboxText();
}

function setupApplicationForm() {
  const form = document.getElementById("apply-form");
  const sendTelegramBtn = document.getElementById("send-telegram");
  const errorNode = document.getElementById("apply-error");
  const discordBtn = document.getElementById("go-discord");
  const previewNode = document.getElementById("apply-preview");
  const fields = {
    nick: document.getElementById("apply-nick"),
    age: document.getElementById("apply-age"),
    role: document.getElementById("apply-role"),
    why: document.getElementById("apply-why")
  };

  if (!form || !sendTelegramBtn) {
    return;
  }

  if (discordBtn) {
    discordBtn.setAttribute("href", CONFIG.discordUrl);
  }

  const getDraft = () => ({
    nick: sanitize(fields.nick?.value),
    age: sanitize(fields.age?.value),
    role: sanitize(fields.role?.value),
    why: sanitize(fields.why?.value)
  });

  const saveDraft = () => {
    safeStorageSet(STORAGE_APPLY_DRAFT_KEY, JSON.stringify(getDraft()));
  };

  const restoreDraft = () => {
    try {
      const raw = safeStorageGet(STORAGE_APPLY_DRAFT_KEY);
      if (!raw) {
        return;
      }
      const draft = JSON.parse(raw);
      if (fields.nick && typeof draft.nick === "string") fields.nick.value = draft.nick;
      if (fields.age && typeof draft.age === "string") fields.age.value = draft.age;
      if (fields.role && typeof draft.role === "string") fields.role.value = draft.role;
      if (fields.why && typeof draft.why === "string") fields.why.value = draft.why;
    } catch (_) {
      // Ignore malformed local draft.
    }
  };

  const buildMessage = () => {
    const draft = getDraft();
    const lines = [
      t("apply.messageTitle", "ЗАЯВКА В Kyora"),
      "",
      `${t("apply.fieldNick", "Ник")}: ${draft.nick || "-"}`,
      `${t("apply.fieldAge", "Возраст")}: ${draft.age || "-"}`,
      `${t("apply.fieldRole", "Опыт/роль")}: ${draft.role || "-"}`
    ];
    if (draft.why) {
      lines.push(`${t("apply.fieldWhy", "Секреты")}: ${draft.why}`);
    }
    return lines.join("\n");
  };

  const updatePreview = () => {
    if (!previewNode) {
      return;
    }
    previewNode.value = buildMessage();
  };

  const telegramUsername = extractTelegramUsername(CONFIG.telegramUrl);

  const openTelegramWithMessage = (message) => {
    if (!telegramUsername) {
      showToast(t("apply.toastNoTelegram", "Не удалось определить Telegram-бота."));
      return false;
    }

    const botUrl = new URL(`https://t.me/${telegramUsername}`);
    botUrl.searchParams.set("text", message);

    const win = window.open(botUrl.toString(), "_blank", "noopener,noreferrer");
    if (!win) {
      showToast(t("apply.toastPopupBlocked", "Браузер заблокировал новое окно."));
      return false;
    }
    return true;
  };

  const sendViaBotApi = async (message) => {
    const botToken = sanitize(TELEGRAM_DELIVERY.botToken);
    const chatId = sanitize(TELEGRAM_DELIVERY.chatId);
    const threadIdRaw = sanitize(TELEGRAM_DELIVERY.messageThreadId);
    const threadId = Number(threadIdRaw);

    if (!botToken || !chatId) {
      return false;
    }

    const body = {
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    };

    if (Number.isInteger(threadId) && threadId > 0) {
      body.message_thread_id = threadId;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Telegram API ${response.status}`);
    }

    const data = await response.json();
    return Boolean(data?.ok);
  };

  const submitToTelegram = async () => {
    if (!form.reportValidity()) {
      if (errorNode) {
        errorNode.textContent = t("apply.errorInvalid", "Проверьте форму.");
      }
      return;
    }

    const nickname = sanitize(fields.nick?.value);
    const ageRaw = sanitize(fields.age?.value);
    const role = sanitize(fields.role?.value);
    const why = sanitize(fields.why?.value);

    const age = Number(ageRaw);
    if (!Number.isInteger(age) || age < 10 || age > 99) {
      if (errorNode) {
        errorNode.textContent = t("apply.errorAge", "Возраст от 10 до 99");
      }
      return;
    }

    if (errorNode) {
      errorNode.textContent = "";
    }

    const messageLines = [
      t("apply.messageTitle", "ЗАЯВКА В Kyora"),
      "",
      `${t("apply.fieldNick", "Ник")}: ${nickname}`,
      `${t("apply.fieldAge", "Возраст")}: ${age}`,
      `${t("apply.fieldRole", "Опыт/роль")}: ${role}`
    ];
    if (why) {
      messageLines.push(`${t("apply.fieldWhy", "Секреты")}: ${why}`);
    }

    const message = messageLines.join("\n");

    updatePreview();
    saveDraft();

    try {
      const sentDirectly = await sendViaBotApi(message);
      if (sentDirectly) {
        showToast(t("apply.toastSentDirect", "Заявка отправлена боту автоматически."));
        safeStorageRemove(STORAGE_APPLY_DRAFT_KEY);
        return;
      }
    } catch (_) {
      showToast(t("apply.toastDirectFailed", "Не удалось отправить напрямую. Открою Telegram с текстом."));
    }

    try {
      await copyText(message);
      showToast(t("apply.toastCopied", "Текст заявки скопирован. Telegram откроется с готовым сообщением."));
    } catch (_) {
      showToast(t("apply.toastCopyFailed", "Не удалось скопировать текст заявки."));
    }

    openTelegramWithMessage(message);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitToTelegram();
  });

  sendTelegramBtn.addEventListener("click", submitToTelegram);

  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.addEventListener("input", () => {
      saveDraft();
      updatePreview();
    });
  });

  document.addEventListener("Kyora:language-changed", updatePreview);

  restoreDraft();
  updatePreview();
}

function renderModsPage() {
  const list = document.getElementById("mods-list");
  const search = document.getElementById("mods-search");
  const category = document.getElementById("mods-category");

  if (!list || !search || !category) {
    return;
  }

  const categories = Array.from(new Set(state.mods.map((item) => getLocalizedField(item, "category")).filter(Boolean)));

  category.textContent = "";
  const optionAll = document.createElement("option");
  optionAll.value = "all";
  optionAll.textContent = t("mods.filterAll", "Все категории");
  category.append(optionAll);

  categories.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    category.append(option);
  });

  const render = () => {
    const query = sanitize(search.value).toLowerCase();
    const selected = category.value;

    const filtered = state.mods.filter((item) => {
      const localizedCategory = getLocalizedField(item, "category");
      const haystack = [
        item.name,
        item.summary,
        item.summaryUa || "",
        item.tags.join(" "),
        item.tagsUa?.join(" ") || ""
      ].join(" ").toLowerCase();

      const categoryMatch = selected === "all" || localizedCategory === selected;
      const queryMatch = !query || haystack.includes(query);
      return categoryMatch && queryMatch;
    });

    list.textContent = "";

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = t("mods.empty", "Ничего не найдено.");
      list.append(empty);
      return;
    }

    filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card reveal";

      const title = document.createElement("h3");
      title.textContent = item.name;

      const summary = document.createElement("p");
      summary.textContent = getLocalizedField(item, "summary");

      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = getLocalizedField(item, "category");

      const tags = document.createElement("div");
      tags.className = "tag-row";
      const localizedTags = state.lang === "ua" && Array.isArray(item.tagsUa) && item.tagsUa.length ? item.tagsUa : item.tags;
      localizedTags.forEach((tagValue) => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = tagValue;
        tags.append(badge);
      });

      const link = document.createElement("a");
      link.href = item.modrinthUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "link-btn";
      link.textContent = t("mods.openModrinth", "Открыть на Modrinth");

      card.append(title, meta, summary, tags, link);
      list.append(card);
    });

    setupReveal();
  };

  if (!search.dataset.bound) {
    search.addEventListener("input", render);
    category.addEventListener("change", render);
    search.dataset.bound = "1";
  }

  render();
}

function renderUpdatesPage() {
  const list = document.getElementById("updates-list");
  if (!list) {
    return;
  }

  const locale = state.lang === "ua" ? "uk-UA" : "ru-RU";
  const sorted = [...state.updates].sort((a, b) => new Date(b.date) - new Date(a.date));

  list.textContent = "";

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = t("updates.empty", "Обновлений пока нет.");
    list.append(empty);
    return;
  }

  sorted.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card reveal";

    const date = document.createElement("p");
    date.className = "meta";
    const formatDate = new Date(item.date);
    date.textContent = Number.isNaN(formatDate.getTime())
      ? item.date
      : formatDate.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

    const title = document.createElement("h3");
    title.textContent = getLocalizedField(item, "title");

    const summary = document.createElement("p");
    summary.textContent = getLocalizedField(item, "summary");

    const impact = document.createElement("p");
    impact.className = "meta";
    impact.textContent = `${t("updates.impact", "Влияние")}: ${getLocalizedField(item, "impact")}`;

    card.append(date, title, summary, impact);
    list.append(card);
  });

  setupReveal();
}

function renderChallengesPage() {
  const difficulty = document.getElementById("challenge-difficulty");
  const generateBtn = document.getElementById("challenge-generate");
  const copyBtn = document.getElementById("challenge-copy");
  const completeBtn = document.getElementById("challenge-complete");
  const textNode = document.getElementById("challenge-text");
  const metaNode = document.getElementById("challenge-meta");
  const noteNode = document.getElementById("challenge-note");
  const streakNode = document.getElementById("challenge-streak");

  if (!difficulty || !generateBtn || !copyBtn || !completeBtn || !textNode || !metaNode) {
    return;
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const challengeKey = (item) => `${item.action}|${item.constraint}|${item.context}|${item.difficulty}`;
  let lastChallengeKey = "";
  let lastChallenge = null;
  let streak = Number(safeStorageGet(STORAGE_CHALLENGE_STREAK_KEY) || "0");

  const getChallengeText = (item) => {
    const parts = [
      getLocalizedField(item, "action"),
      getLocalizedField(item, "constraint"),
      getLocalizedField(item, "context")
    ].map(sanitize).filter(Boolean);
    return parts.length ? `${parts.join(". ")}.` : "";
  };

  const setDifficultyBadge = (challenge) => {
    const difficultyValue = challenge?.difficulty || "medium";
    const difficultyLabel = t(`challenges.level.${difficultyValue}`, difficultyValue);
    metaNode.className = "meta challenge-badge";
    metaNode.classList.remove("is-easy", "is-medium", "is-hard");
    if (difficultyValue === "easy" || difficultyValue === "medium" || difficultyValue === "hard") {
      metaNode.classList.add(`is-${difficultyValue}`);
    }
    metaNode.textContent = `${t("challenges.metaLabel", "Сложность")}: ${difficultyLabel}`;
  };

  const makeChallenge = () => {
    const selected = difficulty.value;
    const source = selected === "all"
      ? state.challenges
      : state.challenges.filter((item) => item.difficulty === selected);

    const pool = source.length ? source : state.challenges;
    if (!pool.length) {
      textNode.textContent = t("challenges.empty", "Челленджи недоступны.");
      metaNode.className = "meta";
      metaNode.textContent = "";
      if (noteNode) {
        noteNode.textContent = "";
      }
      lastChallenge = null;
      lastChallengeKey = "";
      return;
    }

    let candidates = pool;
    if (pool.length > 1 && lastChallengeKey) {
      candidates = pool.filter((item) => challengeKey(item) !== lastChallengeKey);
      if (!candidates.length) {
        candidates = pool;
      }
    }

    const challenge = randomItem(candidates);
    lastChallenge = challenge;
    lastChallengeKey = challengeKey(challenge);
    textNode.textContent = getChallengeText(challenge);
    setDifficultyBadge(challenge);
    if (noteNode) {
      noteNode.textContent = t("challenges.note", "Можно нажать «Следующий», если задача не подходит.");
    }
    if (streakNode) {
      streakNode.textContent = t("challenges.streak", `Series: ${streak}`).replace("{count}", String(streak));
    }
  };

  const copyChallenge = async () => {
    if (!lastChallenge || !textNode.textContent.trim()) {
      return;
    }

    const payload = `${textNode.textContent}\n${metaNode.textContent}`.trim();
    try {
      await copyText(payload);
      showToast(t("challenges.copied", "Челлендж скопирован"));
    } catch (_) {
      showToast(t("challenges.copyFailed", "Не удалось скопировать челлендж"));
    }
  };

  const markCompleted = () => {
    if (!lastChallenge) {
      return;
    }
    streak += 1;
    safeStorageSet(STORAGE_CHALLENGE_STREAK_KEY, String(streak));
    if (streakNode) {
      streakNode.textContent = t("challenges.streak", `Series: ${streak}`).replace("{count}", String(streak));
    }
    showToast(t("challenges.completeToast", "Progress updated"));
  };

  generateBtn.onclick = makeChallenge;
  copyBtn.onclick = copyChallenge;
  completeBtn.onclick = markCompleted;
  difficulty.onchange = makeChallenge;

  makeChallenge();
}

function renderPluginsPage() {
  const tableBody = document.getElementById("plugins-body");
  const search = document.getElementById("plugins-search");
  const category = document.getElementById("plugins-category");
  const count = document.getElementById("plugins-count");

  if (!tableBody || !search || !category || !count) {
    return;
  }

  const categories = Array.from(new Set(state.plugins.map((item) => getLocalizedField(item, "category")).filter(Boolean)));

  category.textContent = "";
  const optionAll = document.createElement("option");
  optionAll.value = "all";
  optionAll.textContent = t("plugins.filterAll", "Все категории");
  category.append(optionAll);

  categories.forEach((categoryName) => {
    const option = document.createElement("option");
    option.value = categoryName;
    option.textContent = categoryName;
    category.append(option);
  });

  const locale = state.lang === "ua" ? "uk-UA" : "ru-RU";

  const render = () => {
    const query = sanitize(search.value).toLowerCase();
    const selected = category.value;

    const filtered = state.plugins
      .filter((item) => {
        const localizedCategory = getLocalizedField(item, "category");
        const categoryMatch = selected === "all" || localizedCategory === selected;
        const haystack = [
          item.name,
          item.jar,
          item.description,
          item.descriptionUa || "",
          localizedCategory
        ].join(" ").toLowerCase();
        const queryMatch = !query || haystack.includes(query);
        return categoryMatch && queryMatch;
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.updatedAt) - new Date(a.updatedAt);
        if (!Number.isNaN(dateDiff) && dateDiff !== 0) {
          return dateDiff;
        }
        return a.name.localeCompare(b.name, "ru");
      });

    count.textContent = String(filtered.length);
    tableBody.textContent = "";

    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "empty-state";
      cell.textContent = t("plugins.empty", "Плагины не найдены.");
      row.append(cell);
      tableBody.append(row);
      return;
    }

    filtered.forEach((item) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = item.name;

      const categoryCell = document.createElement("td");
      categoryCell.textContent = getLocalizedField(item, "category");

      const jarCell = document.createElement("td");
      jarCell.textContent = item.jar;

      const descCell = document.createElement("td");
      descCell.textContent = getLocalizedField(item, "description");

      const dateCell = document.createElement("td");
      const date = new Date(item.updatedAt);
      dateCell.textContent = Number.isNaN(date.getTime())
        ? item.updatedAt
        : date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

      row.append(nameCell, categoryCell, jarCell, descCell, dateCell);
      tableBody.append(row);
    });
  };

  if (!search.dataset.bound) {
    search.addEventListener("input", render);
    category.addEventListener("change", render);
    search.dataset.bound = "1";
  }

  render();
}

function renderPageDynamic() {
  if (PAGE === "index") {
    fetchServerStatus();
  }

  if (PAGE === "mods") {
    renderModsPage();
  }

  if (PAGE === "updates") {
    renderUpdatesPage();
  }

  if (PAGE === "challenges") {
    renderChallengesPage();
  }

  if (PAGE === "plugins") {
    renderPluginsPage();
  }
}

async function loadDataForPage() {
  const pickEmbeddedList = (embedded, key) => {
    const direct = embedded?.[key];
    if (Array.isArray(direct)) {
      return direct;
    }
    if (direct && Array.isArray(direct[key])) {
      return direct[key];
    }
    return undefined;
  };

  const i18nData = await loadJsonWithEmbeddedFallback("data/i18n.json", (embedded) => embedded.i18n);
  if (i18nData && typeof i18nData === "object") {
    state.i18n = i18nData;
  }

  if (PAGE === "mods") {
    const modsData = await loadJsonWithEmbeddedFallback("data/mods.json", (embedded) => pickEmbeddedList(embedded, "mods"));
    state.mods = Array.isArray(modsData) ? modsData : (Array.isArray(modsData?.mods) ? modsData.mods : []);
  }

  if (PAGE === "updates") {
    const updatesData = await loadJsonWithEmbeddedFallback("data/updates.json", (embedded) => pickEmbeddedList(embedded, "updates"));
    state.updates = Array.isArray(updatesData) ? updatesData : (Array.isArray(updatesData?.updates) ? updatesData.updates : []);
  }

  if (PAGE === "plugins") {
    const pluginsData = await loadJsonWithEmbeddedFallback("data/plugins.json", (embedded) => pickEmbeddedList(embedded, "plugins"));
    state.plugins = Array.isArray(pluginsData) ? pluginsData : (Array.isArray(pluginsData?.plugins) ? pluginsData.plugins : []);
  }

  if (PAGE === "challenges") {
    const challengesData = await loadJsonWithEmbeddedFallback("data/challenges.json", (embedded) => pickEmbeddedList(embedded, "challenges"));
    state.challenges = Array.isArray(challengesData) ? challengesData : (Array.isArray(challengesData?.challenges) ? challengesData.challenges : []);
  }
}

async function init() {
  document.documentElement.classList.add("js-enabled");
  setupGolemBackground();
  setupThemeToggle();
  setupServiceWorker();
  setupCopyIp();
  setupFeedbackButton();
  setupGalleryLightbox();
  setupEdgeStreams();
  if (PAGE === "index") {
    setupHeroGalleryMarquee();
  }
  setCoreFields();
  setupReveal();
  setupApplicationForm();

  try {
    await loadDataForPage();
  } catch (error) {
    showToast(`Data loading error: ${error.message}`);
  }

  setupLanguageMenu();
  setupLanguageSwitch();
  renderPageDynamic();
}

document.addEventListener("DOMContentLoaded", init);


