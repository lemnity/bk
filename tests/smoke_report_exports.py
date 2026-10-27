"""Смоук выгрузок отчётов: python3 tests/smoke_report_exports.py

На report.html?no=5 (табличный отчёт) Word/Excel/CSV скачиваются под именем
otchet-5-<дата>.<ext> и повторяют экран, «Печать / PDF» вызывает window.print,
а @media print прячет сайдбар, форму и кнопки; бланк «3» тоже выгружается в CSV.
В каталоге «↓» у строки «1» скачивает .xls без перехода, «⚙» открывает
report.html?no=1&setup=1 с раскрытым меню столбцов. На ledger.html «Сформировать
отчёт» ведёт на report.html?no=Б-1, итог сальдо = сумма S.LEDGER.amount.
"""
import csv, datetime, functools, http.server, io, os, re, socket, sys, threading
from urllib.parse import quote, unquote
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

def ext(m):
    loc = str(m.location).lower()
    return "font" in (m.text + loc).lower() or "googleapis" in loc or "gstatic" in loc

def num(txt):
    """«12 345 ₽» → 12345 (пробелы — обычные и неразрывные)"""
    t = "".join(ch for ch in txt if ch.isdigit() or ch == "-")
    return int(t) if t not in ("", "-") else 0

TODAY = datetime.date.today().isoformat()

