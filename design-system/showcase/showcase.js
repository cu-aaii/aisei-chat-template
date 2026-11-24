/* Showcase behaviour. Plain JS, no libraries. Everything here is behaviour that the design system
   deliberately leaves to the app (in Angular: Material/CDK tabs, dialog, and a signal for the menu). */
(function () {
  // Footer copyright year is always the current year (static text in the markup is only the no-JS fallback).
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-current-year]').forEach(function (e) { e.textContent = String(new Date().getFullYear()); });
  });
  // ?theme=cornell|steel|white (brand frame) and ?mode=light|dark (colour mode; omit to follow the OS).
  // Set before first paint to avoid a flash. In the app this is a tiny service that does the same
  // to <html> and remembers the choice.
  var q = new URLSearchParams(location.search);
  document.documentElement.setAttribute('data-theme', q.get('theme') || 'cornell');
  if (q.get('mode') === 'light' || q.get('mode') === 'dark') document.documentElement.setAttribute('data-mode', q.get('mode'));

  // A control is a real tab stop only if it is rendered and not hidden inside a closed <details>
  // (offsetParent alone wrongly counts those, and misses position:fixed ancestors).
  function tabbable(el) {
    if (!el.getClientRects().length) return false;
    var d = el.closest('details:not([open])');
    return !d || (el.tagName === 'SUMMARY' && el.parentElement === d);
  }

  // Overlay helpers, shared by every panel that takes over the page (the public menu, the app menu, the chat): one set
  // of focus rules, so a fix lands in all of them. Blocks document the behaviour (header.css, app.css, chat.css).
  var STOPS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary';
  function stopsIn(panel) { return Array.prototype.filter.call(panel.querySelectorAll(STOPS), tabbable); }
  // Dialog semantics for a panel that is modal while open. `own`: the panel is not a native <dialog>, so it also gets the role
  // and tabindex -1 (a click on blank space then keeps focus inside, so Escape and the Tab wrap still work).
  function modalPanel(panel, on, own) {
    if (on) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
    if (!own) return;
    if (on) { panel.setAttribute('role', 'dialog'); panel.setAttribute('tabindex', '-1'); }
    else { panel.removeAttribute('role'); panel.removeAttribute('tabindex'); }
  }
  // Everything else on the page, for making it inert behind a modal panel.
  function pageBeside(keep) {
    return Array.prototype.filter.call(document.body.children, function (el) { return el !== keep && el.tagName !== 'SCRIPT' && el.tagName !== 'svg'; });
  }
  function setInert(els, on) { els.forEach(function (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }); }
  // Tab and Shift+Tab wrap inside the panel. The panel itself counts as "before the first stop": focus lands on it after a
  // click on blank space, and Shift+Tab from there must wrap, not leave.
  function wrapTab(e, panel) {
    if (e.key !== 'Tab') return;
    var f = stopsIn(panel); if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Header: Search and Menu buttons. Below 960px the Menu opens the main navigation as a modal overlay,
    // the same behaviour CDS has: focus moves in and is trapped, everything behind is inert, Escape or the
    // close button returns focus to the Menu button. Without script (no data-collapsible) all stays visible.
    document.querySelectorAll('.cu-header').forEach(function (header) {
      var menuBtn = header.querySelector('.cu-header__menu');
      var searchBtn = header.querySelector('.cu-header__button[aria-controls^="search"]');
      var search = searchBtn && document.getElementById(searchBtn.getAttribute('aria-controls'));
      var nav = menuBtn && document.getElementById(menuBtn.getAttribute('aria-controls'));
      var closeBtn = nav && nav.querySelector('.cu-nav__close');
      var wide = window.matchMedia('(min-width: 960px)');
      header.setAttribute('data-collapsible', '');
      if (search) search.hidden = true;
      function others(on) {
        setInert(pageBeside(header), on);
        setInert(Array.prototype.filter.call(header.children, function (el) { return el !== nav; }), on);
      }
      function setMenu(open, focus) {
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && !wide.matches) {
          modalPanel(nav, true, true); others(true);
          closeBtn.focus();
        } else {
          modalPanel(nav, false, true); others(false);
          if (focus) menuBtn.focus();
        }
      }
      if (menuBtn && nav) {
        menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
        closeBtn.addEventListener('click', function () { setMenu(false, true); });
        wide.addEventListener('change', function () { if (wide.matches) setMenu(false); });
        nav.addEventListener('keydown', function (e) {
          if (menuBtn.getAttribute('aria-expanded') !== 'true' || wide.matches) return;
          if (e.key === 'Escape') { setMenu(false, true); return; }
          wrapTab(e, nav);
        });
      }
      if (searchBtn && search) {
        // Opening slides the panel down; closing slides it back up (.is-closing), then hides it. Reopening mid-close
        // cancels the close. Reduced motion has zero durations, so the animation ends at once; the timer is a backstop.
        var closeTimer = null, onEnd = null;
        function cancelClose() {
          clearTimeout(closeTimer);
          if (onEnd) { search.removeEventListener('animationend', onEnd); onEnd = null; }
          search.classList.remove('is-closing');
        }
        function setSearch(open, focusButton) {
          cancelClose();
          searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) { search.hidden = false; search.querySelector('input[type="search"]').focus(); return; }
          if (focusButton) searchBtn.focus();
          if (search.hidden) return;
          function done() { cancelClose(); search.hidden = true; }
          onEnd = function (e) { if (e.target === search && e.animationName === 'cu-search-up') done(); };
          search.addEventListener('animationend', onEnd);
          search.classList.add('is-closing');
          closeTimer = setTimeout(done, 600);
        }
        searchBtn.addEventListener('click', function () { setSearch(searchBtn.getAttribute('aria-expanded') !== 'true'); });
        search.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSearch(false, true); });
      }
    });

    // Tabs, as CDS: arrow keys move focus and wrap at the ends (Home/End jump); Enter or Space activates
    // the focused tab (a native button click). Roving tabindex: only the selected tab is a tab stop.
    document.querySelectorAll('.cu-tabs').forEach(function (root) {
      var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
      function select(tab) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab); });
        tab.addEventListener('keydown', function (e) {
          var n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
          if (n === undefined) return;
          e.preventDefault();
          tabs[(n + tabs.length) % tabs.length].focus();
        });
      });
      select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);
    });

    // Modal dialogs. The native <dialog> gives the inert background, the top layer and Escape, but its focus
    // trap is not complete: Tab from the last control moves to the browser or the document for one stop.
    // So, as in CDS ("focus bounds"), focus is kept inside explicitly. Also as CDS: the Close button gets
    // focus first, a click on the backdrop closes, Enter is ignored while held down (so holding Enter on
    // the opener or Close cannot flip the dialog open and shut), and focus returns to the opener.
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    function focusables(dlg) {
      return Array.prototype.filter.call(dlg.querySelectorAll(FOCUSABLE), tabbable);
    }
    function openDialog(dlg, opener) {
      dlg._opener = opener;
      dlg.showModal();
      var first = dlg.querySelector('.cu-dialog__close') || focusables(dlg)[0];
      if (first) first.focus();
    }
    function closeDialog(dlg) {
      if (dlg.open) dlg.close();
    }
    document.querySelectorAll('dialog.cu-dialog').forEach(function (dlg) {
      dlg.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = focusables(dlg);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], active = document.activeElement;
        if (e.shiftKey && (active === first || active === dlg)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || active === dlg)) { e.preventDefault(); first.focus(); }
      });
      document.addEventListener('focusin', function (e) { // safety net: anything that still gets out is pulled back
        if (dlg.open && !dlg.contains(e.target)) { var f = focusables(dlg); if (f.length) f[0].focus(); }
      });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(dlg); }); // backdrop click
      dlg.addEventListener('close', function () { // native Escape and close() both end here
        var o = dlg._opener; dlg._opener = null;
        if (o && document.contains(o)) o.focus();
      });
    });
    function pressOnce(el, fn) { // activate on Enter only once per physical key press (CDS: ignore e.repeat)
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat) fn();
      });
    }
    document.querySelectorAll('[data-open-dialog]').forEach(function (b) {
      var go = function () { openDialog(document.getElementById(b.getAttribute('data-open-dialog')), b); };
      b.addEventListener('click', go);
      pressOnce(b, function () { b.click(); });
    });
    document.querySelectorAll('dialog [data-close-dialog]').forEach(function (b) {
      b.addEventListener('click', function () { closeDialog(b.closest('dialog')); });
      pressOnce(b, function () { b.click(); });
    });
  });

  // ---- Navigation menus (reference behaviour for .cu-nav[--menu|--mega]) ----------------------------
  // Disclosure pattern (button + aria-expanded) with the CDS arrow-key model on top:
  //   top level: Left/Right move between items, Down opens and enters the menu, Up/Escape closes
  //   in a menu: Up/Down move through items, Right opens a flyout (or moves on to the next top item),
  //   Left returns to the parent, Escape closes one level, Tab leaves the menu (closed menus are not tab stops).
  //   mega panel: Up/Down follow the columns top to bottom, Left/Right jump to the nearest link in the next column.
  function initNav(nav) {
    var wide = window.matchMedia('(min-width: 960px)');
    var topList = nav.querySelector('.cu-nav__list');
    nav.setAttribute('data-ready', '');
    var mega = nav.classList.contains('cu-nav--mega');
    function parents(el) { return Array.prototype.slice.call(el.querySelectorAll('.cu-nav__parent')); }
    function sub(li) { return li.querySelector(':scope > .cu-nav__sub'); }
    function link(li) { return li.querySelector(':scope > .cu-nav__link'); }
    function toggle(li) { return li.querySelector(':scope > .cu-nav__toggle'); }
    function setOpen(li, open) {
      li.classList.toggle('is-open', open);
      var t = toggle(li); if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var u = sub(li);
        if (u && wide.matches) { u.classList.remove('is-flipped'); if (u.getBoundingClientRect().right > document.documentElement.clientWidth) u.classList.add('is-flipped'); }
      } else {
        parents(li).forEach(function (d) { d.classList.remove('is-open'); var x = toggle(d); if (x) x.setAttribute('aria-expanded', 'false'); });
      }
      if (li.parentElement === topList) topList.classList.toggle('is-open', !!topList.querySelector(':scope > .is-open'));
    }
    function closeAll(except) { parents(nav).forEach(function (li) { if (!except || !li.contains(except)) setOpen(li, false); }); }
    function items(li) { return Array.prototype.slice.call(li.parentElement.children).filter(function (x) { return !x.classList.contains('cu-nav__feature'); }); }
    function topItems() { return items(topList.firstElementChild); }
    function focusLink(li) { var a = link(li) || li.querySelector('a'); if (a) a.focus(); }
    function visibleLinks(panel) { return Array.prototype.slice.call(panel.querySelectorAll('a')).filter(tabbable); }

    // disclosure buttons
    parents(nav).forEach(function (li) {
      var t = toggle(li); if (!t) return;
      t.setAttribute('aria-expanded', 'false');
      t.addEventListener('click', function () {
        var open = !li.classList.contains('is-open');
        Array.prototype.forEach.call(li.parentElement.children, function (sib) { if (sib !== li && sib.classList && sib.classList.contains('cu-nav__parent')) setOpen(sib, false); });
        setOpen(li, open);
      });
    });
    // hover (desktop only): open on enter, close shortly after leaving so the pointer can cross the gap
    var timers = new WeakMap();
    parents(nav).forEach(function (li) {
      li.addEventListener('mouseenter', function () {
        if (!wide.matches) return;
        clearTimeout(timers.get(li));
        Array.prototype.forEach.call(li.parentElement.children, function (sib) { if (sib !== li && sib.classList && sib.classList.contains('cu-nav__parent')) setOpen(sib, false); });
        setOpen(li, true);
      });
      li.addEventListener('mouseleave', function () {
        if (!wide.matches) return;
        timers.set(li, setTimeout(function () { if (!li.contains(document.activeElement) || document.activeElement === document.body) setOpen(li, false); }, 180));
      });
    });
    // keyboard
    nav.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      var key = e.key;
      if (key === 'Escape') {
        // close the innermost open level around focus and put focus on its link
        var owner = e.target.closest('.cu-nav__parent');
        while (owner && !owner.classList.contains('is-open')) owner = owner.parentElement.closest('.cu-nav__parent');
        // when focus is on an open parent's own link, close that parent; otherwise the nearest open ancestor
        if (owner && owner.classList.contains('is-open')) { setOpen(owner, false); focusLink(owner); e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!wide.matches) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(key) < 0) return;
      var a = e.target.closest('a, button'); if (!a) return;
      var li = a.closest('li'); if (!li) return;
      var inTop = li.parentElement === topList;
      var panel = a.closest('.cu-nav__sub');
      var move = null;
      if (inTop) {
        var tops = topItems(), i = tops.indexOf(li);
        if (key === 'ArrowRight') move = function () { setOpen(li, false); focusLink(tops[(i + 1) % tops.length]); };
        else if (key === 'ArrowLeft') move = function () { setOpen(li, false); focusLink(tops[(i - 1 + tops.length) % tops.length]); };
        else if (key === 'Home') move = function () { focusLink(tops[0]); };
        else if (key === 'End') move = function () { focusLink(tops[tops.length - 1]); };
        else if (key === 'ArrowDown' && sub(li)) move = function () { setOpen(li, true); var f = visibleLinks(sub(li))[0]; if (f) f.focus(); };
        else if (key === 'ArrowUp' && li.classList.contains('is-open')) move = function () { setOpen(li, false); };
      } else if (mega && panel) {
        var top = panel.closest('.cu-nav__list > .cu-nav__parent'), all = visibleLinks(top.querySelector(':scope > .cu-nav__sub')), k = all.indexOf(a.closest('a'));
        if (key === 'ArrowDown') move = function () { if (k < all.length - 1) all[k + 1].focus(); };
        else if (key === 'ArrowUp') move = function () { if (k > 0) all[k - 1].focus(); else focusLink(top); };
        else if (key === 'Home') move = function () { all[0].focus(); };
        else if (key === 'End') move = function () { all[all.length - 1].focus(); };
        else if (key === 'ArrowLeft' || key === 'ArrowRight') move = function () {
          var r = a.getBoundingClientRect(), dir = key === 'ArrowRight' ? 1 : -1, best = null, bd = 1e9;
          all.forEach(function (c) { var q = c.getBoundingClientRect(); if ((q.left - r.left) * dir > 8) { var d = Math.abs(q.top - r.top) + Math.abs(q.left - r.left) * 0.01; if (d < bd) { bd = d; best = c; } } });
          if (best) best.focus();
        };
      } else if (panel) {
        var list = items(li).filter(function (x) { return link(x) && tabbable(link(x)); }), j = list.indexOf(li), parentLi = panel.closest('.cu-nav__parent');
        var depth2 = parentLi.parentElement === topList;
        if (key === 'ArrowDown') move = function () { if (j < list.length - 1) focusLink(list[j + 1]); };
        else if (key === 'ArrowUp') move = function () { if (j > 0) focusLink(list[j - 1]); else if (depth2) { focusLink(parentLi); } else { focusLink(parentLi); } };
        else if (key === 'Home') move = function () { focusLink(list[0]); };
        else if (key === 'End') move = function () { focusLink(list[list.length - 1]); };
        else if (key === 'ArrowRight') move = function () {
          if (li.classList.contains('cu-nav__parent') && sub(li)) { setOpen(li, true); var f = visibleLinks(sub(li))[0]; if (f) f.focus(); }
          else { var topLi = li.closest('.cu-nav__list > li'), tops = topItems(), n = tops.indexOf(topLi); setOpen(topLi, false); focusLink(tops[(n + 1) % tops.length]); }
        };
        else if (key === 'ArrowLeft') move = function () {
          if (!depth2) { setOpen(parentLi, false); focusLink(parentLi); }
          else { var tops = topItems(), n = tops.indexOf(parentLi); setOpen(parentLi, false); focusLink(tops[(n - 1 + tops.length) % tops.length]); }
        };
      }
      if (move) { e.preventDefault(); move(); }
    });
    // leaving the menu (focus or pointer-click elsewhere) closes it
    nav.addEventListener('focusout', function (e) { if (e.relatedTarget && !nav.contains(e.relatedTarget)) closeAll(); });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !nav.contains(document.activeElement)) closeAll(); });
    // mega panels: balance the columns
    function layout() {
      if (!mega) return;
      Array.prototype.forEach.call(nav.querySelectorAll('.cu-nav__list > .cu-nav__parent > .cu-nav__sub'), function (u) {
        var feature = u.querySelector(':scope > .cu-nav__feature'), n = u.children.length - (feature ? 1 : 0), cols = feature ? 2 : 3;
        u.style.setProperty('--_rows', Math.max(1, Math.ceil(n / cols)));
      });
    }
    layout(); window.addEventListener('resize', layout);
    wide.addEventListener('change', function () { closeAll(); });
  }
  function initNavToggle(btn) {
    var nav = btn.nextElementSibling;
    btn.hidden = false; btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () { btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.cu-nav--menu, .cu-nav--mega').forEach(initNav);
    document.querySelectorAll('.cu-nav-toggle[hidden]').forEach(initNavToggle);
  });
  // ---- Interactive batch: accordion "Expand all", tooltips, hover tabs, back to top ------------------------
  // Accordions are native <details>, so open/close, keyboard and single-select (a shared name="…") need no script.
  // The only script is the optional "Expand all" button, added so that without script there is no dead control.

  // Update messages and toasts (blocks/toast.css). The region is in the page, empty, from the start; filling it is
  // what makes a screen reader announce it. A toast closes itself after 4s (data-timeout, 0 = never) unless the
  // pointer or focus is on it.
  function showUpdate(box, html) {
    var content = box.querySelector('.cu-update__content');
    var ms = box.hasAttribute('data-timeout') ? Number(box.getAttribute('data-timeout')) : (box.classList.contains('cu-update--toast') ? 4000 : 0);
    clearTimeout(box._cuTimer);
    box.setAttribute('data-open', '');
    content.innerHTML = '';
    // fill on the next frame, after the box is shown, so the live region change is announced
    requestAnimationFrame(function () { content.innerHTML = html; });
    function arm() { clearTimeout(box._cuTimer); if (ms > 0) box._cuTimer = setTimeout(hide, ms); }
    function hide() { box.removeAttribute('data-open'); content.innerHTML = ''; }
    if (!box._cuWired) {
      box._cuWired = true;
      var held = function () { clearTimeout(box._cuTimer); };
      box.addEventListener('mouseenter', held);
      box.addEventListener('focusin', held);
      box.addEventListener('mouseleave', function () { if (!box.contains(document.activeElement)) arm(); });
      box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget) && !box.matches(':hover')) arm(); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hide(); if (box._cuFrom) box._cuFrom.focus(); } });
      var close = box.querySelector('.cu-update__close');
      if (close) close.addEventListener('click', function () { var back = box._cuFrom; hide(); if (back && document.body.contains(back)) back.focus(); });
    }
    box._cuFrom = document.activeElement;
    arm();
  }
  window.cuShowUpdate = showUpdate;

  function initExpandAll(set) {
    var items = Array.prototype.filter.call(set.children, function (c) { return c.tagName === 'DETAILS'; });
    if (set.getAttribute('data-expand-all') === 'false') return;
    if (items.length < 2 || items.some(function (d) { return d.hasAttribute('name'); })) return; // single-select sets have nothing to expand
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cu-accordion-set__toggle';
    // The Material Symbols format_line_spacing glyph (weight 300), inline so the button needs no sprite on the page
    btn.innerHTML = '<svg class="cu-icon" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="M246.15-179.39 100-325.54l32-32 91.46 90.62v-424.54L132-601.23l-32-32 146.15-146.15 146.16 146.15-32 32-91.46-90.23v424.54l91.46-90.62 32 32-146.16 146.15ZM487.69-220v-45.39H860v50L487.69-220Zm0-237.31v-45.38H860v45.38H487.69Zm0-237.3V-740L860-744.61v50H487.69Z"/></svg><span></span>';
    set.insertBefore(btn, set.firstChild);
    function sync() {
      var all = items.every(function (d) { return d.open; });
      btn.querySelector('span').textContent = all ? 'Close all' : 'Expand all';
    }
    btn.addEventListener('click', function () {
      var all = items.every(function (d) { return d.open; });
      items.forEach(function (d) { d.open = !all; });
      sync();
    });
    items.forEach(function (d) { d.addEventListener('toggle', sync); });
    sync();
  }

  // Tooltips (CDS): hover (150ms) or keyboard focus opens; pointer or focus on the tip keeps it; 300ms after both
  // leave it closes; Escape closes it from anywhere (and, when focus is in the tip, returns focus to the trigger).
  // aria-describedby links trigger and tip. Position: above by default, flips when there is no room, slides
  // sideways to stay inside the viewport while the arrow stays on the trigger.
  var tipCount = 0;
  function initTooltip(wrap) {
    var trigger = wrap.querySelector('.cu-tooltip__trigger');
    var tip = wrap.querySelector('.cu-tooltip__tip');
    if (!trigger || !tip) return;
    tipCount++;
    if (!tip.id) tip.id = 'cu-tip-' + tipCount;
    // role=tooltip only for a plain-text tip: ARIA does not allow interactive content in a tooltip, so a tip with a
    // link stays a plain element (as in CDS), still announced through aria-describedby and reached next with Tab.
    if (!tip.querySelector('a[href], button, input, select, textarea, [tabindex]')) tip.setAttribute('role', 'tooltip');
    else tip.removeAttribute('role');
    trigger.setAttribute('aria-describedby', tip.id);
    var natural = tip.classList.contains('cu-tooltip__tip--bottom') ? 'bottom' : 'top';
    var tin, tout;
    function place() {
      tip.style.maxWidth = '';
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var wr = wrap.getBoundingClientRect(), tr = trigger.getBoundingClientRect();
      if (tip.offsetWidth > vw - 8) tip.style.maxWidth = (vw - 8) + 'px';
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = tr.left - wr.left + tr.width / 2 - w / 2, abs = wr.left + left, shift = 0;
      if (abs < 4) { shift = abs - 4; left -= shift; }
      if (abs + w > vw - 4) { shift = abs + w - (vw - 4); left -= shift; }
      var placement = natural;
      if (placement === 'top' && tr.top - 10 - h < 0 && tr.bottom + 10 + h <= vh) placement = 'bottom';
      else if (placement === 'bottom' && tr.bottom + 10 + h > vh && tr.top - 10 - h >= 0) placement = 'top';
      var top = (placement === 'top' ? tr.top - 10 - h : tr.bottom + 10) - wr.top;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      tip.style.setProperty('--_arrow-shift', shift + 'px');
      tip.setAttribute('data-placement', placement);
    }
    function open() {
      clearTimeout(tout);
      document.querySelectorAll('.cu-tooltip__tip.is-active').forEach(function (t) { if (t !== tip) t.classList.remove('is-active'); });
      tip.classList.add('is-active');
      place();
    }
    function later() { clearTimeout(tin); clearTimeout(tout); tout = setTimeout(function () { tip.classList.remove('is-active'); }, 300); }
    trigger.addEventListener('mouseenter', function () {
      clearTimeout(tout);
      if (!tip.classList.contains('is-active')) { clearTimeout(tin); tin = setTimeout(open, 150); }
    });
    trigger.addEventListener('mouseleave', later);
    trigger.addEventListener('focusin', open);
    trigger.addEventListener('focusout', later);
    tip.addEventListener('mouseenter', function () { clearTimeout(tout); });
    tip.addEventListener('mouseleave', later);
    tip.addEventListener('focusin', function () { clearTimeout(tout); });
    tip.addEventListener('focusout', later);
    window.addEventListener('resize', function () { if (tip.classList.contains('is-active')) place(); });
    tip._cuTrigger = trigger;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var active = document.querySelectorAll('.cu-tooltip__tip.is-active');
    if (!active.length) return;
    active.forEach(function (t) {
      if (t.contains(document.activeElement) && t._cuTrigger) t._cuTrigger.focus();
      t.classList.remove('is-active');
    });
    e.preventDefault(); // dismisses the tip only; a dialog around it stays open until the next Escape
  }, true);

  // Hover tabs (CDS): a label shows its panel after 100ms of pointer hover, at once on focus or click. Not a tablist:
  // each label is a button with aria-controls and aria-expanded, and panels that are not showing are hidden (CSS).
  var hoverCount = 0;
  function initHoverTabs(root) {
    hoverCount++;
    var labels = Array.prototype.filter.call(root.children, function (c) { return c.classList.contains('cu-hovertabs__label'); });
    var pairs = labels.map(function (l) { var p = l.nextElementSibling; return p && p.classList.contains('cu-hovertabs__panel') ? p : null; });
    root.setAttribute('data-count', String(labels.length));
    labels.forEach(function (l, i) {
      if (labels.length > 7) l.classList.add('is-ultra'); else if (labels.length > 5) l.classList.add('is-compact');
      var panel = pairs[i]; if (!panel) return;
      if (!panel.id) panel.id = 'cu-ht-' + hoverCount + '-' + i;
      if (l.tagName === 'BUTTON') l.setAttribute('aria-controls', panel.id);
      if (l.tagName === 'A' && !l.querySelector('.cu-hovertabs__text')) {
        var t = document.createElement('span'); t.className = 'cu-hovertabs__text';
        while (l.firstChild) t.appendChild(l.firstChild); l.appendChild(t);
      }
    });
    function show(i) {
      labels.forEach(function (l, j) {
        var on = i === j;
        l.classList.toggle('is-current', on);
        if (l.tagName === 'BUTTON') l.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (pairs[j]) pairs[j].classList.toggle('is-current', on);
      });
    }
    labels.forEach(function (l, i) {
      var t;
      l.addEventListener('mouseenter', function () { t = setTimeout(function () { show(i); }, 100); });
      l.addEventListener('mouseleave', function () { clearTimeout(t); });
      l.addEventListener('focus', function () { show(i); });
      l.addEventListener('click', function () { show(i); });
      if (pairs[i]) pairs[i].addEventListener('focusin', function () { show(i); });
    });
    show(0);
  }

  // Back to top: floating ones appear 800px below the top of the target; pressing moves focus to the target first
  // (so focus is never lost when the button hides) and scrolls to it, smoothly unless reduced motion is asked for.
  function initBackToTop(btn) {
    var target = document.querySelector(btn.getAttribute('data-back-to-top') || '#main') || document.body;
    var floating = btn.classList.contains('cu-back-to-top--floating');
    function update() {
      if (!floating) { btn.hidden = false; return; }
      btn.hidden = window.scrollY <= target.getBoundingClientRect().top + window.scrollY + 800;
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    btn.addEventListener('click', function () {
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    });
    update();
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.cu-accordion-set').forEach(initExpandAll);
    document.querySelectorAll('[data-show-update]').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.getElementById(b.getAttribute('data-show-update'));
        if (box) setTimeout(function () { showUpdate(box, '<p>' + (b.getAttribute('data-update-message') || 'Done.') + '</p>'); }, 0);
      });
    });
    document.querySelectorAll('.cu-tooltip').forEach(initTooltip);
    document.querySelectorAll('.cu-hovertabs').forEach(initHoverTabs);
    document.querySelectorAll('[data-back-to-top]').forEach(initBackToTop);
  });
  // ---- Sliders ----------------------------------------------------------------------------------------------
  function icon(name) { return '<svg class="cu-icon" aria-hidden="true" focusable="false"><use href="#cu-i-' + name + '"/></svg>'; }
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Image / banner slider (CDS), with the pause control CDS lacks. Autoplay never starts for reduced motion, stops for good after a
  // control is used or focus enters the slider (as CDS), and a pause/play button is always there while it can autoplay (WCAG 2.2.2).
  // Hovering the slider holds it still without changing the button. As in CDS every caption stays reachable and read out; focusing one shows its slide.
  // The carousel core, shared by the image slider and the slideshow banner: the control bar (Previous, Next, an optional
  // Pause/Play button, a dot per slide), autoplay and the keyboard. The caller draws the slides in apply(i, quick) and mounts
  // the bar. Autoplay stops for good after any control or focus in `root` (the Pause button always works) and never starts
  // with reduced motion. Options: root, n, titles, label, barClass, toggle (show Pause/Play), autoplay, interval (ms),
  // hold (pause while the pointer is over root), apply, paint(playing), mount(bar), slideOf(element) (the slide index a focused element belongs to, or -1).
  function carousel(o) {
    var n = o.n, current = 0, timer, playing = false, held = false;
    var bar = document.createElement('div');
    bar.className = o.barClass; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', o.label + ' controls');
    var html = '<div class="cu-slider__buttons">';
    html += '<button type="button" class="cu-slider__btn" data-act="prev" aria-label="Previous slide">' + icon('chevron_left') + '</button>';
    html += '<button type="button" class="cu-slider__btn" data-act="next" aria-label="Next slide">' + icon('chevron_right') + '</button>';
    if (o.toggle) html += '<button type="button" class="cu-slider__btn" data-act="toggle"></button>';
    html += '</div><span class="cu-sr-only" role="status"></span><ul class="cu-slider__pips" role="list">';
    o.titles.forEach(function (t, i) { html += '<li><button type="button" class="cu-slider__pip" data-go="' + i + '" aria-label="Slide ' + (i + 1) + ' of ' + n + ': ' + t.replace(/"/g, '&quot;') + '"></button></li>'; });
    bar.innerHTML = html + '</ul>';
    o.mount(bar);
    var toggle = bar.querySelector('[data-act="toggle"]');
    var pips = Array.prototype.slice.call(bar.querySelectorAll('.cu-slider__pip'));
    var status = bar.querySelector('[role="status"]');
    function paint() {
      if (toggle) {
        toggle.innerHTML = icon(playing ? 'pause' : 'play_arrow');
        toggle.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
      }
      if (o.paint) o.paint(playing);
    }
    // say = the change came from a control, so say where we are. Focus on a caption already reads that caption, and autoplay is silent.
    function show(i, quick, say) {
      current = (i + n) % n;
      o.apply(current, quick);
      if (say) status.textContent = 'Slide ' + (current + 1) + ' of ' + n + ': ' + o.titles[current];
      pips.forEach(function (p, j) { if (j === current) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
    }
    function tick() { if (!held) show(current + 1, false); }
    function start() { stop(); if (playing) timer = setInterval(tick, o.interval); }
    function stop() { clearInterval(timer); }
    function halt() { if (playing) { playing = false; stop(); paint(); } } // for good, until the Play button
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-go')) { halt(); show(+b.getAttribute('data-go'), true, true); }
      else if (b.getAttribute('data-act') === 'next') { halt(); show(current + 1, true, true); }
      else if (b.getAttribute('data-act') === 'prev') { halt(); show(current - 1, true, true); }
      else if (b.getAttribute('data-act') === 'toggle') { playing = !playing; paint(); if (playing) start(); else stop(); }
    });
    bar.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault(); halt(); show(k, true, true);
      var f = bar.querySelector('[data-go="' + current + '"]');
      if (f && e.target.hasAttribute('data-go')) f.focus();
    });
    o.root.addEventListener('focusin', function (e) {
      if (e.target !== toggle) halt(); // the Pause button itself must be able to pause (a pointer press focuses it first)
      var i = o.slideOf ? o.slideOf(e.target) : -1; // CDS: focus on a caption shows its slide, so Tab walks through the slides
      if (i > -1 && i !== current) show(i, true);
    });
    if (o.hold) {
      o.root.addEventListener('mouseenter', function () { held = true; });
      o.root.addEventListener('mouseleave', function () { held = false; });
    }
    playing = o.autoplay && !calm.matches;
    calm.addEventListener('change', function () { if (calm.matches) halt(); });
    show(0, true);
    paint(); start();
  }

  function initSlider(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.cu-slider__slide'));
    if (slides.length < 2) return;
    var n = slides.length;
    var wantsAuto = root.hasAttribute('data-autoplay');
    var titles = slides.map(function (s, i) {
      var h = s.querySelector('h2, h3, h4');
      s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', (i + 1) + ' of ' + n);
      return h ? h.textContent.trim() : 'Slide ' + (i + 1);
    });
    // A slide may hold a <video> instead of an <img> (class cu-slider__image either way): it has its own Pause / Play button and
    // plays only while its slide is showing.
    var clips = slides.map(function (sl) { var v = sl.querySelector(':scope > video'); return v ? videoControl(v, sl, true) : null; });
    carousel({
      root: root, n: n, titles: titles, label: root.getAttribute('aria-label') || 'Slideshow', barClass: 'cu-slider__controls',
      toggle: wantsAuto, autoplay: wantsAuto, interval: (parseFloat(root.getAttribute('data-interval')) || 8) * 1000, hold: true,
      apply: function (i, quick) {
        root.style.setProperty('--_fade', quick ? '300ms' : '');
        slides.forEach(function (s, j) {
          s.classList.toggle('is-current', j === i);
          if (clips[j]) { if (j === i) clips[j].enter(); else clips[j].leave(); }
        });
      },
      slideOf: function (el) { return slides.indexOf(el.closest('.cu-slider__slide')); },
      mount: function (bar) { root.appendChild(bar); }
    });
    root.style.removeProperty('--_fade');
    root.setAttribute('data-ready', '');
  }

  // Video (blocks/backdrop.css, blocks/slider.css): a muted, looping <video> with a poster and no autoplay attribute, so without script
  // it is a still picture. videoControl() adds the round Pause / Play button to `host` (CDS does the same; WCAG 2.2.2) and keeps it in
  // step with the video, also when the browser pauses it. enter() starts the video unless reduced motion is asked for or the person
  // paused it; leave() stops it (a slide that is not showing). Pausing is the person's choice: only the button undoes it.
  // `labelled` (a video that is one slide of a slider) draws a text button, "Pause video" / "Play video", instead of the round icon: it
  // sits among the slider's own controls and has to read as a separate control for the video, not for the slideshow.
  function videoControl(video, host, labelled) {
    video.muted = true; video.removeAttribute('controls');
    var wrap = document.createElement('div');
    wrap.className = 'cu-backdrop__pause-wrap';
    wrap.innerHTML = '<button class="' + (labelled ? 'cu-slider__video' : 'cu-backdrop__pause') + '" type="button">' +
      '<svg class="cu-icon cu-backdrop__stop" aria-hidden="true" focusable="false"><use href="#cu-i-pause"/></svg>' +
      '<svg class="cu-icon cu-backdrop__play" aria-hidden="true" focusable="false"><use href="#cu-i-play_arrow"/></svg>' + (labelled ? '<span></span>' : '') + '</button>';
    var btn = wrap.firstChild, byPerson = false;
    function paint() {
      btn.classList.toggle('is-paused', video.paused);
      var text = labelled ? (video.paused ? 'Play video' : 'Pause video') : (video.paused ? 'Play background video' : 'Pause background video');
      btn.setAttribute('aria-label', text); // the same words as the visible text (WCAG 2.5.3)
      if (labelled) btn.lastChild.textContent = text;
    }
    function play() { var p = video.play(); if (p && p.catch) p.catch(paint); } // a browser may refuse: then it stays a picture, and the button says Play
    btn.addEventListener('click', function () { byPerson = !video.paused; if (video.paused) play(); else video.pause(); });
    video.addEventListener('play', paint); video.addEventListener('pause', paint);
    calm.addEventListener('change', function () { if (calm.matches) video.pause(); });
    host.appendChild(wrap); paint();
    return {
      enter: function () { if (!byPerson && !calm.matches) play(); },
      leave: function () { video.pause(); try { video.currentTime = 0; } catch (e) { /* not loaded yet */ } }
    };
  }
  function initBackdropVideo(root) {
    var video = root.querySelector(':scope > video');
    if (video) videoControl(video, root).enter();
  }

  // Card slider (CDS): the cards scroll natively (snap); script adds previous/next and a pip per screen and keeps them in step.
  var cardSliders = 0;
  function initCardSlider(root) {
    var view = root.querySelector('.cu-card-slider__viewport');
    var cards = root.querySelectorAll('.cu-cards__card');
    if (!view || cards.length < 2) return;
    cardSliders++;
    var label = root.getAttribute('aria-label') || 'Cards';
    var nav = document.createElement('div');
    nav.className = 'cu-card-slider__nav';
    nav.innerHTML = '<button type="button" class="cu-card-slider__btn cu-card-slider__prev" aria-label="Previous cards">' + icon('chevron_left') + '</button>' +
      '<button type="button" class="cu-card-slider__btn cu-card-slider__next" aria-label="Next cards">' + icon('chevron_right') + '</button>';
    var pipList = document.createElement('ul');
    pipList.className = 'cu-card-slider__pips'; pipList.setAttribute('role', 'list');
    pipList.setAttribute('aria-label', label + ' screens');
    if (root.classList.contains('cu-card-slider--pips-bottom')) root.appendChild(pipList); else root.insertBefore(pipList, view);
    root.appendChild(nav);
    var prev = nav.querySelector('.cu-card-slider__prev'), next = nav.querySelector('.cu-card-slider__next');
    var pages = 1, page = 0;
    function behavior() { return calm.matches ? 'auto' : 'smooth'; }
    function measure() {
      pages = Math.max(1, Math.ceil(view.scrollWidth / view.clientWidth - 0.1));
      var max = view.scrollWidth - view.clientWidth;
      page = max <= 1 ? 0 : Math.min(pages - 1, Math.round(view.scrollLeft / max * (pages - 1)));
      if (pipList.children.length !== pages) {
        pipList.innerHTML = '';
        for (var i = 0; i < pages; i++) {
          var li = document.createElement('li');
          li.innerHTML = '<button type="button" class="cu-card-slider__pip" aria-label="Screen ' + (i + 1) + ' of ' + pages + '"></button>';
          li.firstChild.setAttribute('data-page', String(i)); pipList.appendChild(li);
        }
      }
      Array.prototype.forEach.call(pipList.querySelectorAll('.cu-card-slider__pip'), function (b, i) {
        if (i === page) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      prev.setAttribute('aria-disabled', page === 0 ? 'true' : 'false');
      next.setAttribute('aria-disabled', page >= pages - 1 ? 'true' : 'false');
      nav.hidden = pipList.hidden = pages < 2;
    }
    function go(i) {
      i = Math.max(0, Math.min(pages - 1, i));
      var max = view.scrollWidth - view.clientWidth;
      view.scrollTo({ left: i === pages - 1 ? max : i * view.clientWidth, behavior: behavior() });
    }
    prev.addEventListener('click', function () { if (prev.getAttribute('aria-disabled') !== 'true') go(page - 1); });
    next.addEventListener('click', function () { if (next.getAttribute('aria-disabled') !== 'true') go(page + 1); });
    pipList.addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) go(+b.getAttribute('data-page')); });
    var raf;
    view.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); }, { passive: true });
    window.addEventListener('resize', measure);
    root.setAttribute('data-ready', '');
    measure();
  }
  // Motion (blocks/motion.css; CDS cds_motion.js). Reveals: an element is marked .is-scripted (only then does CSS hide
  // it) and gets .is-revealed once, when its top reaches 85% of the viewport height (cu-motion-onload: as soon as any
  // of it is on screen). Focus inside an unrevealed element reveals it at once. Parallax: translateY moves from
  // +range to -range while the element crosses the viewport, range = a quarter of its height (at least 30px), as in
  // CDS. With prefers-reduced-motion everything is revealed at once and parallax does not run.
  function initMotion() {
    var reveals = Array.prototype.slice.call(document.querySelectorAll('.cu-motion-fadein, .cu-motion-slidein, .cu-motion-custom'));
    var parallax = Array.prototype.slice.call(document.querySelectorAll('.cu-motion-parallax'));
    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    function reveal(el) { el.classList.add('is-revealed'); }
    reveals.forEach(function (el) {
      el.classList.add('is-scripted');
      el.addEventListener('focusin', function () { reveal(el); });
    });
    if (still.matches || !('IntersectionObserver' in window)) {
      reveals.forEach(reveal);
    } else {
      var later = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); later.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -15% 0px' });
      var now = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); now.unobserve(e.target); } });
      });
      reveals.forEach(function (el) { (el.classList.contains('cu-motion-onload') ? now : later).observe(el); });
    }
    if (!parallax.length) return;
    var raf = 0;
    function drift() {
      raf = 0;
      if (still.matches) { parallax.forEach(function (el) { el.style.transform = ''; }); return; }
      var vh = window.innerHeight;
      parallax.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var h = Math.max(r.height, 120);
        var range = h / 4;
        // where the element is in its pass across the viewport: 0 entering at the bottom, 1 leaving at the top
        var t = Math.min(1, Math.max(0, (vh - (r.top - parseFloat(el.dataset.cuDrift || 0))) / (vh + r.height)));
        var y = Math.round(range - 2 * range * t);
        el.dataset.cuDrift = y;
        el.style.transform = 'translateY(' + y + 'px)';
      });
    }
    function queue() { if (!raf) raf = requestAnimationFrame(drift); }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    still.addEventListener('change', queue);
    drift();
  }
  // Mode switch (blocks/modeswitch.css): Automatic removes data-mode (follow the OS), Light/Dark set it on <html>.
  // Remembered under the same key the app uses (cu-mode); storage can be refused, so it is guarded.
  function initModeSwitch(set) {
    var root = document.documentElement;
    var now = root.getAttribute('data-mode') || 'auto';
    set.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.checked = r.value === now;
      r.addEventListener('change', function () {
        if (!r.checked) return;
        if (r.value === 'auto') root.removeAttribute('data-mode'); else root.setAttribute('data-mode', r.value);
        try { if (r.value === 'auto') localStorage.removeItem('cu-mode'); else localStorage.setItem('cu-mode', r.value); } catch (e) {}
      });
    });
  }
  // App shell (blocks/app.css). From 960px the menu sits beside the content and the toggle hides or shows it
  // (remembered as cu-app-nav). Below 960px it opens over the content as a modal panel, like the CDS mobile menu:
  // focus moves to Close and stays inside, everything else is inert, Escape / Close / the scrim close it and
  // return focus to the toggle. Without script (.is-scripted missing) the menu is simply always shown.
  function initApp(app) {
    var toggle = app.querySelector('.cu-app__toggle');
    var nav = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!nav) return;
    var scrim = app.querySelector('.cu-app__scrim');
    var closeBtn = nav.querySelector('.cu-app__close');
    var wide = window.matchMedia('(min-width: 960px)');
    var stored = null;
    try { stored = localStorage.getItem('cu-app-nav'); } catch (e) {}
    var wideOpen = stored !== 'closed';
    app.classList.add('is-scripted');
    function behind(on) {
      setInert(pageBeside(app), on);
      setInert(Array.prototype.slice.call(app.querySelectorAll('.cu-header--app, .cu-app__main')), on);
    }
    function render(focus) {
      var open = wide.matches ? wideOpen : app.getAttribute('data-nav') === 'open';
      app.setAttribute('data-nav', open ? 'open' : 'closed');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var modal = open && !wide.matches;
      modalPanel(nav, modal, true);
      if (scrim) scrim.hidden = !modal;
      behind(modal);
      if (modal && focus) (closeBtn || nav).focus();
    }
    function set(open, focusToggle) {
      if (wide.matches) {
        wideOpen = open;
        try { localStorage.setItem('cu-app-nav', open ? 'open' : 'closed'); } catch (e) {}
      }
      app.setAttribute('data-nav', open ? 'open' : 'closed');
      render(open);
      if (!open && focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function () { set(toggle.getAttribute('aria-expanded') !== 'true'); });
    app.querySelectorAll('[data-app-close]').forEach(function (el) {
      el.addEventListener('click', function () { set(false, true); });
    });
    nav.addEventListener('keydown', function (e) {
      if (wide.matches || app.getAttribute('data-nav') !== 'open') return;
      if (e.key === 'Escape') { set(false, true); return; }
      wrapTab(e, nav);
    });
    // a link in the overlay menu closes it (in an app the route changes; here the page would reload)
    nav.addEventListener('click', function (e) { if (!wide.matches && e.target.closest('a[href]')) set(false); });
    wide.addEventListener('change', function () { if (!wide.matches) app.setAttribute('data-nav', 'closed'); render(false); });
    if (!wide.matches) app.setAttribute('data-nav', 'closed');
    render(false);
    // slide only from here on: the state at load is drawn as it is, without moving
    requestAnimationFrame(function () { requestAnimationFrame(function () { app.classList.add('is-ready'); }); });
  }
  // Agent chat (blocks/chat.css). The launcher opens a non-modal dialog and hides; focus moves to the message field;
  // Escape or Minimize closes it and focus returns to the launcher. The demo answers with a canned reply.
  // Focus never leaks out of the panel by keyboard: Tab and Shift+Tab wrap inside it (Escape is the way out), and a
  // click on blank space inside it keeps focus in the panel (tabindex -1), so Escape and the wrap keep working.
  // The pointer can still use the page behind it. On phones the panel fills the screen, so it is modal there:
  // aria-modal, and the page behind is inert.
  // Moving the chat (blocks/chat.css, the console's dock grip). Two grip buttons are added: beside the launcher and at the start
  // of the panel's bar. A pointer drags either; focused, the arrow keys move the chat 20px (80px with Shift) and End puts it
  // back in the corner. The offset lives on the container (--chat-x / --chat-y) and is clamped so the chat cannot leave the
  // screen, even after a resize or when the panel opens and the box gets bigger. The grip keeps focus while it moves, and a
  // polite status line speaks only for the two events a person cannot see: reaching an edge, and returning to the corner.
  function initChatGrip(root, launcher, panel) {
    var LABEL = 'Move the chat. Drag, or use the arrow keys; End returns it to the corner';
    var x = 0, y = 0;
    var status = document.createElement('span');
    status.className = 'cu-sr-only'; status.setAttribute('role', 'status');
    root.appendChild(status);
    function make(extra) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cu-chat__grip ' + extra; b.setAttribute('aria-label', LABEL);
      b.innerHTML = '<svg class="cu-icon" aria-hidden="true" focusable="false"><use href="#cu-i-drag_indicator"/></svg>';
      return b;
    }
    var grips = [make('cu-chat__grip--pill'), make('cu-chat__grip--bar')];
    root.insertBefore(grips[0], launcher);
    var bar = panel.querySelector('.cu-chat__bar');
    if (bar) bar.insertBefore(grips[1], bar.firstChild);
    // The nearest legal offset: the box stays inside the window, one gap in from every edge (the gap the corner already has).
    function clamp(nx, ny) {
      var r = root.getBoundingClientRect(), gap = parseFloat(getComputedStyle(root).insetInlineEnd) || 20;
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      function fit(v, lo, hi) { return lo > hi ? 0 : Math.min(hi, Math.max(lo, v)); }
      return {
        x: fit(nx, gap - (r.left - x), vw - gap - (r.right - x)),
        y: fit(ny, gap - (r.top - y), vh - gap - (r.bottom - y))
      };
    }
    function set(c) {
      x = Math.round(c.x); y = Math.round(c.y);
      if (x || y) { root.style.setProperty('--chat-x', x + 'px'); root.style.setProperty('--chat-y', y + 'px'); }
      else { root.style.removeProperty('--chat-x'); root.style.removeProperty('--chat-y'); }
    }
    function reclamp() { var c = clamp(x, y); if (Math.round(c.x) !== x || Math.round(c.y) !== y) set(c); }
    function say(text) { status.textContent = ''; setTimeout(function () { status.textContent = text; }, 30); }
    var edges = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' };
    grips.forEach(function (g) {
      g.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        var step = e.shiftKey ? 80 : 20, nx = x, ny = y;
        if (e.key === 'ArrowLeft') nx -= step; else if (e.key === 'ArrowRight') nx += step;
        else if (e.key === 'ArrowUp') ny -= step; else if (e.key === 'ArrowDown') ny += step;
        else if (e.key === 'End') { e.preventDefault(); set({ x: 0, y: 0 }); say('The chat is back in the corner.'); return; }
        else return;
        e.preventDefault();
        var c = clamp(nx, ny), moved = Math.round(c.x) !== x || Math.round(c.y) !== y;
        set(c);
        if (!moved || Math.round(c.x) !== Math.round(nx) || Math.round(c.y) !== Math.round(ny)) say('The chat is at the ' + edges[e.key] + ' edge of the screen.');
      });
      g.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault(); // no text selection, no native drag, and the click never reaches the launcher or the panel
        g.focus(); // Safari does not focus a button on click: keep focus on the grip, inside the panel when it is open
        var sx = e.clientX, sy = e.clientY, ox = x, oy = y;
        g.setPointerCapture(e.pointerId);
        function move(m) { set(clamp(ox + m.clientX - sx, oy + m.clientY - sy)); }
        function stop() { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', stop); g.removeEventListener('pointercancel', stop); }
        g.addEventListener('pointermove', move); g.addEventListener('pointerup', stop); g.addEventListener('pointercancel', stop);
      });
    });
    window.addEventListener('resize', reclamp);
    return { reclamp: reclamp };
  }
  function initChat(root) {
    var launcher = root.querySelector('.cu-chat__launcher');
    var panel = launcher && document.getElementById(launcher.getAttribute('aria-controls'));
    if (!panel) return;
    var grip = initChatGrip(root, launcher, panel);
    var field = panel.querySelector('textarea'), log = panel.querySelector('.cu-chat__log'), form = panel.querySelector('form');
    var phone = window.matchMedia('(max-width: 767px)');
    var inerted = [];
    panel.setAttribute('tabindex', '-1');
    function isOpen() { return panel.hasAttribute('open'); }
    function behind(on) {
      setInert(inerted, false);
      inerted = on ? pageBeside(root).filter(function (el) { return !el.hasAttribute('inert'); }) : [];
      setInert(inerted, true);
    }
    function sync() {
      var modal = isOpen() && phone.matches;
      modalPanel(panel, modal);
      behind(modal);
    }
    function open() {
      if (typeof panel.show === 'function') panel.show(); else panel.setAttribute('open', '');
      launcher.setAttribute('aria-expanded', 'true');
      sync();
      grip.reclamp();
      if (field) field.focus();
    }
    function close() {
      if (typeof panel.close === 'function') panel.close(); else panel.removeAttribute('open');
      launcher.setAttribute('aria-expanded', 'false');
      sync();
      grip.reclamp();
      launcher.focus();
    }
    phone.addEventListener('change', sync);
    // safety net on phones: nothing outside the panel may take focus while it is modal
    document.addEventListener('focusin', function (e) {
      if (!isOpen() || !phone.matches || root.contains(e.target)) return;
      var f = stopsIn(panel); if (f.length) f[0].focus();
    });
    panel.addEventListener('keydown', function (e) { wrapTab(e, panel); });
    function say(text, who) {
      var p = document.createElement('p');
      p.className = 'cu-chat__msg cu-chat__msg--' + who;
      p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    }
    launcher.addEventListener('click', open);
    panel.querySelectorAll('[data-chat-close]').forEach(function (b) { b.addEventListener('click', close); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    panel.querySelectorAll('[data-chat-prompt]').forEach(function (b) {
      b.addEventListener('click', function () { field.value = b.textContent; form.requestSubmit(); });
    });
    if (field) field.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = field.value.trim();
      if (!text) return;
      say(text, 'user');
      field.value = '';
      setTimeout(function () { say('This is a demo of the chat panel: in the app, the agent answers here.', 'agent'); }, 400);
    });
  }
  // A scrollable region is a tab stop (WCAG 2.1.1) only while its content really overflows: a table that fits is not a place to
  // stop. The markup keeps tabindex="0" on a role="region" with a name (so it works without script, and a keyboard can always
  // reach a table that scrolls); this removes the stop while nothing scrolls and puts it back when the window narrows.
  function initScrollRegion(el) {
    function measure() {
      var scrolls = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      if (scrolls) el.setAttribute('tabindex', '0'); else el.removeAttribute('tabindex');
    }
    measure();
    if (typeof ResizeObserver === 'undefined') { el.setAttribute('tabindex', '0'); return; }
    var ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
  }
  // Density switch on the showcase pages: ?density=compact, or a control with [data-density-switch].
  function initDensitySwitch(set) {
    var root = document.documentElement;
    set.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.checked = r.value === (root.getAttribute('data-density') || 'default');
      r.addEventListener('change', function () {
        if (!r.checked) return;
        if (r.value === 'default') root.removeAttribute('data-density'); else root.setAttribute('data-density', r.value);
      });
    });
  }
  if (q.get('density') === 'compact') document.documentElement.setAttribute('data-density', 'compact');
  if (q.get('density') === 'website') document.documentElement.removeAttribute('data-density');
  if (q.get('headings') === 'sans') document.documentElement.setAttribute('data-headings', 'sans');
  // Slideshow banner (blocks/header.css): pictures cross-fade behind the whole header (decoration, hidden from assistive
  // technology); under the seal and title sit the caption of the current slide and its controls (Previous, Next, Pause, one
  // dot per slide), the carousel pattern of initSlider() above. Autoplay never starts with reduced motion, stops for good
  // after Previous / Next / a dot, and the Pause button always works.
  function initBannerSlides(header, slidesData) {
    var n = slidesData.length;
    var layer = document.createElement('div');
    layer.className = 'cu-header__slides'; layer.setAttribute('aria-hidden', 'true');
    // A slide may carry a video (d.video: [url, ...], WebM before MP4) over its picture, which shows until the video has a frame (and
    // stays for reduced motion). The video plays only while its slide is showing, and the controls get a Pause / Play video button
    // while it is (the pictures are hidden from assistive technology, so the button cannot live there).
    var vids = [];
    var pics = slidesData.map(function (d, i) {
      var e = document.createElement('div');
      e.className = 'cu-header__slide' + (i === 0 ? ' is-current' : ''); e.style.backgroundImage = d.src; layer.appendChild(e);
      var v = null;
      if (d.video && d.video.length) {
        v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
        d.video.forEach(function (u) { var so = document.createElement('source'); so.src = u; so.type = /\.webm$/.test(u) ? 'video/webm' : 'video/mp4'; v.appendChild(so); });
        e.appendChild(v);
      }
      vids.push(v); return e;
    });
    header.classList.add('cu-header--photo', 'cu-header--slides');
    header.insertBefore(layer, header.firstChild);
    if (n < 2) return;
    var label = 'Featured stories';
    var feature = document.createElement('section');
    feature.className = 'cu-header__feature'; feature.setAttribute('aria-roledescription', 'carousel'); feature.setAttribute('aria-label', label);
    var html = '<div class="cu-container"><div class="cu-header__captions">';
    slidesData.forEach(function (d, i) {
      html += '<div class="cu-header__caption' + (i === 0 ? ' is-current' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '"' + '>' +
        '<h2>' + d.title + '</h2><p>' + d.text + (d.link ? ' <a href="#">' + d.link + '</a>' : '') + '</p></div>';
    });
    feature.innerHTML = html + '</div></div>';
    header.appendChild(feature);
    var caps = Array.prototype.slice.call(feature.querySelectorAll('.cu-header__caption'));
    var vbtn = null, shown = 0, byPerson = [];
    function vpaint() {
      var v = vids[shown]; if (!vbtn) return;
      vbtn.hidden = !v; if (!v) return;
      var text = v.paused ? 'Play video' : 'Pause video';
      vbtn.innerHTML = icon(v.paused ? 'play_arrow' : 'pause') + '<span>' + text + '</span>';
      vbtn.setAttribute('aria-label', text);
    }
    function vplay(v) { var pr = v.play(); if (pr && pr.catch) pr.catch(vpaint); }
    vids.forEach(function (v) { if (v) { v.addEventListener('play', vpaint); v.addEventListener('pause', vpaint); } });
    calm.addEventListener('change', function () { if (calm.matches) vids.forEach(function (v) { if (v) v.pause(); }); });
    carousel({
      root: feature, n: n, titles: slidesData.map(function (d) { return d.title; }), label: label, barClass: 'cu-header__controls',
      toggle: !calm.matches, autoplay: true, interval: 6000,
      apply: function (i) {
        pics.forEach(function (e, j) { e.classList.toggle('is-current', j === i); });
        caps.forEach(function (e, j) { e.classList.toggle('is-current', j === i); });
        shown = i;
        vids.forEach(function (v, j) {
          if (!v) return;
          if (j === i) { if (!byPerson[j] && !calm.matches) vplay(v); } else { v.pause(); try { v.currentTime = 0; } catch (e) { /* not loaded yet */ } }
        });
        vpaint();
      },
      slideOf: function (el) { return caps.indexOf(el.closest('.cu-header__caption')); },
      mount: function (bar) {
        feature.firstChild.appendChild(bar);
        if (!vids.some(Boolean)) return;
        vbtn = document.createElement('button'); vbtn.type = 'button'; vbtn.className = 'cu-slider__video'; vbtn.setAttribute('data-act', 'video');
        vbtn.addEventListener('click', function () { var v = vids[shown]; if (!v) return; byPerson[shown] = !v.paused; if (v.paused) vplay(v); else v.pause(); });
        bar.appendChild(vbtn); vpaint(); // its own control after the dots, with its own words, apart from the slideshow's buttons
      }
    });
  }

  // The look options the customizer previews (customizer.html): the public header's style, the header nav's
  // alignment and current-page style, and whether the footer offers the Appearance switch.
  function applyLookParams() {
    var header = q.get('header'), nav = q.get('nav'), sw = q.get('modeswitch'), topbar = q.get('topbar'), photo = q.get('photo');
    if (header) document.querySelectorAll('body > header.cu-header, .cu-page > header.cu-header').forEach(function (h) { h.setAttribute('data-theme', header); });
    // topbar=line: the home header with no utility bar, only the 4px line (the Search button stays as the red tab)
    if (topbar === 'line') document.querySelectorAll('body > header.cu-header, .cu-page > header.cu-header').forEach(function (h) {
      var u = h.querySelector(':scope > .cu-utility'); if (u) u.remove();
    });
    // photo=1|2|3: the banner over one sample picture from images/; photo=slides: all three cross-fade as a slideshow (video=2: slide 2 is a video)
    // (an app sets its own image URLs). height=medium|tall makes the banner taller, with the navigation under the logo and the picture below it.
    var heads = document.querySelectorAll('body > header.cu-header, .cu-page > header.cu-header');
    var img = function (n) { return 'url("' + new URL('images/banner-' + n + '.svg', document.baseURI).href + '")'; };
    var sample = [
      { title: 'Build with AI, the Cornell way', text: 'Shared tools, patterns and support for teams across campus.', link: 'Explore tools' },
      { title: 'Ask the AI Innovation Lab', text: 'Office hours and worked examples for your project.', link: 'Request access' },
      { title: 'One set of design tokens', text: 'Every page here is built from the same blocks.', link: 'See the design system' }
    ];
    // video=2 puts the sample video on the second slide of the slideshow (WebM first, MP4 for older Safari)
    var clip = function (n) { return q.get('video') === String(n) ? { video: ['images/video-demo.webm', 'images/video-demo.mp4'].map(function (u) { return new URL(u, document.baseURI).href; }) } : {}; };
    if (photo === 'slides') heads.forEach(function (h) { initBannerSlides(h, sample.map(function (d, i) { return Object.assign({ src: img(i + 1) }, d, clip(i + 1)); })); });
    else if (photo) heads.forEach(function (h) {
      h.classList.add('cu-header--photo'); h.style.setProperty('--header-photo', /^[123]$/.test(photo) ? img(photo) : 'linear-gradient(135deg,#2d668e,#073949)');
    });
    if (q.get('logo') === 'right') heads.forEach(function (h) { h.classList.add('cu-header--logo-right'); });
    var height = q.get('height');
    if (height === 'medium' || height === 'tall') heads.forEach(function (h) { h.classList.add('cu-header--' + height); });
    if (nav) document.querySelectorAll('header.cu-header nav.cu-nav').forEach(function (n) {
      n.className = 'cu-nav' + nav.split(',').filter(function (m) { return /^[a-z-]+$/.test(m); }).map(function (m) { return ' cu-nav--' + m; }).join('');
    });
    if (sw === '0') document.querySelectorAll('.cu-footer .cu-mode-switch').forEach(function (f) { var li = f.closest('li'); (li || f).hidden = true; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    applyLookParams();
    document.querySelectorAll('.cu-app').forEach(initApp);
    document.querySelectorAll('.cu-chat').forEach(initChat);
    document.querySelectorAll('.cu-table-wrap[role="region"][tabindex]').forEach(initScrollRegion);
    document.querySelectorAll('[data-density-switch]').forEach(initDensitySwitch);
    document.querySelectorAll('.cu-slider').forEach(initSlider);
    document.querySelectorAll('.cu-mode-switch:not([data-density-switch])').forEach(initModeSwitch);
    document.querySelectorAll('.cu-card-slider').forEach(initCardSlider);
    document.querySelectorAll('.cu-backdrop').forEach(initBackdropVideo);
    initMotion();
  });
})();
