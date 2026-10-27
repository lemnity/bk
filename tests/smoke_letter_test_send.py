"""Смоук тестовой отправки письма: python3 tests/smoke_letter_test_send.py"""
import http.server, os, socket, sys, threading, functools
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

def stored(page, name):
    return page.evaluate("""n => { const m = JSON.parse(localStorage.getItem('tbdt_admin_v1')).MAILINGS.items
                                   .find(x => x.name === n); return m ? m.letter.tests || [] : null }""", name)

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_context().new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "fonts.g" not in m.text and errors.append(m.text))

        page.goto(BASE + "mailing.html")
        page.wait_for_selector(".lt-test-btn")

        # пустое письмо: кнопка выключена, подсказка есть
        check(page.is_disabled(".lt-test-btn"), "пустое письмо: кнопка отключена")
        check(page.get_attribute(".lt-test-btn", "title"), "пустое письмо: у кнопки есть подсказка")
        check("пустое" in page.inner_text(".lt-test-note"), "пустое письмо: видимая подсказка")

        # добавляем блок
        page.locator(".lt-add-btn").last.click()
        page.click('.lt-pal[data-make="heading"]')
        check(page.locator(".lt-b").count() >= 1, "блок добавлен")
        check(not page.is_disabled(".lt-test-btn"), "письмо не пустое: кнопка доступна")

        def open_dlg():
            page.click(".lt-test-btn")
            page.wait_for_selector(".dlg[role=dialog]")

        # невалидный адрес
        open_dlg()
        check("Реальной отправки нет: кабинет работает без почтового сервера — письмо попадёт в журнал тестов"
              in page.inner_text(".dlg"), "текст про отсутствие реальной отправки")
        page.fill("#ltTestTo", "ok@site.ru, не-адрес")
        page.click(".dlg-actions button:last-child")
        check(page.locator(".dlg").count() == 1, "невалидный адрес: диалог остался")
        check("не-адрес" in page.inner_text("#ltTestErr"), "невалидный адрес: ошибка у поля")
        check(page.get_attribute("#ltTestTo", "aria-invalid") == "true", "aria-invalid у поля")
        check("ltTestErr" in page.get_attribute("#ltTestTo", "aria-describedby"), "aria-describedby ведёт на ошибку")

        # 6 адресов
        page.fill("#ltTestTo", "\n".join("u%d@site.ru" % i for i in range(6)))
        page.click(".dlg-actions button:last-child")
        check(page.locator(".dlg").count() == 1, "6 адресов: диалог остался")
        check("Не больше 5" in page.inner_text("#ltTestErr"), "6 адресов: ошибка")

        # Esc без записи
        page.keyboard.press("Escape")
        page.wait_for_selector(".dlg", state="detached")
        check(page.locator(".lt-test-note").inner_text().find("Последний тест") < 0, "Esc: записи нет")

        # 2 валидных
        open_dlg()
        page.fill("#ltTestTo", "a@site.ru, b@site.ru")
        page.click(".dlg-actions button:last-child")
        page.wait_for_selector(".dlg", state="detached")
        # тост: .toast скрыт через visibility с transition — inner_text сразу после .show
        # может вернуть '', поэтому ждём текст ретраящим expect
        try:
            expect(page.locator("#toast")).to_contain_text("Тест отправлен на 2 адреса")
        except AssertionError:
            check(False, "тост: %r" % page.text_content("#toast"))
        note = page.inner_text(".lt-test-note")
        check("Последний тест:" in note and "a@site.ru, b@site.ru" in note, "последний тест: %r" % note)

        # одиночный адрес — склонение
        open_dlg()
        page.fill("#ltTestTo", "c@site.ru")
        page.click(".dlg-actions button:last-child")
        page.wait_for_selector(".dlg", state="detached")
        try:
            expect(page.locator("#toast")).to_have_text("Тест отправлен на 1 адрес")
        except AssertionError:
            check(False, "склонение для 1: %r" % page.text_content("#toast"))
        check("адреса" not in page.text_content("#toast"), "склонение для 1: %r" % page.text_content("#toast"))

        # сохранённая рассылка: запись переживает перезагрузку
        page.fill("#mvName", "Смоук тестовой отправки")
        page.click("#mvDraft")
        t = stored(page, "Смоук тестовой отправки")
        check(t is not None and len(t) == 2, "в сторе 2 записи после сохранения: %r" % t)
        mid = page.evaluate("""() => JSON.parse(localStorage.getItem('tbdt_admin_v1')).MAILINGS.items
                                 .find(m => m.name === 'Смоук тестовой отправки').id""")
        page.goto(BASE + "mailing.html?id=%s" % mid)
        page.wait_for_selector(".lt-test-btn")
        check("c@site.ru" in page.inner_text(".lt-test-note"), "после перезагрузки виден последний тест")

        open_dlg()
        page.fill("#ltTestTo", "d@site.ru")
        page.click(".dlg-actions button:last-child")
        page.wait_for_selector(".dlg", state="detached")
        t = stored(page, "Смоук тестовой отправки")
        check(len(t) == 3 and t[-1]["to"] == ["d@site.ru"] and t[-1]["at"], "запись сразу в сторе: %r" % t)
        check(page.is_hidden("#mvDirty"), "тест не помечает форму несохранённой")
        page.goto(BASE + "mailing.html?id=%s" % mid)
        page.wait_for_selector(".lt-test-btn")
        check("d@site.ru" in page.inner_text(".lt-test-note"), "запись пережила перезагрузку")

        # Esc у сохранённой — без записи
        open_dlg()
        page.fill("#ltTestTo", "e@site.ru")
        page.keyboard.press("Escape")
        page.wait_for_selector(".dlg", state="detached")
        check(len(stored(page, "Смоук тестовой отправки")) == 3, "Esc: запись не добавлена")

        # журнал не мешает проверке отправки: ставим в очередь по списку адресов
        page.select_option("#mvAud", "list")
        page.fill("#mvEmails", "x@site.ru")
        page.click("#mvSend")
        page.wait_for_url("**/mailings.html", timeout=5000)
        m = page.evaluate("""() => JSON.parse(localStorage.getItem('tbdt_admin_v1')).MAILINGS.items
                             .find(x => x.name === 'Смоук тестовой отправки')""")
        check(m["status"] == "queue", "рассылка с журналом тестов ушла в очередь: %r" % m["status"])
        check(len(m["letter"]["tests"]) == 3, "журнал тестов сохранился при отправке")

        # журнал виден в просмотре: страница рассылки (только чтение) и письмо в списке
        page.goto(BASE + "mailing.html?id=%s" % mid)
        page.wait_for_selector(".lt-test-note")
        check("Последний тест:" in page.inner_text(".lt-test-note") and "d@site.ru" in page.inner_text(".lt-test-note"),
              "просмотр отправленной: виден последний тест")
        page.goto(BASE + "mailings.html")
        page.locator('tr:has-text("Смоук тестовой отправки") [data-act="letter"]').first.click()
        page.wait_for_selector(".ml-detail-t")
        check("Последний тест:" in page.inner_text(".ml-detail-t") and "d@site.ru" in page.inner_text(".ml-detail-t"),
              "список: в просмотре письма виден последний тест")

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

if fails:
    print("FAIL: %d" % len(fails)); sys.exit(1)
print("PASS")
