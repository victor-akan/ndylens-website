const menuToggle = document.getElementById("menu-toggle");
const siteNav = document.getElementById("site-nav");
const SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbz-o7g6Zbx2c95AO9WdrmuzhWDEZf9bv-SuOPBfGmuN5LixyremjbeR0j1hwI65YLIm1Q/exec";
const ATTRIBUTION_STORAGE_KEY = "ndylens_attribution_v1";
const navSectionLinks = Array.from(
  document.querySelectorAll('#site-nav a[href^="#"]')
);
const navSections = navSectionLinks
  .map((link) => {
    const sectionId = link.getAttribute("href");
    const section = sectionId ? document.querySelector(sectionId) : null;
    if (!section || !sectionId) {
      return null;
    }
    return { link, section, sectionId };
  })
  .filter(Boolean);

function parseHostName(url) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch (error) {
    return "";
  }
}

function normalizeSource(rawSource) {
  const source = String(rawSource || "")
    .trim()
    .toLowerCase();
  if (!source) {
    return "";
  }

  if (
    source === "ig" ||
    source.includes("instagram") ||
    source.includes("insta")
  ) {
    return "instagram";
  }

  if (source === "tt" || source.includes("tiktok")) {
    return "tiktok";
  }

  return source;
}

function sourceFromReferrer(referrer) {
  const host = parseHostName(referrer);
  if (!host) {
    return "direct";
  }

  if (host.includes("instagram.com")) {
    return "instagram";
  }

  if (host.includes("tiktok.com")) {
    return "tiktok";
  }

  if (
    host.includes("google.") ||
    host.includes("bing.") ||
    host.includes("duckduckgo.") ||
    host.includes("yahoo.")
  ) {
    return "search";
  }

  return host;
}

function bucketFromSource(source) {
  if (source === "instagram" || source === "tiktok") {
    return source;
  }

  return "organic";
}

function readStoredAttribution() {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function writeStoredAttribution(value) {
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures.
  }
}

function detectCurrentAttribution() {
  const params = new URLSearchParams(window.location.search);

  const utmSource = String(params.get("utm_source") || "").trim().toLowerCase();
  const utmMedium = String(params.get("utm_medium") || "").trim().toLowerCase();
  const utmCampaign = String(params.get("utm_campaign") || "")
    .trim()
    .toLowerCase();
  const utmContent = String(params.get("utm_content") || "")
    .trim()
    .toLowerCase();
  const utmTerm = String(params.get("utm_term") || "").trim().toLowerCase();
  const sourceParam = String(params.get("source") || "").trim().toLowerCase();

  const explicitSource = normalizeSource(utmSource || sourceParam);
  const referrerSource = sourceFromReferrer(document.referrer);
  const sourceDetail = explicitSource || referrerSource || "direct";

  return {
    sourceBucket: bucketFromSource(sourceDetail),
    sourceDetail,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referrer: document.referrer || "",
    landingPage: window.location.href,
  };
}

function getLeadAttribution() {
  const current = detectCurrentAttribution();
  const stored = readStoredAttribution();

  if (!stored || !stored.firstTouch) {
    const initial = {
      firstTouch: current,
      lastTouch: current,
      updatedAt: new Date().toISOString(),
    };
    writeStoredAttribution(initial);
    return initial;
  }

  const merged = {
    firstTouch: stored.firstTouch,
    lastTouch: current,
    updatedAt: new Date().toISOString(),
  };
  writeStoredAttribution(merged);
  return merged;
}

// Capture attribution on page load (before form submit) for first-touch tracking.
getLeadAttribution();

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!siteNav.classList.contains("is-open")) {
        return;
      }

      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    },
    { passive: true }
  );
}

function setActiveNavSection(sectionId) {
  if (!sectionId) {
    return;
  }

  navSections.forEach((item) => {
    item.link.classList.toggle("is-active", item.sectionId === sectionId);
  });
}

