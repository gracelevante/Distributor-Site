/* ============================================================
   Inspired LED Pro Site — shared hamburger nav toggle
   Link this file before </body> on every page:
     <script src="mobile-nav.js"></script>
   Requires the header markup to include:
     <nav class="nav-links" id="navLinks"> ... </nav>
     <button class="nav-toggle" id="navToggle"> ... </button>
   Also hides the mascot/speech-bubble widget (if present on the
   page) while the mobile menu is open, since it sits at a very
   high z-index and would otherwise float on top of the menu.
   ============================================================ */
(function() {
  var toggle = document.getElementById('navToggle');
  var nav    = document.getElementById('navLinks');
  if (!toggle || !nav) return;

  var mascot = document.getElementById('il-mascot-wrap');
  var bubble = document.getElementById('il-bubble');

  function setOpen(isOpen) {
    nav.classList.toggle('open', isOpen);
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
    if (mascot) mascot.style.visibility = isOpen ? 'hidden' : '';
    if (bubble) bubble.style.visibility = isOpen ? 'hidden' : '';
  }

  toggle.addEventListener('click', function() {
    setOpen(!nav.classList.contains('open'));
  });

  nav.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      setOpen(false);
    });
  });

  /* Small floating help button (mobile only — hidden on desktop via
     mobile-nav.css). Created automatically so no HTML edits are ever
     needed on individual pages; change the PDF filename below, or
     any styling, in mobile-nav.css / this file as needed. */
  if (!document.getElementById('mobile-help-btn')) {
    var helpBtn = document.createElement('a');
    helpBtn.id = 'mobile-help-btn';
    helpBtn.href = 'help-guide.pdf';
    helpBtn.target = '_blank';
    helpBtn.rel = 'noopener noreferrer';
    helpBtn.setAttribute('aria-label', 'Help guide');
    helpBtn.textContent = '?';
    document.body.appendChild(helpBtn);
  }
})();
