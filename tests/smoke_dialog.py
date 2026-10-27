"""Смоук AdminDialog: python3 tests/smoke_dialog.py"""
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

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto("http://127.0.0.1:%d/mailing.html" % port)
        page.wait_for_function("window.AdminDialog")

        def start(js):
            page.evaluate("() => { window.__r = undefined; (%s).then(v => { window.__r = v; }); }" % js)
        def result():
            page.wait_for_function("window.__r !== undefined")
            return page.evaluate("window.__r")

        # Esc -> false, прокрутка и фокус восстановлены
        page.focus("body")
        start("AdminDialog.confirm({title:'Удалить?', text:'Точно?'})")
        page.wait_for_selector(".dlg[role=dialog]")
        check(page.is_visible(".dlg"), "диалог виден")
        check(page.get_attribute(".dlg", "aria-modal") == "true", "aria-modal")
        check(page.evaluate("document.querySelector('.dlg').contains(document.activeElement)"), "фокус внутри")
        check(page.evaluate("getComputedStyle(document.body).overflow") == "hidden", "прокрутка заблокирована")
        page.keyboard.press("Tab"); page.keyboard.press("Tab"); page.keyboard.press("Tab")
        check(page.evaluate("document.querySelector('.dlg').contains(document.activeElement)"), "Tab не выходит из диалога")
        page.keyboard.press("Escape")
        check(result() is False, "Esc -> false")
        check(page.query_selector(".dlg") is None, "диалог убран")
        check(page.evaluate("getComputedStyle(document.body).overflow") != "hidden", "прокрутка разблокирована после Esc")

        # OK -> true
        start("AdminDialog.confirm({title:'Т', text:'x', ok:'Да'})")
        page.wait_for_selector(".dlg")
        page.click(".dlg-actions .btn-gold")
        check(result() is True, "ОК -> true")
        check(page.evaluate("getComputedStyle(document.body).overflow") != "hidden", "прокрутка разблокирована после ОК")

        # validate блокирует закрытие; клик по подложке -> null
        page.evaluate("""() => { window.__r = undefined; window.__ok = false;
          AdminDialog.open({title:'Ввод', body:'<input id=dlgIn>', onOpen:r=>{r.querySelector('#dlgIn').dataset.o='1'},
            actions:[{label:'Сохранить', kind:'primary', value:'saved', validate:r=>window.__ok}]}).then(v=>{window.__r=v}) }""")
        page.wait_for_selector("#dlgIn")
        check(page.evaluate("document.activeElement.id") == "dlgIn", "фокус на первом поле")
        check(page.get_attribute("#dlgIn", "data-o") == "1", "onOpen вызван")
        page.click(".dlg-actions .btn-gold")
        check(page.query_selector(".dlg") is not None, "validate=false оставляет диалог открытым")
        page.evaluate("window.__ok = true")
        page.click(".dlg-actions .btn-gold")
        check(result() == "saved", "validate=true -> value")

        start("AdminDialog.open({title:'X', body:'t'})")
        page.wait_for_selector(".dlg")
        page.mouse.click(5, 5)
        check(result() is None, "клик по подложке -> null")

        # два диалога подряд, блокировка снимается только после последнего
        page.evaluate("""() => { window.__a = AdminDialog.open({title:'A', body:'a'});
          window.__b = AdminDialog.open({title:'B', body:'b'}); window.__done = 0;
          window.__a.then(()=>window.__done++); window.__b.then(()=>window.__done++) }""")
        check(page.locator(".dlg").count() == 2, "два диалога открыты")
        page.keyboard.press("Escape")
        check(page.locator(".dlg").count() == 1, "Esc закрывает только верхний")
        check(page.evaluate("getComputedStyle(document.body).overflow") == "hidden", "блокировка держится")
        page.keyboard.press("Escape")
        page.wait_for_function("window.__done === 2")
        check(page.evaluate("getComputedStyle(document.body).overflow") != "hidden", "блокировка снята после последнего")

        # узкий экран
        page.set_viewport_size({"width": 400, "height": 700})
        start("AdminDialog.confirm({title:'Т', text:'x'})")
        page.wait_for_selector(".dlg")
        w = page.evaluate("document.querySelector('.dlg').getBoundingClientRect().width")
        check(abs(w - 368) <= 1, "на 400px панель = ширина - 32 (получено %s)" % w)
        page.keyboard.press("Escape"); result()

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