def read(dl):
    return open(dl.value.path(), encoding="utf-8-sig").read()

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(accept_downloads=True)
        # подмена печати: диалог в headless не нужен, считаем вызовы
        ctx.add_init_script("window.__printed = 0; window.print = function () { window.__printed++; };")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and not ext(m) and errors.append(m.text))

        def download(sel):
            with page.expect_download() as dl:
                page.click(sel)
            return dl

        # ---------- № 5: табличный отчёт ----------
        page.goto(BASE + "report.html?no=5")
        page.wait_for_selector("#repRun")
        page.click("#repRun")
        page.wait_for_selector("#repResultWrap:not([hidden])")
        n_rows = page.locator("#repResult table tbody tr").count()
        check(n_rows >= 1, "5: на экране есть строки (%d)" % n_rows)
        check(page.is_visible("#repDocActions"), "5: у таблицы есть панель выгрузок")
        for b in ("#repWord", "#repExcel", "#repCsv", "#repPrint"):
            check(page.is_enabled(b), "5: кнопка %s включена" % b)
        first_cell = page.locator("#repResult table tbody tr").first.locator("td").first.inner_text()
        heads = [t.strip() for t in page.locator("#repResult table thead th").all_text_contents()]

        dl = download("#repWord")
        check(dl.value.suggested_filename == "otchet-5-%s.doc" % TODAY,
              "5: имя Word %s" % dl.value.suggested_filename)
        body = read(dl)
        check("urn:schemas-microsoft-com:office:word" in body and "rv-table" in body and
              first_cell in body and "Итого" in body, "5: Word — та же таблица, что на экране")

        dl = download("#repExcel")
        check(dl.value.suggested_filename == "otchet-5-%s.xls" % TODAY,
              "5: имя Excel %s" % dl.value.suggested_filename)
        body = read(dl)
        check("urn:schemas-microsoft-com:office:excel" in body and first_cell in body and
              not re.search(r'<td class="num">[^<]*(₽|\d[\s\u00a0]\d)', body),
              "5: Excel — та же таблица, числа сырые")

        dl = download("#repCsv")
        check(dl.value.suggested_filename == "otchet-5-%s.csv" % TODAY,
              "5: имя CSV %s" % dl.value.suggested_filename)
        raw = open(dl.value.path(), "rb").read()
        check(raw.startswith(b"\xef\xbb\xbf"), "5: CSV с BOM")
        rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig")), delimiter=";"))
        check(len(rows) >= 2, "5: CSV — заголовок и хотя бы одна строка (%d)" % len(rows))
        check(rows[0] == heads, "5: заголовки CSV = видимые столбцы %s / %s" % (rows[0], heads))
        check(len(rows) == n_rows + 2 and rows[-1][0] == "Итого",
              "5: CSV = строки экрана + «Итого» (%d / %d)" % (len(rows), n_rows))
        check(not any(re.search(r"\d\s\d|₽", c) for r in rows[1:] for c in r[1:]),
              "5: числа в CSV без разделителей тысяч и «₽»")
        # каталог собирает ту же модель с теми же значениями по умолчанию
        built_csv = page.evaluate("AdminReportDoc.build('5', {}).csv")
        check(built_csv == raw.decode("utf-8-sig"), "5: build('5', {}).csv = CSV со страницы")

        # «Печать / PDF»
        page.click("#repPrint")
        check(page.evaluate("window.__printed") == 1, "5: «Печать / PDF» вызывает window.print")
        page.emulate_media(media="print")
        check(not page.is_visible(".side") and not page.is_visible("#repForm") and
              not page.is_visible("#repDocActions") and not page.is_visible(".top") and
              page.is_visible("#repResult table"),
              "5: при печати видна только таблица (без сайдбара, формы и кнопок)")
        ml = page.evaluate("getComputedStyle(document.querySelector('.main')).marginLeft")
        check(ml == "0px", "5: при печати документ на всю ширину (margin-left %s)" % ml)
        page.emulate_media(media="screen")

        # пустой результат — выгрузки выключены
        page.fill("#f_period_from", "2030-01-01")
        page.fill("#f_period_to", "2030-01-31")
        page.click("#repRun")
        for b in ("#repWord", "#repExcel", "#repCsv", "#repPrint"):
            check(page.is_disabled(b), "5: пустой период — %s выключена" % b)

        # ---------- № 3: бланк тоже выгружается в CSV ----------
        page.goto(BASE + "report.html?no=3")
        page.wait_for_selector("#repRun")
        page.click("#repRun")
        page.wait_for_selector("#repResult .rdoc")
        dl = download("#repCsv")
        rows = list(csv.reader(io.StringIO(read(dl)), delimiter=";"))
        check(rows[0][:2] == ["Продавец", "Продано · Число"] and any(r and r[0] == "Всего:" for r in rows),
              "3: CSV бланка — заголовок и строка «Всего:»")
        check(dl.value.suggested_filename == "otchet-3-%s.csv" % TODAY,
              "3: имя CSV %s" % dl.value.suggested_filename)

        # ---------- каталог ----------
        page.goto(BASE + "reports.html")
        page.wait_for_selector('#repList tr[data-no="1"]')
        url0 = page.url
        with page.expect_download() as dl:
            page.click('#repList tr[data-no="1"] button[data-act="export"]')
        check(dl.value.suggested_filename == "otchet-1-%s.xls" % TODAY,
              "каталог: «↓» скачивает %s" % dl.value.suggested_filename)
        body = read(dl)
        check("urn:schemas-microsoft-com:office:excel" in body and "<tbody><tr>" in body,
              "каталог: .xls с данными")
        check(page.url == url0, "каталог: «↓» без перехода (%s)" % page.url)
        page.wait_for_selector("#toast.show")
        check("Отчёт № 1 выгружен" in page.inner_text("#toast"), "каталог: тост «Отчёт № 1 выгружен»")

        page.click('#repList tr[data-no="1"] button[data-act="setup"]')
        page.wait_for_url("**/report.html?no=1&setup=1")
        page.wait_for_selector("#repColsMenu:not([hidden])")
        check(page.get_attribute("#repColsBtn", "aria-expanded") == "true", "⚙: меню столбцов раскрыто")
        check(page.evaluate("!!document.activeElement.closest('#repForm')"),
              "⚙: фокус в первом поле формы")
        first_id = page.evaluate("document.querySelector('#repForm input, #repForm select').id")
        check(page.evaluate("document.activeElement.id") == first_id, "⚙: фокус именно в первом поле")

        # ---------- бухгалтерия ----------
        page.goto(BASE + "ledger.html")
        page.wait_for_selector("#buildReport")
        page.click("#buildReport")
        page.wait_for_url(re.compile(r".*/report\.html\?no=.*"))
        check(unquote(page.url).endswith("report.html?no=Б-1"), "ledger: переход на %s" % unquote(page.url))
        check(page.url.endswith("report.html?no=" + quote("Б-1")), "ledger: номер закодирован")
        page.wait_for_selector("#repRun")
        page.click("#repRun")
        page.wait_for_selector("#repResult table tfoot")
        saldo = num(page.locator("#repResult table tfoot td").last.inner_text())
        exp = page.evaluate("AdminStore.state.LEDGER.reduce((a, l) => a + (+l.amount || 0), 0)")
        check(saldo == exp, "ledger: итог сальдо %d = сумма LEDGER.amount %d" % (saldo, exp))
        n_led = page.locator("#repResult table tbody tr").count()
        n_store = page.evaluate("AdminStore.state.LEDGER.length")
        check(n_led == n_store, "ledger: все записи книги (%d / %d)" % (n_led, n_store))
        dl = download("#repExcel")
        check(dl.value.suggested_filename == "otchet-Б-1-%s.xls" % TODAY,
              "ledger: имя Excel %s" % dl.value.suggested_filename)

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
