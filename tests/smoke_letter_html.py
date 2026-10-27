"""Смоук HTML-режима письма: python3 tests/smoke_letter_html.py"""
import http.server, json, os, socket, sys, threading, functools
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

SRC = "<table><tr><td>Привет</td></tr></table>"

def sandbox_ok(page, sel):
    v = page.get_attribute(sel, "sandbox")
    return v is not None and "allow-scripts" not in v

def frame_text(page, sel):
    return page.frame_locator(sel).locator("body").inner_text(timeout=5000)

def confirm_dialog(page, yes=True):
    page.wait_for_selector(".dlg[role=dialog]")
    text = page.inner_text(".dlg")
    page.click(".dlg-actions button:last-child" if yes else ".dlg-actions button:first-child")
    page.wait_for_selector(".dlg", state="detached")
    return text

def fill_src(page, value):
    page.fill(".lt-src", value)
    page.wait_for_timeout(450)   # предпросмотр обновляется через ~300 мс

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(accept_downloads=True)
        page = ctx.new_page()
        errors = []
        blocked = []
        def on_console(m):
            if m.type != "error":
                return
            # песочница отказалась исполнять <script> письма — так и задумано
            if "frame is sandboxed" in m.text and "allow-scripts" in m.text:
                blocked.append(m.text)
            # внешние шрифты в песочнице не грузятся — это не ошибка страницы
            elif "fonts.g" not in m.text:
                errors.append(m.text)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", on_console)

        # ---- линтер как функция ----
        page.goto(BASE + "mailing.html")
        page.wait_for_function("window.AdminLetter && window.AdminLetter.lintHtml")
        lint = lambda h: page.evaluate("h => AdminLetter.lintHtml(h)", h)
        full = '<html><body><table width="600"><tr><td><a href="https://x.ru">a</a></td></tr></table></body></html>'
        check(lint(full) == [], "чистый HTML без замечаний: %s" % lint(full))
        texts = lambda h: " | ".join(n["text"] for n in lint(h))
        check("Нет табличного каркаса — Outlook может разъехаться" in texts("<html><body><p>x</p></body></html>"), "нет <table> -> warn")
        check(any(n["level"] == "error" for n in lint(full + "<script>1</script>")), "<script> -> error")
        check("@import" in texts(full.replace("<body>", "<body><style>@import url(x.css);</style>")), "@import -> warn")
        check("stylesheet" in texts('<link rel="stylesheet" href="a.css">' + full), "<link stylesheet> -> warn")
        check("Пустая ссылка" in texts(full.replace("https://x.ru", "#")), 'href="#" -> warn')
        check("Пустая ссылка" in texts(full.replace("https://x.ru", "")), "пустой href -> warn")
        check("Картинки data-URL не показываются в Gmail/Outlook" in texts(full.replace("a</a>", '<img src="data:image/png;base64,AA"></a>')), "data-URL -> warn")
        check("шире 600" in texts(full.replace('width="600"', 'width="700"')), "таблица 700 -> warn")
        check("шире 600" not in texts(full), "таблица 600 без замечания")
        check("</body>" in texts("<table></table>"), "нет </body></html> -> warn")
        check(page.evaluate("AdminLetter.toHtml({mode:'html', html:'<b>x</b>', blocks:[]})") == "<b>x</b>", "toHtml в режиме html = L.html")

        # ---- новая рассылка: блок, затем переход в HTML ----
        page.click(".lt-add-btn")
        page.click('.lt-pal[data-make="heading"]')
        check(page.locator(".lt-canvas .lt-b").count() == 1, "добавлен блок-заголовок")
        page.click('[data-mode="code"]')
        check(page.get_attribute(".lt-code textarea", "readonly") is not None, "в режиме блоков код только для чтения")
        check(page.locator(".lt-dl-html").count() == 1, "«Скачать .html» в режиме блоков")
        page.click(".lt-to-html")
        dtext = confirm_dialog(page, yes=False)
        check("Письмо превратится в HTML-код. Блоки можно будет вернуть, но правки кода тогда пропадут." in dtext, "текст диалога перехода")
        check(page.locator(".lt-src").count() == 0, "отмена диалога оставляет режим блоков")
        page.click(".lt-to-html")
        confirm_dialog(page, yes=True)
        page.wait_for_selector(".lt-src")
        check("Заголовок письма" in page.input_value(".lt-src"), "HTML собран из блоков")
        check(page.get_attribute(".lt-src", "spellcheck") == "false", "spellcheck=false")
        check(page.get_attribute(".lt-src", "readonly") is None, "редактор доступен для ввода")
        check(sandbox_ok(page, ".lt-live"), "живой предпросмотр в sandbox без allow-scripts")
        check(page.is_disabled(".lt-bar .lt-modes button:first-child"), "редактор блоков недоступен")
        check(page.locator(".lt-tabs button:disabled").count() == 2, "вкладки «Стиль»/«Свойства» недоступны")
        check(page.locator(".lt-palette, .lt-add-btn").count() == 0, "палитры блоков нет")

        # ввод -> предпросмотр
        fill_src(page, SRC)
        check("Привет" in frame_text(page, ".lt-live"), "текст в живом предпросмотре")
        size = page.inner_text(".lt-size")
        check("КБ" in size and "Gmail" not in size, "размер письма: %s" % size)
        check(page.locator(".lt-lint-i.is-error").count() == 0, "без <script> ошибок нет")
        check("Нет </body>" in page.inner_text(".lt-lint"), "предупреждение о незакрытом документе в списке")

        # Tab / Shift+Tab
        page.focus(".lt-src")
        page.evaluate("() => { const t = document.querySelector('.lt-src'); t.selectionStart = t.selectionEnd = 0; }")
        page.keyboard.press("Tab")
        check(page.input_value(".lt-src") == "  " + SRC, "Tab вставляет 2 пробела")
        check(page.evaluate("document.activeElement.classList.contains('lt-src')"), "фокус остался в редакторе")
        page.keyboard.press("Shift+Tab")
        check(page.input_value(".lt-src") == SRC, "Shift+Tab снимает отступ")
        page.keyboard.press("Escape"); page.keyboard.press("Tab")
        check(not page.evaluate("document.activeElement.classList.contains('lt-src')"), "Esc, затем Tab — выход из редактора")
        check(page.input_value(".lt-src") == SRC, "выход Tab не меняет текст")

        # <script> -> ошибка, и он не исполняется
        fill_src(page, SRC + "<script>parent.__pwned = 1</script>")
        check(page.locator(".lt-lint-i.is-error").count() == 1, "<script> -> ошибка линтера в списке")
        check(page.evaluate("window.__pwned") is None, "скрипт письма не исполнился")
        check(len(blocked) > 0, "браузер заблокировал скрипт песочницей")

        # большой HTML -> предупреждение о 102 КБ
        fill_src(page, SRC + "<!--" + "x" * (103 * 1024) + "-->")
        check("Gmail" in page.inner_text(".lt-size"), "предупреждение > 102 КБ")
        check("is-warn" in page.get_attribute(".lt-size", "class"), "размер подсвечен")
        fill_src(page, SRC)

        # «Скачать .html» (новая рассылка — «shablon»)
        with page.expect_download() as d:
            page.click(".lt-dl-html")
        dl = d.value
        check(dl.suggested_filename == "pismo-shablon.html", "имя файла: %s" % dl.suggested_filename)
        check(open(dl.path(), encoding="utf-8").read() == SRC, "в файле введённый HTML")

        # JSON-шаблон хранит mode и html
        with page.expect_download() as d:
            page.click('[data-act="down"]')
        tpl_path = d.value.path()
        tpl = json.load(open(tpl_path, encoding="utf-8"))
        check(tpl.get("mode") == "html" and tpl.get("html") == SRC, "шаблон JSON: mode/html")
        check(len(tpl.get("blocks", [])) == 1, "шаблон JSON: блоки сохранены нетронутыми")

        # просмотр показывает HTML
        page.click('[data-mode="preview"]')
        check(sandbox_ok(page, ".lt-frame"), "предпросмотр в sandbox без allow-scripts")
        check("Привет" in frame_text(page, ".lt-frame"), "«Предпросмотр» показывает HTML")

        # ---- черновик в html-режиме переживает перезагрузку ----
        page.fill("#mvName", "Смоук HTML-письма")
        page.click("#mvDraft")
        mid = page.evaluate("""() => JSON.parse(localStorage.getItem('tbdt_admin_v1')).MAILINGS.items
                                 .find(m => m.name === 'Смоук HTML-письма').id""")
        with page.expect_download() as d:
            page.click('[data-mode="code"]')
            page.click(".lt-dl-html")
        check(d.value.suggested_filename == "pismo-%s.html" % mid, "имя файла с id: %s" % d.value.suggested_filename)

        page.goto(BASE + "mailing.html?id=%s" % mid)
        page.wait_for_selector(".lt-src")
        check(page.input_value(".lt-src") == SRC, "HTML черновика восстановлен после перезагрузки")
        check("Привет" in frame_text(page, ".lt-live"), "предпросмотр после перезагрузки")

        # ---- список рассылок: html-письмо и старые письма в песочнице ----
        page.goto(BASE + "mailings.html")
        page.click('tr[data-id="%s"] [data-act="letter"]' % mid)
        check(sandbox_ok(page, ".ml-frame"), "письмо в списке в sandbox без allow-scripts")
        check("Привет" in frame_text(page, ".ml-frame"), "html-письмо показано в списке")
        other = page.evaluate("""() => { const r = [...document.querySelectorAll('tr[data-id]')]
                                   .find(t => t.dataset.id !== '%s'); return r ? r.dataset.id : null }""" % mid)
        check(other is not None, "в списке есть старые рассылки")
        if other is not None:
            page.click('tr[data-id="%s"] [data-act="letter"]' % other)
            check(len(frame_text(page, ".ml-frame").strip()) > 0, "старое письмо (блоки) показывается")

        # ---- загрузка JSON-шаблона в новую рассылку ----
        page.goto(BASE + "mailing.html")
        page.wait_for_selector(".lt-file", state="attached")
        page.set_input_files(".lt-file", tpl_path)
        page.wait_for_selector(".lt-src")
        check(page.input_value(".lt-src") == SRC, "шаблон JSON загружен в html-режиме")

        # ---- возврат к блокам ----
        page.click(".lt-to-blocks")
        confirm_dialog(page, yes=False)
        check(page.locator(".lt-src").count() == 1, "отмена — остаёмся в HTML")
        page.click(".lt-to-blocks")
        confirm_dialog(page, yes=True)
        page.wait_for_selector(".lt-canvas")
        check(page.locator(".lt-canvas .lt-b").count() == 1, "блоки восстановлены")
        check("Заголовок письма" in page.inner_text(".lt-canvas"), "текст блока восстановлен")
        check(page.locator(".lt-tabs button:disabled").count() == 0, "вкладки снова доступны")

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
