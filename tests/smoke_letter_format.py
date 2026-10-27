"""Смоук форматирования текста, переменных, отписки и кнопки без ссылки:
python3 tests/smoke_letter_format.py"""
import http.server, os, socket, sys, threading, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []

def check(cond, msg):
    if not cond:
        fails.append(msg)
        print("  FAIL:", msg)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % port

UNSUB = 'Вы получили это письмо, потому что подписаны на рассылку. <a href="{{unsubscribe_url}}">Отписаться</a>'
TA = '.lt-pane textarea[data-f="text"]'

def frame(page, sel=".lt-frame"):
    return page.frame_locator(sel).locator("body")

def confirm_dialog(page):
    page.wait_for_selector(".dlg[role=dialog]")
    page.click(".dlg-actions button:last-child")
    page.wait_for_selector(".dlg", state="detached")

def add_block(page, kind):
    page.locator(".lt-add-btn").last.click()
    page.click('.lt-pal[data-make="%s"]' % kind)

def set_text(page, value):
    page.fill(TA, value)
    page.dispatch_event(TA, "change")

def select_range(page, sel, a, b):
    page.evaluate("([s,a,b]) => { const t = document.querySelector(s); t.focus(); t.setSelectionRange(a,b); }", [sel, a, b])

def code(page):
    page.click('[data-mode="code"]')
    v = page.input_value(".lt-code textarea")
    page.click('[data-mode="edit"]')
    return v

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "fonts.g" not in m.text and errors.append(m.text))

        page.goto(BASE + "mailing.html")
        page.wait_for_function("window.AdminLetter && window.AdminLetter.renderVars && window.AdminStore")
        rt = lambda t: page.evaluate("t => AdminLetter.richText(t)", t)

        # ---- richText: G8 — без разметки как раньше ----
        plain = 'Привет, <мир> & "друзья"\nвторая строка\n\nчетвёртая — 5*3 = 15, snake_case_name'
        old = page.evaluate("""t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c])
                                       .replace(/\\n/g, '<br />')""", plain)
        check(rt(plain) == old, "текст без разметки рендерится как раньше: %r" % rt(plain))
        check(rt("**ж** и _к_") == "<strong>ж</strong> и <em>к</em>", "жирный/курсив: %r" % rt("**ж** и _к_"))
        r = rt("[сайт](https://x.ru/a_b_c?x=1&y=2)")
        check(r == '<a href="https://x.ru/a_b_c?x=1&amp;y=2" style="color:inherit;text-decoration:underline">сайт</a>',
              "https-ссылка: %r" % r)
        check('href="mailto:a@b.ru"' in rt("[почта](mailto:a@b.ru)"), "mailto-ссылка")
        check('href="{{unsubscribe_url}}"' in rt("[отписка]({{unsubscribe_url}})"), "ссылка на переменную")
        bad = rt("[сайт](javascript:alert(1))")
        check("<a" not in bad and "сайт" in bad, "javascript: остаётся текстом: %r" % bad)
        check("<a" not in rt("[x](data:text/html,1)"), "data: остаётся текстом")
        check("<script" not in rt("**<script>x</script>**"), "теги экранированы внутри разметки")
        lst = rt("до\n- раз\n- два\nпосле")
        check(lst.count("<li") == 2 and lst.count("<ul") == 1 and lst.startswith("до<ul") and lst.endswith("</ul>после"),
              "строки «- » -> список: %r" % lst)
        check("<em>" not in rt("{{event_title}} и {{unsubscribe_url}}"), "«_» в переменных не даёт курсив")

        # ---- renderVars ----
        rv = page.evaluate("AdminLetter.renderVars('{{name}}|{{email}}|{{event_title}}|{{unsubscribe_url}}|{{foo}}')")
        ev = page.evaluate("AdminStore.state.EVENTS[0].title")
        check(rv == "Анна|anna@example.ru|%s|https://tvorchestvo.ru/unsubscribe?u=demo|{{foo}}" % ev, "renderVars: %r" % rv)

        # ---- линтер: неизвестная переменная, дыры прошлых правил ----
        full = '<html><body><table width="600"><tr><td><a href="https://x.ru">a</a> {{name}}</td></tr></table></body></html>'
        texts = lambda h: " | ".join(n["text"] for n in page.evaluate("h => AdminLetter.lintHtml(h)", h))
        check(texts(full) == "", "известные переменные без замечаний: %s" % texts(full))
        check("Неизвестная переменная" in texts(full.replace("{{name}}", "{{fio}}")), "{{fio}} -> warn")
        check("Пустая ссылка" in texts(full.replace('href="https://x.ru"', "href=#")), "href=# без кавычек -> warn")
        check("Пустая ссылка" in texts(full.replace('href="https://x.ru"', "href")), "<a href> без значения -> warn")
        check("Пустая ссылка" not in texts(full.replace('href="https://x.ru"', 'href= "https://x.ru"')), "href= \"…\" не пустая")
        check("data-URL" in texts(full.replace("<td>", '<td background="data:image/png;base64,AA">')), "background=data: -> warn")
        check("data-URL" in texts(full.replace("<td>", '<td style="background:url(data:image/png;base64,AA)">')), "url(data:) -> warn")

        # ---- toHtml: строка отписки ----
        th = lambda L: page.evaluate("L => AdminLetter.toHtml(L)", L)
        st = page.evaluate("() => ({bg:'#F2F5F9',canvas:'#FFFFFF',border:'',radius:0,font:'modern',ink:'#132437'})")
        h1 = th({"style": st, "blocks": [{"t": "text", "text": "x", "size": 15, "align": "left", "color": ""}]})
        check(h1.count(UNSUB) == 1 and h1.index(UNSUB) < h1.index("</table>"), "блоки: строка отписки в каркасе")
        check(th({"style": st, "blocks": [{"t": "text", "text": "[Отписка]({{unsubscribe_url}})", "size": 15,
                                          "align": "left", "color": ""}]}).count("unsubscribe_url") == 1,
              "есть {{unsubscribe_url}} — строку не добавляем")
        h2 = th({"mode": "html", "html": "<html><body><table></table></body></html>", "blocks": []})
        check(h2.count(UNSUB) == 1 and h2.index(UNSUB) < h2.index("</body>"), "html: строка перед </body>")
        check(th({"mode": "html", "html": h2, "blocks": []}) == h2, "повторный toHtml без дубля")

        # ---- G8: все письма из S.MAILINGS рендерятся ----
        res = page.evaluate("""() => AdminStore.state.MAILINGS.items.map(m => {
            try { const h = AdminLetter.toHtml(m.letter); return h.length > 0 && h.includes('</html>') ? 'ok' : 'empty ' + m.id; }
            catch (e) { return 'err ' + m.id + ': ' + e.message; } })""")
        check(len(res) > 0 and all(r == "ok" for r in res), "письма S.MAILINGS: %s" % res)

        # ---- UI: выделить слово -> «Ж» ----
        add_block(page, "text")
        set_text(page, "Привет мир")
        select_range(page, TA, 7, 10)
        page.click('.lt-fmt button[aria-label="Жирный"]')
        check(page.input_value(TA) == "Привет **мир**", "«Ж» оборачивает выделение: %r" % page.input_value(TA))
        for lab in ["Жирный", "Курсив", "Ссылка", "Список", "Переменная"]:
            check(page.locator('.lt-pane .lt-fmt button[aria-label="%s"]' % lab).count() == 1, "кнопка «%s»" % lab)
        check(page.inner_html(".lt-canvas strong") == "мир", "жирный на холсте")
        page.click('[data-mode="preview"]')
        check(frame(page).locator("strong").inner_text(timeout=5000) == "мир", "<strong> в предпросмотре")
        page.click('[data-mode="edit"]')

        # курсив, ссылка, список
        page.click(".lt-canvas .lt-b")
        select_range(page, TA, 0, 6)
        page.click('.lt-fmt button[aria-label="Курсив"]')
        check(page.input_value(TA) == "_Привет_ **мир**", "«К»: %r" % page.input_value(TA))
        select_range(page, TA, 9, 16)
        page.click('.lt-fmt button[aria-label="Ссылка"]')
        check(page.input_value(TA) == "_Привет_ [**мир**](https://)", "«Ссылка»: %r" % page.input_value(TA))
        page.keyboard.type("x.ru")
        check(page.input_value(TA) == "_Привет_ [**мир**](https://x.ru)", "курсор после https://")
        set_text(page, "раз\nдва")
        select_range(page, TA, 0, 7)
        page.click('.lt-fmt button[aria-label="Список"]')
        check(page.input_value(TA) == "- раз\n- два", "«Список»: %r" % page.input_value(TA))
        check(page.locator(".lt-canvas li").count() == 2, "список на холсте")

        # javascript: не даёт ссылки
        set_text(page, "[сайт](javascript:alert(1))")
        page.click('[data-mode="preview"]')
        check(frame(page).locator("a").filter(has_text="сайт").count() == 0, "javascript: — без ссылки в предпросмотре")
        check("[сайт](javascript:alert(1))" in frame(page).inner_text(timeout=5000), "javascript: — текстом")
        page.click('[data-mode="edit"]')

        # переменная в позицию курсора
        page.click(".lt-canvas .lt-b")
        set_text(page, "Здравствуйте, !")
        select_range(page, TA, 14, 14)
        page.click('.lt-pane .lt-var-btn')
        check(page.get_attribute(".lt-pane .lt-var-btn", "aria-expanded") == "true", "меню переменных открыто")
        page.click('.lt-pane .lt-var-menu [data-var="name"]')
        check(page.input_value(TA) == "Здравствуйте, {{name}}!", "{{name}} в позицию курсора: %r" % page.input_value(TA))
        check(page.is_hidden(".lt-pane .lt-var-menu"), "меню закрылось после выбора")
        page.dispatch_event(TA, "change")
        page.click('[data-mode="preview"]')
        ptxt = frame(page).inner_text(timeout=5000)
        check("Здравствуйте, Анна!" in ptxt, "предпросмотр подставил «Анна»")
        check("Отписаться" in ptxt, "строка отписки в предпросмотре")
        check('href="https://tvorchestvo.ru/unsubscribe?u=demo"' in
              frame(page).locator("a", has_text="Отписаться").evaluate("a => a.outerHTML"), "демо-адрес отписки")
        page.click('[data-mode="edit"]')
        c = code(page)
        check("{{name}}" in c and "Анна" not in c, "в коде плейсхолдер")
        check(UNSUB in c, "строка отписки в коде")

        # кнопка без ссылки
        add_block(page, "button")
        check(page.is_visible(".lt-warn"), "предупреждение у кнопки без ссылки")
        check(page.inner_text(".lt-warn") == "Добавьте ссылку — без неё кнопка не кликается", "текст предупреждения")
        c = code(page)
        check('href="#"' not in c and "Смотреть афишу</span>" in c, "кнопка без ссылки — <span>, без href=\"#\"")
        page.click(".lt-canvas .lt-b >> nth=1")
        page.fill('.lt-pane input[data-f="href"]', "https://x.ru")
        check(page.is_hidden(".lt-warn"), "предупреждение скрылось при вводе адреса")
        page.dispatch_event('.lt-pane input[data-f="href"]', "change")
        check('<a href="https://x.ru"' in code(page), "кнопка со ссылкой — <a>")

        # ---- HTML-режим: переменная в .lt-src, отписка не дублируется ----
        page.click('[data-mode="code"]')
        page.click(".lt-to-html")
        confirm_dialog(page)
        page.wait_for_selector(".lt-src")
        src = page.input_value(".lt-src")
        check(src.count("{{unsubscribe_url}}") == 1, "при переходе строка отписки запечена один раз")
        at = src.index("Здравствуйте, ")
        select_range(page, ".lt-src", at, at)
        page.click(".lt-code .lt-var-btn")
        page.click('.lt-code .lt-var-menu [data-var="event_title"]')
        check(page.input_value(".lt-src").count("{{event_title}}Здравствуйте") == 1, "переменная в позицию курсора .lt-src")
        page.wait_for_timeout(450)
        check(ev in frame(page, ".lt-live").inner_text(timeout=5000), "живой предпросмотр подставил мероприятие")
        check(page.locator(".lt-lint-i.is-warn", has_text="Неизвестная").count() == 0, "известные переменные без warn")
        page.fill(".lt-src", page.input_value(".lt-src").replace("{{event_title}}", "{{fio}}"))
        page.wait_for_timeout(450)
        check(page.locator(".lt-lint-i.is-warn", has_text="Неизвестная").count() == 1, "{{fio}} -> warn в списке")
        check(page.evaluate("AdminLetter.toHtml({mode:'html', html: document.querySelector('.lt-src').value, blocks:[]})")
              .count("Отписаться") == 1, "html-режим: без дубля строки отписки")

        # Esc, затем Shift+Tab — выход из редактора
        page.focus(".lt-src")
        page.keyboard.press("Escape"); page.keyboard.press("Shift+Tab")
        check(not page.evaluate("document.activeElement.classList.contains('lt-src')"), "Esc, затем Shift+Tab — выход")

        # ---- список рассылок: старые письма с отпиской ----
        page.goto(BASE + "mailings.html")
        rid = page.evaluate("document.querySelector('tr[data-id]').dataset.id")
        page.click('tr[data-id="%s"] [data-act="letter"]' % rid)
        check("Отписаться" in frame(page, ".ml-frame").inner_text(timeout=5000), "старое письмо в списке со строкой отписки")

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
