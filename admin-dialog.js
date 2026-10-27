/* ============================================================
   Общий диалог кабинета: window.AdminDialog
   open({title, body, actions, onOpen}) -> Promise<value|null>
   confirm({title, text, ok, cancel, danger}) -> Promise<boolean>
   Подробности — docs/admin-design-system.md, раздел «Диалог».
   ============================================================ */
(function () {
  "use strict";

  var seq = 0;
  var stack = [];            // открытые диалоги (последний — верхний)
  var FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  function open(opts) {
    opts = opts || {};
    var id = "dlgT" + (++seq);
    var opener = document.activeElement;
    var actions = opts.actions && opts.actions.length ? opts.actions
      : [{ label: "Закрыть", kind: "plain", value: true }];

    return new Promise(function (resolve) {
      var back = document.createElement("div");
      back.className = "dlg-back";
      back.innerHTML =
        '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
          '<div class="dlg-head"><h2 class="dlg-title" id="' + id + '">' + esc(opts.title) + '</h2>' +
          '<button type="button" class="dlg-x" aria-label="Закрыть">×</button></div>' +
          '<div class="dlg-body"></div>' +
          '<div class="dlg-actions"></div>' +
        '</div>';
      var box = back.firstChild;
      var bodyEl = box.querySelector(".dlg-body");
      var actsEl = box.querySelector(".dlg-actions");

      if (opts.body instanceof Node) bodyEl.appendChild(opts.body);
      else bodyEl.innerHTML = opts.body == null ? "" : String(opts.body);

      var done = false;
      var entry = { back: back, onKey: null };

      function close(value) {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", entry.onKey, true);
        stack.splice(stack.indexOf(entry), 1);
        back.remove();
        if (!stack.length) document.body.classList.remove("dlg-lock");
        if (opener && opener.focus && document.contains(opener)) opener.focus();
        resolve(value);
      }

      actions.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        var kind = a.kind || "plain";
        b.className = "btn " + (kind === "primary" ? "btn-gold" : kind === "danger" ? "dlg-danger" : "btn-plain");
        b.textContent = a.label;
        b.addEventListener("click", function () {
          if (typeof a.validate === "function" && a.validate(box) === false) return;
          close(a.value === undefined ? null : a.value);
        });
        actsEl.appendChild(b);
      });

      entry.onKey = function (e) {
        if (stack[stack.length - 1] !== entry) return;   // только верхний диалог
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); return; }
        if (e.key !== "Tab") return;
        var f = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), visible);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], cur = document.activeElement;
        if (!box.contains(cur)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener("keydown", entry.onKey, true);

      back.addEventListener("mousedown", function (e) { if (e.target === back) close(null); });
      box.querySelector(".dlg-x").addEventListener("click", function () { close(null); });

      stack.push(entry);
      document.body.classList.add("dlg-lock");
      document.body.appendChild(back);

      if (typeof opts.onOpen === "function") opts.onOpen(box);

      // фокус: первое поле тела, иначе первая кнопка действий
      var field = bodyEl.querySelector(FOCUSABLE);
      (field || actsEl.querySelector("button") || box.querySelector(".dlg-x")).focus();
    });
  }

  function confirm(o) {
    o = o || {};
    return open({
      title: o.title || "Подтверждение",
      body: o.text ? "<p>" + esc(o.text) + "</p>" : "",
      actions: [
        { label: o.cancel || "Отмена", kind: "plain", value: false },
        { label: o.ok || "Продолжить", kind: o.danger ? "danger" : "primary", value: true }
      ]
    }).then(function (v) { return v === true; });
  }

  window.AdminDialog = { open: open, confirm: confirm };
})();
