const SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxnnuml5LHAQEza3F7LB54WV3OkZzV7UfOn_TJ9zDkCQbvgWwC_kA_TdnH46-NB32Jq/exec";

/* Total early-access places. Used only as the no-JS / offline fallback —
   the live number comes from the Apps Script "spots" endpoint. Keep it
   in step with TOTAL_SPOTS in google-apps-script.gs. */
const TOTAL_SPOTS = 450;

const yearEl = document.getElementById("yr");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const nav = document.getElementById("nav");
const burger = document.getElementById("burger");
const navLinks = document.getElementById("nav-links");

if (nav && !document.body.classList.contains("form-page")) {
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

if (burger && navLinks) {
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    });
  });
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.revealDelay || 0);
        window.setTimeout(() => entry.target.classList.add("in"), delay);
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("in"));
}

/* ===================================================================
   ROTATING HERO SCENES
   -------------------------------------------------------------------
   One client, three moments a photographer could be re-booked for. The
   picture and the WhatsApp message change together every 12 seconds.

   The message does not just swap text: the bubble shows a typing indicator
   first, then the new message lands. That beat is the whole point — it reads
   as a message arriving rather than a carousel advancing, which is exactly
   what the product does.
   =================================================================== */

/* The teal stays fixed on "to another photographer?" — the question is the
   line that has to land, and moving the colour off it every 12 seconds took
   the emphasis away from it. Each scene still carries an `accent` index, so
   flipping this back to true restores the rotation. */
const ROTATE_ACCENT = false;

const SCENES = [
  {
    key: "cake",
    tag: "His birthday is coming up",
    msg: "Hi Amaka! 🎂 Your son\u2019s birthday is coming up. Would you like to book a birthday shoot to celebrate?",
    time: "Sent automatically · 9:02 AM",
    accent: 2,
  },
  {
    // Zainab, not Amaka: this is a Northern/Hausa ceremony, and an Igbo name
    // on it would read wrong to the audience this page is for. The three
    // scenes are three clients on one photographer's list, which is closer to
    // how the product is actually used.
    key: "wedding",
    tag: "One year on today",
    msg: "Hi Zainab! ❤️ It\u2019s almost a year since we shot your wedding. Would you like to book an anniversary shoot to celebrate?",
    time: "Sent automatically · 8:15 AM",
    accent: 0,
  },
  {
    // The picture is the maternity session already shot; the message is the
    // next booking it leads to. Newborn sessions happen in the first two
    // weeks — exactly the window a photographer misses without tracking.
    key: "maternity",
    tag: "Baby has arrived",
    msg: "Hi Amaka! 🤍 Congratulations on your baby! Newborn shoots are best in the first two weeks — shall we book yours?",
    time: "Sent automatically · 8:40 AM",
    accent: 1,
  },
];