function getViewportSectionId() {
  if (navSections.length === 0) {
    return "";
  }

  const topbar = document.querySelector(".topbar");
  const headerHeight = topbar
    ? topbar.getBoundingClientRect().height
    : 0;
  const visibleViewportHeight = Math.max(window.innerHeight - headerHeight, 0);
  const probeY = headerHeight + visibleViewportHeight * 0.52;

  const current = navSections.find((item) => {
    const rect = item.section.getBoundingClientRect();
    return rect.top <= probeY && rect.bottom >= probeY;
  });
  if (current) {
    return current.sectionId;
  }

  let nearest = navSections[0];
  let smallestDistance = Number.POSITIVE_INFINITY;
  navSections.forEach((item) => {
    const rect = item.section.getBoundingClientRect();
    const distance = Math.abs(rect.top - probeY);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = item;
    }
  });
  return nearest.sectionId;
}

let navSectionRafId = 0;
function syncActiveNavOnScroll() {
  if (navSectionRafId) {
    return;
  }

  navSectionRafId = window.requestAnimationFrame(() => {
    navSectionRafId = 0;
    setActiveNavSection(getViewportSectionId());
  });
}

if (navSections.length > 0) {
  navSections.forEach((item) => {
    item.link.addEventListener("click", () => {
      setActiveNavSection(item.sectionId);
    });
  });

  window.addEventListener("scroll", syncActiveNavOnScroll, { passive: true });
  window.addEventListener("resize", syncActiveNavOnScroll);
  window.addEventListener("hashchange", syncActiveNavOnScroll);
  window.addEventListener("load", syncActiveNavOnScroll);
  syncActiveNavOnScroll();
}

const heroSlides = Array.from(document.querySelectorAll(".hero-slide"));
const heroDots = Array.from(document.querySelectorAll(".hero-dot"));
const heroPrevEl = document.getElementById("hero-prev");
const heroNextEl = document.getElementById("hero-next");
const heroSliderEl = document.getElementById("hero-slider");

let heroIndex = 0;
let heroTimerId;
let heroTransitionTimerId;
let heroIsTransitioning = false;

const HERO_TRANSITION_MS = 950;

