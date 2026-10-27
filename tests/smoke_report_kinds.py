"""Смоук видов отчётов (AdminReportKinds): python3 tests/smoke_report_kinds.py

Каждый номер каталога открывается рабочим отчётом: нет плашки «не заведены»,
после «Показать отчёт» — таблица с данными или пустое состояние, без ошибок.
"""
import http.server, os, socket, sys, threading, functools
from collections import Counter
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

try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and not ext(m) and errors.append(m.text))

        page.goto(BASE + "report.html?no=3")
        page.wait_for_function("window.AdminReportKinds && window.AdminReports")
        ev = page.evaluate
        catalog = ev("AdminReports.CATALOG.map(r => r.no)")
        check(len(catalog) >= 150, "каталог: %d номеров" % len(catalog))
        check("Б-1" in catalog, "Б-1 в каталоге")
        kinds = ev("Object.fromEntries(AdminReports.CATALOG.map(r => [r.no, AdminReportKinds.kindOf(r.no)]))")
        check(kinds.get("Б-1") == "ledger", "Б-1 → ledger")
        check(all(kinds[n] in ev("Object.keys(AdminReportKinds.KINDS)") for n in catalog), "у каждого номера известный вид")

        # rows(params) реально фильтрует
        check(ev("""(() => {
            const sp = AdminReportKinds.specFor('5');
            const all = sp.rows({}), one = sp.rows({eventId: 'ev-1'});
            return all.length > 0 && one.length > 0 &&
              one.reduce((a, r) => a + r.soldCnt, 0) < all.reduce((a, r) => a + r.soldCnt, 0);
        })()"""), "byOpDate: фильтр eventId")
        check(ev("""(() => {
            const sp = AdminReportKinds.specFor('1');
            return sp.rows({}).length > 0 && sp.rows({eventFrom: '2030-01-01'}).length === 0;
        })()"""), "events: фильтр периода мероприятий")
        # byPay и pushkin считают только продажи и возвраты
        check(ev("""(() => {
            const rows = AdminReportKinds.specFor('91').rows({});
            const n = AdminReportData.ops({kind: ['sale', 'refund']}).length;
            return rows.reduce((a, r) => a + r.cnt, 0) === n;
        })()"""), "byPay: только sale|refund")
        check(ev("""(() => {
            const rows = AdminReportKinds.specFor('119').rows({});
            const s = AdminReportData.sum(AdminReportData.ops({kind: ['sale', 'refund'], pk: true}), 'amount');
            return rows.length > 0 && rows.reduce((a, r) => a + r.sum, 0) === s;
        })()"""), "pushkin: сумма по ПК")
        check(ev("""(() => {
            const sp = AdminReportKinds.specFor('Б-1'), rows = sp.rows({});
            const t = sp.total(rows).saldo;
            return rows.length === AdminStore.state.LEDGER.length && t === rows[rows.length - 1].saldo &&
              sp.rows({from: '2026-06-03', to: '2026-06-05'}).length === 4;
        })()"""), "ledger: сальдо и фильтр по DD.MM")
        check(ev("AdminReportSpecs.get('3').doc && AdminReportSpecs.get('3а').doc ? true : false"), "ручные 3/3а на месте")
        check(ev("AdminReportSpecs.get('нет-такого') === null"), "неизвестный номер → null")

        summary = Counter()
        for no in catalog:
            summary[kinds[no]] += 1
            n0 = len(errors)
            page.goto(BASE + "report.html?no=" + quote(no, safe=""))
            page.wait_for_selector("#repRun")
            check(page.is_hidden("#repNotice"), "%s: плашка «не заведены»" % no)
            page.click("#repRun")
            page.wait_for_selector("#repResultWrap:not([hidden])")
            if no in ("3", "3а"):
                ok = page.locator("#repResult .rdoc, #repResult table").count() > 0
            else:
                data_rows = page.locator("#repResult table tbody tr").count()
                empty = page.locator("#repResult .rep-empty").count()
                ok = data_rows >= 1 or empty == 1
                if data_rows:
                    ok = ok and page.locator("#repResult table tfoot tr").count() == 1
                txt = page.inner_text("#repResult")
                ok = ok and "undefined" not in txt and "NaN" not in txt
            check(ok, "%s (%s): нет таблицы/пустого состояния или мусор в ячейках" % (no, kinds.get(no)))
            check(len(errors) == n0, "%s: ошибки %s" % (no, errors[n0:]))

        # параметр формы доходит до rows: мероприятие сужает таблицу
        page.goto(BASE + "report.html?no=" + quote("15", safe=""))
        page.click("#repRun")
        n_all = page.locator("#repResult tbody tr").count()
        page.select_option("#f_eventId", "ev-1")
        page.click("#repRun")
        n_one = page.locator("#repResult tbody tr").count()
        check(n_all > 1 and n_one == 1, "форма → rows(params): %d → %d" % (n_all, n_one))

        print("вид → количество номеров:")
        for k, n in sorted(summary.items(), key=lambda x: -x[1]):
            print("  %-11s %d" % (k, n))
        print("  всего      %d" % sum(summary.values()))

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
