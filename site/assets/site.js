// Shared: current nav item and fade-in on scroll.
(function () {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav a").forEach(a => {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
  });

  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" })
    : null;

  window.reveal = function (root) {
    (root || document).querySelectorAll(".reveal:not(.in), .strip:not(.in)").forEach(el => {
      if (io) io.observe(el); else el.classList.add("in");
    });
  };
  window.reveal();
})();
