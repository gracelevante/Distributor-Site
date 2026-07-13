/* ============================================================
   Inspired LED Pro Site — shared hamburger nav toggle
   Link this file before </body> on every page:
     <script src="mobile-nav.js"></script>
   Requires the header markup to include:
     <nav class="nav-links" id="navLinks"> ... </nav>
     <button class="nav-toggle" id="navToggle"> ... </button>
   ============================================================ */
(function() {
  var toggle = document.getElementById('navToggle');
  var nav    = document.getElementById('navLinks');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function() {
    var isOpen = nav.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });
  nav.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      nav.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
