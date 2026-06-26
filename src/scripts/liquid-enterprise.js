const nav = document.getElementById("siteNav");
const form = document.getElementById("leadForm");
const notice = document.getElementById("notice");

function syncNav() {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 24);
}

function showNotice() {
  if (!notice) return;
  notice.classList.add("is-visible");
  window.setTimeout(() => notice.classList.remove("is-visible"), 3200);
}

window.addEventListener("scroll", syncNav, { passive: true });
syncNav();

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.reset();
    showNotice();
  });
}