(function heroScenes() {
  const frame = document.querySelector(".portrait-frame");
  const scenes = Array.from(document.querySelectorAll(".portrait-frame .scene"));
  const body = document.querySelector(".wa-body");
  const msgEl = document.querySelector("[data-wa-msg]");
  const timeEl = document.querySelector("[data-wa-time]");
  const tagWrap = document.querySelector(".frame-tag");
  const tagEl = document.querySelector("[data-frame-tag]");
  const dots = Array.from(document.querySelectorAll(".scene-dots button"));
  if (scenes.length < 2 || !body || !msgEl) return;

  const HOLD = 12000;      // how long each scene rests
  const TYPING = 1100;     // how long the dots show before the message lands
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let timer = null;
  let chain = [];

  const clearChain = () => {
    chain.forEach(window.clearTimeout);
    chain = [];
  };
  const later = (fn, ms) => chain.push(window.setTimeout(fn, ms));

  function show(next) {
    if (next === index) return;
    const from = scenes[index];
    const to = scenes[next];
    index = next;

    // picture: cross-fade, outgoing drifting further in as it leaves
    from.classList.remove("is-on");
    from.classList.add("is-out");
    to.classList.remove("is-out");
    to.classList.add("is-on");
    later(() => from.classList.remove("is-out"), 1600);

    dots.forEach((d, i) =>
      i === next ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")
    );

    const scene = SCENES[next] || SCENES[0];

    if (ROTATE_ACCENT) {
      const parts = document.querySelectorAll(".hero-title [data-hl]");
      parts.forEach((el, i) =>
        el.classList.toggle("ink-teal", i === (SCENES[next] || {}).accent)
      );
    }

    if (tagWrap && tagEl) {
      tagWrap.classList.add("is-swapping");
      later(() => {
        tagEl.textContent = scene.tag;
        tagWrap.classList.remove("is-swapping");
      }, 460);
    }

    if (reduce.matches) {
      msgEl.textContent = scene.msg;
      if (timeEl) timeEl.textContent = scene.time;
      return;
    }

    // typing dots, then the message lands
    clearChainMessagesOnly();
    body.classList.add("is-typing");
    later(() => {
      body.classList.remove("is-typing");
      body.classList.add("is-arriving");
      msgEl.textContent = scene.msg;
      if (timeEl) timeEl.textContent = scene.time;
      // next frame, so the browser paints the hidden state before releasing it
      requestAnimationFrame(() =>
        requestAnimationFrame(() => body.classList.remove("is-arriving"))
      );
    }, TYPING);
  }

  function clearChainMessagesOnly() {
    body.classList.remove("is-typing", "is-arriving");
  }

  const advance = () => show((index + 1) % scenes.length);

  function start() {
    stop();
    timer = window.setInterval(advance, HOLD);
  }
  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  dots.forEach((d, i) =>
    d.addEventListener("click", () => {
      show(i);
      start();          // a manual pick resets the clock rather than cutting it short
    })
  );

  // Nothing rotates while the tab is hidden: the timer would keep firing into
  // a page nobody is looking at, and the viewer would return mid-transition.
  document.addEventListener("visibilitychange", () =>
    document.visibilityState === "hidden" ? stop() : start()
  );

  // Pause on hover so someone reading the message is not interrupted by it
  // changing under them.
  if (frame) {
    const card = document.querySelector(".wa-float");
    [frame, card].filter(Boolean).forEach((el) => {
      el.addEventListener("mouseenter", stop);
      el.addEventListener("mouseleave", start);
    });
  }

  if (!reduce.matches) start();
  reduce.addEventListener("change", () => (reduce.matches ? stop() : start()));
})();

/* ===================================================================
   ATTRIBUTION
   =================================================================== */

function parseHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function bucketFromSource(host) {
  if (!host) return "direct";
  const value = host.toLowerCase();
  if (/instagram|ig/.test(value)) return "instagram";
  if (/facebook|fb\.|fbclid/.test(value)) return "facebook";
  if (/whatsapp|wa\.me/.test(value)) return "whatsapp";
  if (/t\.co|twitter|x\.com/.test(value)) return "twitter";
  if (/tiktok/.test(value)) return "tiktok";
  if (/google|bing|duckduckgo/.test(value)) return "search";
  if (/youtube/.test(value)) return "youtube";
  return "referral";
}

function currentTouch() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || "";
  const refHost = parseHost(document.referrer);
  return {
    sourceBucket: bucketFromSource(utmSource || refHost),
    sourceDetail: utmSource || refHost || "direct",
    utmSource,
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || "",
    referrer: document.referrer || "",
    landingPage: window.location.href,
  };
}

function getLeadAttribution() {
  const lastTouch = currentTouch();
  let firstTouch = lastTouch;
  try {
    const stored = localStorage.getItem("ndy_first_touch");
    if (stored) firstTouch = JSON.parse(stored);
    else localStorage.setItem("ndy_first_touch", JSON.stringify(lastTouch));
  } catch {
    // Storage can be blocked; last-touch data still gets submitted.
  }
  return { firstTouch, lastTouch };
}

/* ===================================================================
   FUNNEL TRACKING
   -------------------------------------------------------------------
   No cookies, no third party, no personal data — a random session id
   plus a random visitor id in the browser's own storage. Events are
   queued and flushed in batches so a busy day doesn't spend the Apps
   Script execution quota one request at a time.

   Nothing here is allowed to throw: tracking must never break the page
   or block a form submission.
   =================================================================== */

