const CONFIG = {
  serverIp: "rusland5.20tps.ru",
  minecraftVersion: "1.21.10",
  platform: "Java",
  discordUrl: "https://discord.gg/qVBGNTvapj",
  telegramUrl: "https://t.me/tikhomir_cherniltsev_bot",
  feedbackUrl: "https://t.me/slimefrozik"
};

const PAGE = document.body.dataset.page || "index";
const STORAGE_LANG_KEY = "rusland_lang";
const STORAGE_APPLY_DRAFT_KEY = "rusland_apply_draft_v1";
const STORAGE_MUSIC_KEY = "rusland_music_enabled";
const STORAGE_CHALLENGE_STREAK_KEY = "rusland_challenge_streak_v1";
const SUPPORTED_LANGS = ["ru", "ua"];
const EMBEDDED_DATA_PATH = "data/content.js";
const TELEGRAM_DELIVERY = window.RUSLAND_TELEGRAM || {};
const LANG_QUERY_PARAM = "lang";
let embeddedDataPromise = null;

const state = {
  lang: "ru",
  i18n: { ru: {}, ua: {} },
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
  if (state.lang === "ua") {
    const uaField = `${baseField}Ua`;
    if (typeof item?.[uaField] === "string" && item[uaField].trim()) {
      return item[uaField];
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
  if (window.RUSLAND_DATA && typeof window.RUSLAND_DATA === "object") {
    return window.RUSLAND_DATA;
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
    node.setAttribute("href", CONFIG.discordUrl);
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

function translateStaticText() {
  document.documentElement.lang = state.lang === "ua" ? "uk" : "ru";

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
  localStorage.setItem(STORAGE_LANG_KEY, state.lang);
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
  document.dispatchEvent(new CustomEvent("rusland:language-changed"));
}

function setupLanguageSwitch() {
  const fromUrl = getLangFromUrl();
  const savedLang = localStorage.getItem(STORAGE_LANG_KEY);
  const browserLang = navigator.language.toLowerCase();
  state.lang = fromUrl || (savedLang && SUPPORTED_LANGS.includes(savedLang) ? savedLang : (browserLang.startsWith("uk") ? "ua" : "ru"));

  document.querySelectorAll("[data-lang-switch]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langSwitch || "ru", { syncUrl: true }));
  });

  setLanguage(state.lang, { syncUrl: true });
}

function setupMobileMenu() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
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

async function fetchServerStatus() {
  const statusNode = document.getElementById("server-status");
  if (!statusNode) {
    return;
  }

  statusNode.textContent = t("common.statusLoading", "РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ...");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);

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

    if (data?.online === true && Number.isFinite(online) && Number.isFinite(max)) {
      statusNode.textContent = `${t("common.statusOnline", "РћРЅР»Р°Р№РЅ")}: ${online}/${max}`;
      return;
    }

    statusNode.textContent = t("common.statusOffline", "РћС„С„Р»Р°Р№РЅ");
  } catch (_) {
    statusNode.textContent = t("common.statusUnknown", "РЎС‚Р°С‚СѓСЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ");
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

function setupMusicPlayer() {
  if (!document.body) {
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "music-player";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "music-toggle";
  button.setAttribute("aria-live", "polite");
  button.textContent = "M";

  const label = document.createElement("span");
  label.className = "music-label";

  const audio = document.createElement("audio");
  audio.src = "music.mp3";
  audio.loop = true;
  audio.preload = "none";

  const syncVisual = () => {
    const on = !audio.paused;
    wrap.classList.toggle("is-playing", on);
    label.textContent = on ? t("common.musicOn", "РњСѓР·С‹РєР°: Р’РљР›") : t("common.musicOff", "РњСѓР·С‹РєР°: Р’Р«РљР›");
    button.setAttribute("aria-label", on ? t("common.musicPause", "Р’С‹РєР»СЋС‡РёС‚СЊ РјСѓР·С‹РєСѓ") : t("common.musicPlay", "Р’РєР»СЋС‡РёС‚СЊ РјСѓР·С‹РєСѓ"));
  };

  const persist = (enabled) => {
    try {
      localStorage.setItem(STORAGE_MUSIC_KEY, enabled ? "1" : "0");
    } catch (_) {
      // Ignore storage errors.
    }
  };

  button.addEventListener("click", async () => {
    if (audio.paused) {
      try {
        await audio.play();
        persist(true);
      } catch (_) {
        showToast(t("common.musicBlocked", "Р‘СЂР°СѓР·РµСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°Р» Р°РІС‚РѕР·Р°РїСѓСЃРє. РќР°Р¶РјРё РµС‰Рµ СЂР°Р·."));
      }
    } else {
      audio.pause();
      persist(false);
    }
    syncVisual();
  });

  wrap.append(button, label);
  document.body.append(wrap, audio);

  audio.addEventListener("play", syncVisual);
  audio.addEventListener("pause", syncVisual);
  document.addEventListener("rusland:language-changed", syncVisual);

  const shouldPlay = localStorage.getItem(STORAGE_MUSIC_KEY) === "1";
  if (shouldPlay) {
    const tryStart = async () => {
      try {
        await audio.play();
      } catch (_) {
        // Autoplay may be blocked until user gesture.
      }
      syncVisual();
    };
    window.addEventListener("pointerdown", tryStart, { once: true });
  }

  syncVisual();
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
  document.addEventListener("rusland:language-changed", syncText);
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
  close.textContent = "Г—";

  const syncLightboxText = () => {
    close.setAttribute("aria-label", t("common.close", "Р—Р°РєСЂС‹С‚СЊ"));
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
  document.addEventListener("rusland:language-changed", syncLightboxText);

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
    try {
      localStorage.setItem(STORAGE_APPLY_DRAFT_KEY, JSON.stringify(getDraft()));
    } catch (_) {
      // Ignore localStorage quota/availability issues.
    }
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_APPLY_DRAFT_KEY);
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
    return [
      t("apply.messageTitle", "Р—Р°СЏРІРєР° RusLand"),
      "",
      `${t("apply.fieldNick", "РќРёРє")}: ${draft.nick || "-"}`,
      `${t("apply.fieldAge", "Р’РѕР·СЂР°СЃС‚")}: ${draft.age || "-"}`,
      `${t("apply.fieldRole", "РћРїС‹С‚/СЂРѕР»СЊ")}: ${draft.role || "-"}`,
      `${t("apply.fieldWhy", "РџРѕС‡РµРјСѓ Рє РЅР°Рј")}: ${draft.why || "-"}`,
      `${t("apply.fieldVersion", "Р’РµСЂСЃРёСЏ")}: ${CONFIG.minecraftVersion} ${CONFIG.platform}`,
      `${t("apply.fieldServer", "РЎРµСЂРІРµСЂ")}: ${CONFIG.serverIp}`
    ].join("\n");
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
      showToast(t("apply.toastNoTelegram", "РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ Telegram-Р±РѕС‚Р°."));
      return false;
    }

    const botUrl = new URL(`https://t.me/${telegramUsername}`);
    botUrl.searchParams.set("text", message);

    const win = window.open(botUrl.toString(), "_blank", "noopener,noreferrer");
    if (!win) {
      showToast(t("apply.toastPopupBlocked", "Р‘СЂР°СѓР·РµСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°Р» РЅРѕРІРѕРµ РѕРєРЅРѕ."));
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
        errorNode.textContent = t("apply.errorInvalid", "РџСЂРѕРІРµСЂСЊС‚Рµ С„РѕСЂРјСѓ.");
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
        errorNode.textContent = t("apply.errorAge", "Р’РѕР·СЂР°СЃС‚ РѕС‚ 10 РґРѕ 99");
      }
      return;
    }

    if (errorNode) {
      errorNode.textContent = "";
    }

    const message = [
      t("apply.messageTitle", "Р—Р°СЏРІРєР° RusLand"),
      "",
      `${t("apply.fieldNick", "РќРёРє")}: ${nickname}`,
      `${t("apply.fieldAge", "Р’РѕР·СЂР°СЃС‚")}: ${age}`,
      `${t("apply.fieldRole", "РћРїС‹С‚/СЂРѕР»СЊ")}: ${role}`,
      `${t("apply.fieldWhy", "РџРѕС‡РµРјСѓ Рє РЅР°Рј")}: ${why}`,
      `${t("apply.fieldVersion", "Р’РµСЂСЃРёСЏ")}: ${CONFIG.minecraftVersion} ${CONFIG.platform}`,
      `${t("apply.fieldServer", "РЎРµСЂРІРµСЂ")}: ${CONFIG.serverIp}`
    ].join("\n");

    updatePreview();
    saveDraft();

    try {
      const sentDirectly = await sendViaBotApi(message);
      if (sentDirectly) {
        showToast(t("apply.toastSentDirect", "Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР° Р±РѕС‚Сѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё."));
        localStorage.removeItem(STORAGE_APPLY_DRAFT_KEY);
        return;
      }
    } catch (_) {
      showToast(t("apply.toastDirectFailed", "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РЅР°РїСЂСЏРјСѓСЋ. РћС‚РєСЂРѕСЋ Telegram СЃ С‚РµРєСЃС‚РѕРј."));
    }

    try {
      await copyText(message);
      showToast(t("apply.toastCopied", "РўРµРєСЃС‚ Р·Р°СЏРІРєРё СЃРєРѕРїРёСЂРѕРІР°РЅ. Telegram РѕС‚РєСЂРѕРµС‚СЃСЏ СЃ РіРѕС‚РѕРІС‹Рј СЃРѕРѕР±С‰РµРЅРёРµРј."));
    } catch (_) {
      showToast(t("apply.toastCopyFailed", "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ С‚РµРєСЃС‚ Р·Р°СЏРІРєРё."));
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

  document.addEventListener("rusland:language-changed", updatePreview);

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
  optionAll.textContent = t("mods.filterAll", "Р’СЃРµ РєР°С‚РµРіРѕСЂРёРё");
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
      empty.textContent = t("mods.empty", "РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ.");
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
      link.textContent = t("mods.openModrinth", "РћС‚РєСЂС‹С‚СЊ РЅР° Modrinth");

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
    empty.textContent = t("updates.empty", "РћР±РЅРѕРІР»РµРЅРёР№ РїРѕРєР° РЅРµС‚.");
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
    impact.textContent = `${t("updates.impact", "Р’Р»РёСЏРЅРёРµ")}: ${getLocalizedField(item, "impact")}`;

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
  let streak = Number(localStorage.getItem(STORAGE_CHALLENGE_STREAK_KEY) || "0");

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
    localStorage.setItem(STORAGE_CHALLENGE_STREAK_KEY, String(streak));
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
  optionAll.textContent = t("plugins.filterAll", "Р’СЃРµ РєР°С‚РµРіРѕСЂРёРё");
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
      cell.textContent = t("plugins.empty", "РџР»Р°РіРёРЅС‹ РЅРµ РЅР°Р№РґРµРЅС‹.");
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
  const i18nData = await loadJsonWithEmbeddedFallback("data/i18n.json", (embedded) => embedded.i18n);
  if (i18nData && typeof i18nData === "object") {
    state.i18n = i18nData;
  }

  if (PAGE === "mods") {
    const modsData = await loadJsonWithEmbeddedFallback("data/mods.json", (embedded) => {
      if (Array.isArray(embedded.mods)) {
        return embedded.mods;
      }
      return undefined;
    });
    state.mods = Array.isArray(modsData) ? modsData : (Array.isArray(modsData?.mods) ? modsData.mods : []);
  }

  if (PAGE === "updates") {
    const updatesData = await loadJsonWithEmbeddedFallback("data/updates.json", (embedded) => {
      if (Array.isArray(embedded.updates)) {
        return embedded.updates;
      }
      return undefined;
    });
    state.updates = Array.isArray(updatesData) ? updatesData : (Array.isArray(updatesData?.updates) ? updatesData.updates : []);
  }

  if (PAGE === "plugins") {
    const pluginsData = await loadJsonWithEmbeddedFallback("data/plugins.json", (embedded) => {
      if (Array.isArray(embedded.plugins)) {
        return embedded.plugins;
      }
      return undefined;
    });
    state.plugins = Array.isArray(pluginsData) ? pluginsData : (Array.isArray(pluginsData?.plugins) ? pluginsData.plugins : []);
  }

  if (PAGE === "challenges") {
    const challengesData = await loadJsonWithEmbeddedFallback("data/challenges.json", (embedded) => {
      if (Array.isArray(embedded.challenges)) {
        return embedded.challenges;
      }
      return undefined;
    });
    state.challenges = Array.isArray(challengesData) ? challengesData : (Array.isArray(challengesData?.challenges) ? challengesData.challenges : []);
  }
}

async function init() {
  document.documentElement.classList.add("js-enabled");
  setupMobileMenu();
  setupCopyIp();
  setupMusicPlayer();
  setupFeedbackButton();
  setupGalleryLightbox();
  setCoreFields();
  setupReveal();
  setupApplicationForm();

  try {
    await loadDataForPage();
  } catch (error) {
    showToast(`Data loading error: ${error.message}`);
  }

  setupLanguageSwitch();
  renderPageDynamic();
}

document.addEventListener("DOMContentLoaded", init);
