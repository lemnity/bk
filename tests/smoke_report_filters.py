"""Смоук параметров отчёта: python3 tests/smoke_report_filters.py

Форма отчёта реально фильтрует данные: на ?no=4а и ?no=6 сужение периода
уменьшает число строк и итог, выбор мероприятия оставляет только его, период
без операций даёт пустое состояние и выключенные выгрузки, «с» > «по» не строит
отчёт; на ?no=3 (бланк PPr2 на живых данных) другое мероприятие меняет итог.
"""
import http.server, os, socket, sys, threading, functools
from urllib.parse import quote
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

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and not ext(m) and errors.append(m.text))

        def run():
            page.click("#repRun")

        def table_state():
            """(строк, итог последнего столбца «Итог»)"""
            n = page.locator("#repResult table tbody tr").count()
            total = num(page.locator("#repResult table tfoot td").last.inner_text()) if n else 0
            return n, total

        for no in ("4а", "6"):
            page.goto(BASE + "report.html?no=" + quote(no, safe=""))
            page.wait_for_selector("#repRun")
            rng = page.evaluate("AdminReportData.range()")
            # значения по умолчанию: период — весь журнал, мероприятие — «Все»
            check(page.input_value("#f_period_from") == rng["min"] and
                  page.input_value("#f_period_to") == rng["max"],
                  "%s: период по умолчанию = range() %s" % (no, rng))
            check(page.input_value("#f_eventId") == "", "%s: мероприятие по умолчанию — все" % no)

            run()
            page.wait_for_selector("#repResultWrap:not([hidden])")
            n_all, t_all = table_state()
            check(n_all > 1 and t_all > 0, "%s: полный период даёт данные (%d строк, %d)" % (no, n_all, t_all))
            check(not page.is_disabled("#repWord") and not page.is_disabled("#repExcel"),
                  "%s: выгрузки включены при данных" % no)
            check(rng["min"][:4] in page.inner_text("#repParams") or "Период операций" in page.inner_text("#repParams"),
                  "%s: в заголовке результата применённые параметры" % no)

            # сужение периода: строк и итога меньше
            mid = page.evaluate("""(() => {
                const r = AdminReportData.range(), a = new Date(r.min), b = new Date(r.max);
                return new Date((+a + +b) / 2).toISOString().slice(0, 10);
            })()""")
            page.fill("#f_period_to", mid)
            run()
            n_half, t_half = table_state()
            check(0 < n_half < n_all and t_half < t_all,
                  "%s: сужение периода %d/%d → %d/%d" % (no, n_all, t_all, n_half, t_half))
            check(("по " + ".".join(reversed(mid.split("-")))) in page.inner_text("#repParams"),
                  "%s: период в заголовке результата" % no)
            page.fill("#f_period_to", rng["max"])

            # выбор мероприятия: остаются только его операции
            page.select_option("#f_eventId", "ev-1")
            run()
            n_ev, t_ev = table_state()
            exp = page.evaluate("""(() => {
                const ops = AdminReportData.ops({eventId: 'ev-1', kind: ['sale', 'refund']});
                return {sum: AdminReportData.sum(ops, 'amount'),
                        days: new Set(ops.map(o => o.opDate)).size};
            })()""")
            check(t_ev == exp["sum"] and n_ev == exp["days"] and t_ev < t_all,
                  "%s: мероприятие ev-1 — итог %d (ожидалось %d), строк %d (%d)" %
                  (no, t_ev, exp["sum"], n_ev, exp["days"]))
            title = page.evaluate("AdminReportData.events()[1].title")
            check(title in page.inner_text("#repParams"), "%s: мероприятие в заголовке результата" % no)
            page.select_option("#f_eventId", "")

            # период без операций → пустое состояние, выгрузки выключены
            page.fill("#f_period_from", "2030-01-01")
            page.fill("#f_period_to", "2030-01-31")
            run()
            check(page.locator("#repResult table").count() == 0 and
                  "Нет данных за выбранный период" in page.inner_text("#repResult"),
                  "%s: пустое состояние" % no)
            check(page.is_disabled("#repWord") and page.is_disabled("#repExcel"),
                  "%s: выгрузки disabled при пустом результате" % no)

            # «с» > «по» → сообщение у поля, отчёт не строится
            page.fill("#f_period_from", rng["max"])
            page.fill("#f_period_to", rng["min"])
            run()
            check(page.locator('.rv-notice[data-for="period"]').count() == 1 and
                  page.is_hidden("#repResultWrap") and
                  page.get_attribute("#f_period_from", "aria-invalid") == "true",
                  "%s: «с» > «по» — сообщение у поля, отчёта нет" % no)
            page.fill("#f_period_from", rng["min"])
            page.fill("#f_period_to", rng["max"])
            run()
            check(page.locator('.rv-notice[data-for="period"]').count() == 0 and
                  page.is_visible("#repResultWrap") and table_state()[0] == n_all,
                  "%s: после исправления периода отчёт строится" % no)

        # № 3 — бланк PPr2 на живых данных
        page.goto(BASE + "report.html?no=3")
        page.wait_for_selector("#repRun")

        def blank_total():
            return [num(c.inner_text()) for c in
                    page.locator("#repResult .rdoc-tot td").all()[1:]]

        run()
        page.wait_for_selector("#repResult .rdoc")
        t_first = blank_total()
        cap = page.inner_text("#repResult .rdoc-top")
        ev0 = page.evaluate("AdminReportData.events()[0]")
        check(ev0["title"] in cap, "3: без выбора — первое мероприятие в шапке бланка")
        check(t_first and t_first[0] > 0, "3: в «Всего:» есть продажи %s" % t_first)
        # пригласительные всегда входят во «Всего:» (флажок решает только про отдельную строку)
        exp0 = page.evaluate("AdminReportData.ops({eventId: 'ev-0', kind: ['sale', 'invite']}).length")
        check(t_first[0] == exp0, "3: «Продано» = продажи + приглашения журнала (%d / %d)" % (t_first[0], exp0))

        page.select_option("#f_event", "ev-2")
        run()
        t_other = blank_total()
        ev2 = page.evaluate("AdminReportData.events()[2]")
        check(t_other != t_first, "3: другое мероприятие меняет итог бланка")
        check(ev2["title"] in page.inner_text("#repResult .rdoc-top"), "3: выбранное мероприятие в шапке")
        check(not page.is_disabled("#repWord"), "3: выгрузки включены")

        # выгрузка = экран: правка формы без «Показать отчёт» не меняет файл
        page.fill("#f_range_from", "2030-01-01")
        page.fill("#f_range_to", "2030-01-31")
        page.select_option("#f_event", "")
        check(page.locator("#repResult .rdoc").count() == 1, "3: экран не меняется без «Показать отчёт»")
        if page.is_enabled("#repWord"):
            with page.expect_download() as dl:
                page.click("#repWord")
            body = open(dl.value.path(), encoding="utf-8-sig").read()
            check(ev2["title"] in body and "rdoc-tot" in body and
                  "Диапазон событий" not in body,
                  "3: Word после правки формы = показанный бланк (%s)" % ev2["title"])
        # и «с» > «по» без перестроения — тоже выгружается показанное
        page.fill("#f_range_from", "2030-02-01")
        if page.is_enabled("#repExcel"):
            with page.expect_download() as dl:
                page.click("#repExcel")
            body = open(dl.value.path(), encoding="utf-8-sig").read()
            check(ev2["title"] in body and "rdoc-tot" in body, "3: Excel при «с» > «по» = показанный бланк")
        page.fill("#f_range_from", "")
        page.fill("#f_range_to", "")

        # диапазон событий без мероприятий → пустое состояние
        page.select_option("#f_event", "")
        page.fill("#f_range_from", "2030-01-01")
        page.fill("#f_range_to", "2030-01-31")
        run()
        check("Нет данных за выбранный период" in page.inner_text("#repResult") and
              page.is_disabled("#repWord") and page.is_disabled("#repExcel"),
              "3: пустой диапазон событий → пустое состояние, выгрузки disabled")

        # № 3а — разбивка оплат сходится с журналом
        page.goto(BASE + "report.html?no=" + quote("3а", safe=""))
        page.wait_for_selector("#repRun")
        page.select_option("#f_event", "ev-1")
        run()
        page.wait_for_selector("#repResult .rdoc")
        tot = blank_total()
        exp = page.evaluate("AdminReportData.sum(AdminReportData.ops({eventId: 'ev-1', kind: ['sale', 'refund']}), 'amount')")
        check(tot and tot[-1] == exp and sum(tot[1:-1]) == tot[-1],
              "3а: итог %s = журнал %d и сумма типов оплаты" % (tot, exp))

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