const Track = (function () {
  const QUEUE = [];
  const FLUSH_MS = 4000;
  let flushTimer = null;
  let started = false;

  function rid() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
  }

  function readStore(store, key) {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStore(store, key, value) {
    try {
      store.setItem(key, value);
    } catch {
      /* private mode, blocked storage — carry on without persistence */
    }
  }

  let isNewVisitor = false;
  let visitorId = readStore(localStorage, "ndy_vid");
  if (!visitorId) {
    visitorId = rid();
    isNewVisitor = true;
    writeStore(localStorage, "ndy_vid", visitorId);
  }

  let sessionId = readStore(sessionStorage, "ndy_sid");
  if (!sessionId) {
    sessionId = rid();
    writeStore(sessionStorage, "ndy_sid", sessionId);
  }

  function device() {
    const w = window.innerWidth || 0;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  function context() {
    const t = currentTouch();
    let first = t;
    try {
      const stored = localStorage.getItem("ndy_first_touch");
      if (stored) first = JSON.parse(stored);
    } catch {}
    // sourceBucket/sourceDetail are FIRST touch, from localStorage, so every
    // event a visitor ever fires is attributed to where they originally came
    // from. lastTouch* is where they came from on THIS visit. Both are kept:
    // first touch answers "which channel found this person", last touch
    // answers "which channel brought them back today", and for a campaign
    // they are usually different.
    return {
      sessionId,
      visitorId,
      isNewVisitor: isNewVisitor ? "yes" : "no",
      page: window.location.pathname.replace(/\/$/, "") || "/",
      host: window.location.hostname,
      sourceBucket: first.sourceBucket || t.sourceBucket,
      sourceDetail: first.sourceDetail || t.sourceDetail,
      utmSource: t.utmSource,
      utmMedium: t.utmMedium,
      utmCampaign: t.utmCampaign,
      referrer: t.referrer,
      device: device(),
      viewport: (window.innerWidth || 0) + "x" + (window.innerHeight || 0),
      lastTouchBucket: t.sourceBucket,
      lastTouchDetail: t.sourceDetail,
      firstTouchUtmSource: first.utmSource || "",
      firstTouchUtmMedium: first.utmMedium || "",
      firstTouchUtmCampaign: first.utmCampaign || "",
      landingPage: first.landingPage || "",
    };
  }

  function flush(useBeacon) {
    if (!QUEUE.length) return;
    const batch = QUEUE.splice(0, QUEUE.length);
    const body = JSON.stringify({ type: "events", batch });

    try {
      if (useBeacon && navigator.sendBeacon) {
        // text/plain keeps this a "simple" request, so no CORS preflight —
        // which Apps Script cannot answer.
        const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
        if (navigator.sendBeacon(SHEETS_WEB_APP_URL, blob)) return;
      }
      fetch(SHEETS_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      }).catch(() => {});
    } catch {
      /* swallow — analytics is never worth an error */
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flush(false);
    }, FLUSH_MS);
  }

  function send(event, detail, immediate) {
    try {
      QUEUE.push(
        Object.assign({ timestamp: new Date().toISOString(), event }, context(), {
          detail: detail === undefined ? "" : detail,
        })
      );
      // Anything that signals intent goes out immediately; the rest waits.
      if (immediate) {
        flush(immediate === "beacon");
      } else if (event === "form_submit_ok" || event === "form_submit_error") {
        flush(false);
      } else {
        scheduleFlush();
      }
    } catch {}
  }

  function start() {
    if (started) return;
    started = true;

    // Flush whatever is queued when the page goes away.
    window.addEventListener("pagehide", () => flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
  }

  return { send, start, flush, sessionId, visitorId };
})();

Track.start();
Track.send("page_view", document.title);

/* ── CTA clicks ─────────────────────────────────────────────────────
   Anything that points at the application, plus anything explicitly
   tagged with data-track-cta. */
document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest("a,button");
    if (!link) return;

    const tagged = link.getAttribute("data-track-cta");
    const href = link.getAttribute("href") || "";

    if (tagged) {
      Track.send("cta_click", tagged);
      return;
    }
    if (/early-access\.html/.test(href)) {
      const label = (link.textContent || "").trim().slice(0, 60);
      const section = link.closest("section");
      Track.send(
        "cta_click",
        (section && section.className.split(" ")[0]) + " · " + label
      );
    } else if (/app\.ndylens\.com/.test(href)) {
      Track.send("cta_click", "sign-in");
    }
  },
  true
);

/* ── Scroll depth on the landing page ──────────────────────────────
   Tells you how far people actually get before they leave. */
if (!document.body.classList.contains("form-page")) {
  const marks = [25, 50, 75, 100];
  const hit = {};
  let ticking = false;

  const measure = () => {
    ticking = false;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    marks.forEach((m) => {
      if (pct >= m && !hit[m]) {
        hit[m] = true;
        Track.send("scroll_depth", m + "%");
      }
    });
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    },
    { passive: true }
  );
}

/* ===================================================================
   LIVE SPOTS COUNTER
   JSONP, because Apps Script /exec redirects and that breaks a plain
   cross-origin fetch from a static host like GitHub Pages.
   =================================================================== */