function setHeroDotState(index) {
  heroDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === index;
    dot.classList.toggle("is-on", isActive);
    dot.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function resetHeroSlideState(slide) {
  slide.classList.remove(
    "is-enter-next",
    "is-enter-prev",
    "is-leave-next",
    "is-leave-prev"
  );
  slide.style.zIndex = "";
}

function getHeroDirection(targetIndex, forcedDirection) {
  if (forcedDirection === 1 || forcedDirection === -1) {
    return forcedDirection;
  }

  const total = heroSlides.length;
  const forwardDistance = (targetIndex - heroIndex + total) % total;
  const backwardDistance = (heroIndex - targetIndex + total) % total;
  return forwardDistance <= backwardDistance ? 1 : -1;
}

function renderHeroSlide(index, options = {}) {
  const { direction = 1, immediate = false } = options;

  if (heroSlides.length === 0) {
    return;
  }

  const safeIndex = (index + heroSlides.length) % heroSlides.length;

  if (immediate || heroSlides.length === 1) {
    heroSlides.forEach((slide, slideIndex) => {
      resetHeroSlideState(slide);
      slide.classList.toggle("is-active", slideIndex === safeIndex);
    });
    heroIndex = safeIndex;
    setHeroDotState(heroIndex);
    return;
  }

  if (heroIsTransitioning || safeIndex === heroIndex) {
    return;
  }

  heroIsTransitioning = true;
  if (heroSliderEl) {
    heroSliderEl.classList.add("is-shifting");
  }

  if (heroTransitionTimerId) {
    window.clearTimeout(heroTransitionTimerId);
  }

  const currentSlide = heroSlides[heroIndex];
  const nextSlide = heroSlides[safeIndex];
  const enterClass = direction === -1 ? "is-enter-prev" : "is-enter-next";
  const leaveClass = direction === -1 ? "is-leave-prev" : "is-leave-next";

  heroSlides.forEach((slide) => {
    if (slide !== currentSlide && slide !== nextSlide) {
      resetHeroSlideState(slide);
      slide.classList.remove("is-active");
    }
  });

  resetHeroSlideState(currentSlide);
  resetHeroSlideState(nextSlide);
  nextSlide.classList.add("is-active", enterClass);
  nextSlide.style.zIndex = "4";
  currentSlide.style.zIndex = "3";

  // Force layout so the entering class is used as the transition start state.
  void nextSlide.offsetWidth;

  window.requestAnimationFrame(() => {
    nextSlide.classList.remove(enterClass);
    currentSlide.classList.add(leaveClass);
    currentSlide.classList.remove("is-active");
  });

  heroIndex = safeIndex;
  setHeroDotState(heroIndex);

  heroTransitionTimerId = window.setTimeout(() => {
    resetHeroSlideState(currentSlide);
    resetHeroSlideState(nextSlide);
    nextSlide.classList.add("is-active");
    heroIsTransitioning = false;
    if (heroSliderEl) {
      heroSliderEl.classList.remove("is-shifting");
    }
  }, HERO_TRANSITION_MS + 60);
}

function goToHeroSlide(index, options = {}) {
  if (heroSlides.length === 0) {
    return;
  }

  const safeIndex = (index + heroSlides.length) % heroSlides.length;
  const direction = getHeroDirection(safeIndex, options.direction);
  renderHeroSlide(safeIndex, {
    direction,
    immediate: options.immediate === true,
  });
}

function stopHeroAutoplay() {
  if (!heroTimerId) {
    return;
  }

  window.clearInterval(heroTimerId);
  heroTimerId = undefined;
}

function startHeroAutoplay() {
  if (heroSlides.length <= 1) {
    return;
  }

  stopHeroAutoplay();
  heroTimerId = window.setInterval(() => {
    goToHeroSlide(heroIndex + 1, { direction: 1 });
  }, 4600);
}

if (heroSlides.length > 0) {
  if (heroSliderEl) {
    heroSliderEl.classList.add("is-enhanced");
  }

  renderHeroSlide(heroIndex, { immediate: true });

  if (heroPrevEl && heroNextEl) {
    heroPrevEl.addEventListener("click", () => {
      goToHeroSlide(heroIndex - 1, { direction: -1 });
      startHeroAutoplay();
    });

    heroNextEl.addEventListener("click", () => {
      goToHeroSlide(heroIndex + 1, { direction: 1 });
      startHeroAutoplay();
    });
  }

  heroDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const target = Number(dot.getAttribute("data-slide"));
      if (!Number.isNaN(target)) {
        goToHeroSlide(target);
        startHeroAutoplay();
      }
    });
  });

  if (heroSliderEl) {
    heroSliderEl.addEventListener("mouseenter", stopHeroAutoplay);
    heroSliderEl.addEventListener("mouseleave", startHeroAutoplay);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopHeroAutoplay();
      return;
    }

    startHeroAutoplay();
  });

  startHeroAutoplay();
}

const benefitCards = Array.from(document.querySelectorAll(".benefit-card"));
const benefitDetailToggles = Array.from(
  document.querySelectorAll(".benefit-more-toggle")
);
const benefitMobileMediaQuery = window.matchMedia("(max-width: 760px)");

function setBenefitToggleState(card, expanded) {
  if (!card) {
    return;
  }

  const toggle = card.querySelector(".benefit-more-toggle");
  if (!toggle) {
    return;
  }

  card.classList.toggle("is-expanded", expanded);
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? "Hide details" : "See details";
}

function collapseOtherBenefitCards(openCard) {
  benefitCards.forEach((card) => {
    if (card === openCard) {
      return;
    }

    setBenefitToggleState(card, false);
  });
}

