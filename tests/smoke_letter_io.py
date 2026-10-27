"""Смоук импорта и экспорта письма: python3 tests/smoke_letter_io.py"""
import http.server, os, socket, sys, threading, functools, json, tempfile
from playwright.sync_api import sync_playwright, expect

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

TMP = tempfile.mkdtemp()
IMPORTED = ('<!doctype html><html><body><table width="600"><tr><td>Импортированное письмо '
            '<a href="{{unsubscribe_url}}">Отписаться</a></td></tr></table></body></html>')
html_path = os.path.join(TMP, "pismo.html")
open(html_path, "w", encoding="utf-8").write("﻿" + IMPORTED)
bad_path = os.path.join(TMP, "notes.html")
open(bad_path, "w", encoding="utf-8").write("просто текст без тегов")

def menu(page, which, item):
    page.click('[data-iomenu="%s"]' % which)
    page.click('[data-io="%s"]' % item)

def confirm(page, yes):
    page.wait_for_selector(".dlg[role=dialog]")
    page.click(".dlg-actions button:last-child" if yes else ".dlg-actions button:first-child")
    page.wait_for_selector(".dlg[role=dialog]", state="detached")

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context()
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "fonts.g" not in m.text and errors.append(m.text))
        page.add_init_script("window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };")

        # ---- новая рассылка: кнопки подписаны, меню открываются и закрываются ----
        page.goto(BASE + "mailing.html")
        page.wait_for_selector('[data-iomenu="import"]')
        check(page.inner_text('[data-iomenu="import"]').startswith("Импорт"), "кнопка «Импорт» подписана")
        check(page.inner_text('[data-iomenu="export"]').startswith("Экспорт"), "кнопка «Экспорт» подписана")
        page.click('[data-iomenu="import"]')
        check(page.get_attribute('[data-iomenu="import"]', "aria-expanded") == "true", "меню импорта открыто")
        check(page.locator('.lt-io-menu:not([hidden]) [role=menuitem]').count() == 3, "в импорте 3 пункта")
        check(page.evaluate("document.activeElement.dataset.io") == "import-html", "фокус на первом пункте")
        page.keyboard.press("Escape")
        check(page.get_attribute('[data-iomenu="import"]', "aria-expanded") == "false", "Esc закрывает меню")
        check(page.evaluate("document.activeElement.dataset.iomenu") == "import", "фокус вернулся на кнопку")
        page.click('[data-iomenu="export"]')
        page.click("#mvName")
        check(page.locator(".lt-io-menu:not([hidden])").count() == 0, "клик мимо закрывает меню")

        # ---- импорт: не HTML → тост, письмо не тронуто ----
        page.click('[data-iomenu="import"]')
        with page.expect_file_chooser() as fc:
            page.click('[data-io="import-html"]')
        fc.value.set_files(bad_path)
        expect(page.locator("#toast")).to_contain_text("не похож на HTML")
        check(page.locator(".lt-src").count() == 0, "плохой файл не переключил в HTML")

        # ---- импорт HTML-файла в пустое письмо — без подтверждения ----
        page.click('[data-iomenu="import"]')
        with page.expect_file_chooser() as fc:
            page.click('[data-io="import-html"]')
        fc.value.set_files(html_path)
        page.wait_for_selector(".lt-src")
        check(page.input_value(".lt-src") == IMPORTED, "HTML импортирован как есть (BOM срезан)")
        expect(page.locator("#toast")).to_contain_text("импортирован")
        check(page.locator(".dlg").count() == 0, "в пустое письмо — без подтверждения")
        expect(page.frame_locator(".lt-live").locator("body")).to_contain_text("Импортированное письмо")

        # ---- экспорт: HTML-файл, копирование, шаблон ----
        with page.expect_download() as d:
            menu(page, "export", "export-html")
        exported = open(d.value.path(), encoding="utf-8").read()
        check(d.value.suggested_filename.endswith(".html"), "экспорт: файл .html")
        check(exported == IMPORTED, "экспорт HTML = импортированный (отписка уже есть, не дублируется)")
        menu(page, "export", "export-copy")
        expect(page.locator("#toast")).to_contain_text("скопирован")
        check(page.evaluate("window.__copied") == exported, "копирование = скачанный файл")
        with page.expect_download() as d:
            menu(page, "export", "export-json")
        tpl_path = d.value.path()
        tpl = json.load(open(tpl_path, encoding="utf-8"))
        check(tpl.get("mode") == "html" and tpl.get("html") == IMPORTED, "шаблон .json хранит HTML")

        # ---- вставка кода: проверки поля и подтверждение замены ----
        menu(page, "import", "import-paste")
        page.wait_for_selector("#ltPaste")
        page.click(".dlg-actions button:last-child")
        check("Вставьте" in page.inner_text("#ltPasteErr"), "пустое поле — ошибка")
        page.fill("#ltPaste", "нет тегов")
        page.click(".dlg-actions button:last-child")
        check("тега" in page.inner_text("#ltPasteErr"), "без тегов — ошибка")
        check(page.get_attribute("#ltPaste", "aria-invalid") == "true", "aria-invalid у поля")
        PASTED = "<table><tr><td>Вставленный код</td></tr></table>"
        page.fill("#ltPaste", PASTED)
        page.click(".dlg-actions button:last-child")
        confirm(page, yes=False)                       # письмо не пустое — спрашиваем; отказ
        check(page.input_value(".lt-src") == IMPORTED, "отказ — письмо не заменено")
        menu(page, "import", "import-paste")
        page.fill("#ltPaste", PASTED)
        page.click(".dlg-actions button:last-child")
        confirm(page, yes=True)
        check(page.input_value(".lt-src") == PASTED, "вставленный код заменил письмо")

        # ---- импорт шаблона .json в непустое письмо — тоже с подтверждением ----
        page.click('[data-iomenu="import"]')
        with page.expect_file_chooser() as fc:
            page.click('[data-io="import-json"]')
        fc.value.set_files(tpl_path)
        confirm(page, yes=True)
        check(page.input_value(".lt-src") == IMPORTED, "шаблон .json загружен после подтверждения")

        # ---- импорт сохраняется в черновик ----
        page.fill("#mvName", "Смоук импорта")
        page.click("#mvDraft")
        stored = page.evaluate("""() => JSON.parse(localStorage.getItem('tbdt_admin_v1')).MAILINGS.items
                                   .find(m => m.name === 'Смоук импорта').letter""")
        check(stored["mode"] == "html" and stored["html"] == IMPORTED, "импортированное письмо сохранено")

        check(not errors, "ошибки консоли: %r" % errors)
        br.close()
finally:
    srv.shutdown()

print("PASS" if not fails else "FAIL: %d" % len(fails))
sys.exit(1 if fails else 0)