function renderSpots(data) {
  const nodes = document.querySelectorAll("[data-spots]");
  if (!nodes.length) return;

  nodes.forEach((node) => {
    const style = node.getAttribute("data-spots");
    let text;

    if (data.soldOut) {
      text =
        style === "long"
          ? "All " + data.total + " early-access spots have been taken."
          : "All " + data.total + " spots taken";
    } else if (style === "long") {
      text =
        data.remaining +
        " of " +
        data.total +
        " early-access spots still available.";
    } else {
      text = data.remaining + " of " + data.total + " spots left";
    }

    node.textContent = text;
    node.setAttribute("data-spots-live", "true");
  });

  document.querySelectorAll("[data-spots-bar]").forEach((bar) => {
    const filled = Math.round((data.taken / data.total) * 100);
    bar.setAttribute("data-spots-live", "true");
    bar.setAttribute("aria-valuenow", String(data.taken));
    bar.setAttribute("aria-valuemax", String(data.total));
    // Set the width after the reveal so the fill animates from zero.
    window.requestAnimationFrame(() =>
      bar.style.setProperty("--fill", filled + "%")
    );
  });

  if (data.soldOut) document.body.classList.add("spots-sold-out");
}

async function fetchSpots() {
  if (!document.querySelector("[data-spots]")) return;

  // A plain cross-origin fetch, not JSONP. Apps Script used to need the
  // script-tag trick because its /exec redirect broke CORS, but the redirect
  // now carries `access-control-allow-origin: *` on both hops — verified
  // against this deployment from a real browser. fetch gives real error
  // handling and an abortable timeout, neither of which JSONP can offer.
  //
  // The timeout matters: Apps Script cold-starts, and the first request after
  // an idle period can hang for 20s+. Better to give up and leave the
  // hardcoded fallback text than to leave the counter pending forever.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      SHEETS_WEB_APP_URL + "?action=spots&_=" + Date.now(),
      { signal: controller.signal }
    );
    if (!response.ok) return;
    const data = await response.json();
    if (data && data.ok) renderSpots(data);
  } catch {
    // Aborted, offline, or the endpoint is down. The fallback text in the
    // markup stays exactly as it is, so the page never shows a blank count.
  } finally {
    window.clearTimeout(timer);
  }
}

fetchSpots();

/* ===================================================================
   EARLY-ACCESS FORM
   =================================================================== */

const leadForm = document.getElementById("lead-form");
const leadSubmit = document.getElementById("lead-submit");
const leadStatus = document.getElementById("lead-status");

function setLeadStatus(message, kind = "") {
  if (!leadStatus) return;
  leadStatus.textContent = message;
  leadStatus.className = `form-status${kind ? ` ${kind}` : ""}`;
}

let formStarted = false;
let formSubmitted = false;
let abandonReported = false;
let furthestStep = 0;

if (leadForm) {
  Track.send("form_view", "early-access");

  const fieldsets = Array.from(leadForm.querySelectorAll("fieldset"));

  const stepOf = (el) => {
    const fs = el.closest("fieldset");
    const idx = fieldsets.indexOf(fs);
    return idx === -1 ? 0 : idx + 1;
  };

  // First real interaction with any field = the form was started.
  const markStarted = (event) => {
    if (formStarted) return;
    if (!event.target.matches("input,select,textarea")) return;
    if (event.target.classList.contains("hpot")) return;
    formStarted = true;
    Track.send("form_start", "field: " + (event.target.name || "unknown"));
  };
  leadForm.addEventListener("input", markStarted, true);
  leadForm.addEventListener("change", markStarted, true);

  // How far down the form people get.
  leadForm.addEventListener(
    "focusin",
    (event) => {
      const step = stepOf(event.target);
      if (step > furthestStep) {
        furthestStep = step;
        Track.send("form_step", "step " + step + " of " + fieldsets.length);
      }
    },
    true
  );

  // Which fields were left empty when someone gives up.
  const emptyRequiredFields = () => {
    const missing = [];
    leadForm.querySelectorAll("[required]").forEach((field) => {
      if (!String(field.value || "").trim()) missing.push(field.name);
    });
    return missing;
  };

  const reportAbandon = () => {
    if (!formStarted || formSubmitted || abandonReported) return;
    abandonReported = true;
    // Sent with an immediate beacon flush — the page is going away, and
    // Track's own pagehide flush has already run by this point.
    Track.send(
      "form_abandon",
      {
        furthestStep,
        totalSteps: fieldsets.length,
        missing: emptyRequiredFields().slice(0, 12),
      },
      "beacon"
    );
  };

  window.addEventListener("pagehide", reportAbandon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reportAbandon();
  });
}