function syncBenefitCardsForViewport() {
  const isMobile = benefitMobileMediaQuery.matches;
  benefitCards.forEach((card) => {
    setBenefitToggleState(card, false);
    if (!isMobile) {
      card.classList.remove("is-expanded");
    }
  });
}

benefitDetailToggles.forEach((toggle) => {
  const card = toggle.closest(".benefit-card");
  if (!card) {
    return;
  }

  toggle.addEventListener("click", () => {
    if (!benefitMobileMediaQuery.matches) {
      return;
    }

    const shouldExpand = !card.classList.contains("is-expanded");
    collapseOtherBenefitCards(card);
    setBenefitToggleState(card, shouldExpand);
  });
});

if (typeof benefitMobileMediaQuery.addEventListener === "function") {
  benefitMobileMediaQuery.addEventListener("change", syncBenefitCardsForViewport);
} else if (typeof benefitMobileMediaQuery.addListener === "function") {
  benefitMobileMediaQuery.addListener(syncBenefitCardsForViewport);
}

syncBenefitCardsForViewport();

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const button = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");

  if (!button || !answer) {
    return;
  }

  button.addEventListener("click", () => {
    const willOpen = !item.classList.contains("is-open");

    faqItems.forEach((eachItem) => {
      eachItem.classList.remove("is-open");
      const eachButton = eachItem.querySelector(".faq-question");
      const eachAnswer = eachItem.querySelector(".faq-answer");

      if (!eachButton || !eachAnswer) {
        return;
      }

      eachButton.setAttribute("aria-expanded", "false");
      eachButton.querySelector("span").textContent = "+";
      eachAnswer.style.maxHeight = null;
    });

    if (willOpen) {
      item.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      button.querySelector("span").textContent = "-";
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    }
  });
});

const testimonials = [
  {
    quote:
      'Ndylens helped me get more photoshoot bookings without having to message my clients one after the other.',
    role: "Banko Photography",
    location: "Lagos, Nigeria",
    stars: "★★★★★",
    image: "assets/images/banko photographer.png",
  },
  {
    quote:
      'It keeps my business top of mind for my clients, and I’ve noticed a clear increase in repeat bookings.',
    role: "Banko Photography",
    location: "Lagos, Nigeria",
    stars: "★★★★★",
    image: "assets/images/banko photographer.png",
  },
  {
    quote:
      'This has boosted my yearly revenue significantly — and I barely worry about follow-ups anymore.',
    role: "Banko Photography",
    location: "Lagos, Nigeria",
    stars: "★★★★★",
    image: "assets/images/banko photographer.png",
  },
];

const testimonialPhotoEl = document.querySelector(".testimonial-photo");
const testimonialWrapEl = document.querySelector(".testimonial-wrap");
const quoteEl = document.getElementById("testimonial-quote");
const roleEl = document.getElementById("testimonial-role");
const locationEl = document.getElementById("testimonial-location");
const starsEl = document.getElementById("testimonial-stars");
const prevEl = document.getElementById("testimonial-prev");
const nextEl = document.getElementById("testimonial-next");

let testimonialIndex = 0;
let testimonialTimerId;

const TESTIMONIAL_MIN_DELAY_MS = 5000;
const TESTIMONIAL_MAX_DELAY_MS = 7000;

function renderTestimonial(index) {
  if (!quoteEl || !roleEl || !locationEl || !starsEl) {
    return;
  }

  const data = testimonials[index];
  if (testimonialPhotoEl && data.image) {
    const imageUrl = encodeURI(data.image);
    testimonialPhotoEl.style.backgroundImage = [
      "radial-gradient(circle at 35% 40%, rgba(0, 0, 0, 0.22), transparent 45%)",
      "linear-gradient(180deg, rgba(8, 15, 16, 0.05), rgba(7, 15, 16, 0.84))",
      `url("${imageUrl}")`,
    ].join(", ");
  }
  quoteEl.textContent = data.quote;
  roleEl.textContent = data.role;
  locationEl.textContent = data.location;
  starsEl.textContent = data.stars;
}

function getRandomTestimonialDelay() {
  return (
    Math.floor(
      Math.random() * (TESTIMONIAL_MAX_DELAY_MS - TESTIMONIAL_MIN_DELAY_MS + 1)
    ) + TESTIMONIAL_MIN_DELAY_MS
  );
}

function stopTestimonialAutoplay() {
  if (!testimonialTimerId) {
    return;
  }

  window.clearTimeout(testimonialTimerId);
  testimonialTimerId = undefined;
}

function scheduleNextTestimonial() {
  stopTestimonialAutoplay();

  if (testimonials.length <= 1 || !quoteEl || !roleEl || !locationEl || !starsEl) {
    return;
  }

  testimonialTimerId = window.setTimeout(() => {
    testimonialIndex = (testimonialIndex + 1) % testimonials.length;
    renderTestimonial(testimonialIndex);
    scheduleNextTestimonial();
  }, getRandomTestimonialDelay());
}

function restartTestimonialAutoplay() {
  scheduleNextTestimonial();
}

renderTestimonial(testimonialIndex);

if (prevEl && nextEl) {
  prevEl.addEventListener("click", () => {
    testimonialIndex =
      (testimonialIndex - 1 + testimonials.length) % testimonials.length;
    renderTestimonial(testimonialIndex);
    restartTestimonialAutoplay();
  });

  nextEl.addEventListener("click", () => {
    testimonialIndex = (testimonialIndex + 1) % testimonials.length;
    renderTestimonial(testimonialIndex);
    restartTestimonialAutoplay();
  });
}

if (testimonialWrapEl) {
  testimonialWrapEl.addEventListener("mouseenter", stopTestimonialAutoplay);
  testimonialWrapEl.addEventListener("mouseleave", restartTestimonialAutoplay);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopTestimonialAutoplay();
    return;
  }

  restartTestimonialAutoplay();
});

restartTestimonialAutoplay();

const leadFormEl = document.getElementById("lead-form");
const leadSubmitEl = document.getElementById("lead-submit");
const leadStatusEl = document.getElementById("lead-form-status");

function setLeadStatus(message, type = "") {
  if (!leadStatusEl) {
    return;
  }

  leadStatusEl.textContent = message;
  leadStatusEl.classList.remove("is-success", "is-error");
  if (type === "success") {
    leadStatusEl.classList.add("is-success");
  }
  if (type === "error") {
    leadStatusEl.classList.add("is-error");
  }
}

if (leadFormEl && leadSubmitEl) {
  leadFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!SHEETS_WEB_APP_URL || !/^https?:\/\//.test(SHEETS_WEB_APP_URL)) {
      setLeadStatus(
        "Form endpoint is not configured yet. Add your Google Apps Script URL in script.js.",
        "error"
      );
      return;
    }

    const formData = new FormData(leadFormEl);
    if (String(formData.get("website") || "").trim()) {
      // Honeypot: silently ignore likely bot submission.
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
      message: String(formData.get("message") || "").trim(),
      pageUrl: window.location.href,
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

    leadSubmitEl.disabled = true;
    const previousButtonText = leadSubmitEl.textContent;
    leadSubmitEl.textContent = "SUBMITTING...";
    setLeadStatus("Submitting your request...");

    try {
      // Try standard CORS first.
      const response = await fetch(SHEETS_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Primary submit failed");
      }

      setLeadStatus("Submitted successfully.", "success");
      leadFormEl.reset();
    } catch (primaryError) {
      try {
        // Fallback for Apps Script endpoints that do not return CORS headers.
        await fetch(SHEETS_WEB_APP_URL, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify(payload),
        });

        setLeadStatus("Submitted successfully.", "success");
        leadFormEl.reset();
      } catch (fallbackError) {
        setLeadStatus(
          "Submit failed. Check your Apps Script deployment and URL.",
          "error"
        );
      }
    } finally {
      leadSubmitEl.disabled = false;
      leadSubmitEl.textContent = previousButtonText;
    }
  });
}