if (leadForm && leadSubmit) {
  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(leadForm);
    if (String(formData.get("website") || "").trim()) {
      leadForm.reset();
      return;
    }

    Track.send("form_submit_attempt", "");

    if (!leadForm.reportValidity()) {
      const firstInvalid = leadForm.querySelector(":invalid");
      Track.send(
        "form_validation_fail",
        firstInvalid ? firstInvalid.name || firstInvalid.id : "unknown"
      );
      return;
    }

    const needs = formData.getAll("needs").map(String);
    if (!needs.length) {
      Track.send("form_validation_fail", "needs");
      setLeadStatus("Please select at least one way you would like NDYLens to help.", "err");
      return;
    }

    const attribution = getLeadAttribution();
    const payload = {
      timestamp: new Date().toISOString(),
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      phoneNumber: String(formData.get("phoneNumber") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      businessName: String(formData.get("businessName") || "").trim(),
      businessLocation: String(formData.get("businessLocation") || "").trim(),
      businessAge: String(formData.get("businessAge") || ""),
      photographyType: formData.getAll("photographyType").map(String).join(", "),
      clientCount: String(formData.get("clientCount") || ""),
      currentWorkflow: String(formData.get("currentWorkflow") || ""),
      needs: needs.join(", "),
      interestLevel: String(formData.get("interestLevel") || ""),
      message: needs.join(", "),
      pageUrl: window.location.href,
      sessionId: Track.sessionId,
      visitorId: Track.visitorId,
      status: "applied",
      sourceBucket: attribution.firstTouch.sourceBucket,
      sourceDetail: attribution.firstTouch.sourceDetail,
      firstTouchUtmSource: attribution.firstTouch.utmSource,
      firstTouchUtmMedium: attribution.firstTouch.utmMedium,
      firstTouchUtmCampaign: attribution.firstTouch.utmCampaign,
      lastTouchSourceBucket: attribution.lastTouch.sourceBucket,
      lastTouchSourceDetail: attribution.lastTouch.sourceDetail,
      lastTouchUtmSource: attribution.lastTouch.utmSource,
      lastTouchUtmMedium: attribution.lastTouch.utmMedium,
      lastTouchUtmCampaign: attribution.lastTouch.utmCampaign,
      lastTouchUtmContent: attribution.lastTouch.utmContent,
      lastTouchUtmTerm: attribution.lastTouch.utmTerm,
      referrer: attribution.lastTouch.referrer,
      landingPage: attribution.firstTouch.landingPage,
    };

    const previousLabel = leadSubmit.innerHTML;
    leadSubmit.disabled = true;
    leadSubmit.textContent = "Sending…";
    setLeadStatus("Sending your application…");

    // Apps Script cold-starts, and the first request after an idle period can
    // take 20-30 seconds. A status line frozen on "Sending…" for that long
    // reads as a hung page, so acknowledge the wait rather than leave them
    // guessing. Cleared in `finally` whichever way the request ends.
    const slowNotice = window.setTimeout(() => {
      setLeadStatus("Still sending — this can take a few seconds. Please don’t close the page.");
    }, 6000);

    const send = (mode) =>
      fetch(SHEETS_WEB_APP_URL, {
        method: "POST",
        ...(mode ? { mode } : {}),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

    const succeed = () => {
      formSubmitted = true;
      Track.send("form_submit_ok", payload.photographyType || "(not stated)");
      const inbox = payload.email ? " to " + payload.email : "";
      setLeadStatus(
        "Application received. We’ve sent a confirmation" + inbox +
          " — check your inbox, and your spam folder if it isn’t there. " +
          "The NDYLens team will follow up on WhatsApp or by email.",
        "ok"
      );
      leadForm.reset();
      fetchSpots(); // the counter just moved
    };

    try {
      const response = await send();
      if (!response.ok) throw new Error("Primary request failed");
      succeed();
    } catch {
      try {
        await send("no-cors");
        succeed();
      } catch {
        Track.send("form_submit_error", "network");
        setLeadStatus("We couldn’t send your application. Please try again, or message us on WhatsApp at +234 701 462 4100.", "err");
      }
    } finally {
      window.clearTimeout(slowNotice);
      leadSubmit.disabled = false;
      leadSubmit.innerHTML = previousLabel;
    }
  });
}
