"""Смоук AdminReportData: python3 tests/smoke_report_data.py"""
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
        page.on("console", lambda m: m.type == "error" and "font" not in (m.text + str(m.location)).lower()
                and "googleapis" not in str(m.location) and "gstatic" not in str(m.location)
                and errors.append(m.text))
        page.goto("http://127.0.0.1:%d/report.html?no=3" % port)
        page.wait_for_function("window.AdminReportData")
        ev = lambda js: page.evaluate(js)

        a = ev("JSON.stringify(AdminReportData.ops({}))")
        b = ev("JSON.stringify(AdminReportData.ops({}))")
        check(a == b, "детерминизм")
        n = ev("AdminReportData.ops({}).length")
        check(300 <= n <= 1500, "объём 300-1500 (получено %s)" % n)

        r = ev("AdminReportData.range()")
        check(r["min"] < r["max"], "range")
        mid = ev("(() => { const r = AdminReportData.range(); return r.min.slice(0,8) + '15'; })()")
        sub = ev("AdminReportData.ops({from:'%s'})" % mid)
        check(0 < len(sub) < n and all(o["opDate"] >= mid for o in sub), "фильтр from")
        e1 = ev("AdminReportData.ops({eventId:'ev-1'})")
        check(0 < len(e1) < n and all(o["eventId"] == "ev-1" for o in e1), "фильтр eventId")
        ch = ev("AdminReportData.ops({channel:'Касса', kind:['sale','refund']})")
        check(ch and all(o["channel"] == "Касса" and o["kind"] in ("sale", "refund") for o in ch), "channel+kind")
        both = ev("AdminReportData.ops({from:'%s', eventId:'ev-1'})" % mid)
        check(0 < len(both) <= len(e1) and all(o["opDate"] >= mid and o["eventId"] == "ev-1" for o in both), "комбинация")

        kinds = set(o["kind"] for o in ev("AdminReportData.ops({})"))
        check(kinds == {"sale", "refund", "reserve", "invite"}, "все виды: %s" % kinds)
        check(ev("AdminReportData.sum(AdminReportData.ops({kind:'sale'}), 'amount')") > 0, "продажи > 0")
        check(ev("AdminReportData.sum(AdminReportData.ops({kind:'refund'}), 'amount')") < 0, "возвраты < 0")
        check(ev("AdminReportData.ops({kind:'invite'}).every(o => o.price === 0 && o.amount === 0)"), "приглашения 0")
        check(ev("AdminReportData.ops({}).every(o => o.pk === (o.pay === 'Пушкинская карта'))"), "pk согласован с оплатой")
        check(ev("(() => { const seen = new Set(); return AdminReportData.ops({}).every(o => { if (o.kind==='x') return true; const k=[o.eventId,o.zone,o.row,o.seat].join('|'); if (seen.has(k)) return false; seen.add(k); return true; }); })()"), "места без повторов")
        check(ev("AdminReportData.ops({}).every(o => o.opDate <= o.eventDate)"), "операции не позже показа")
        check(ev("AdminReportData.groupBy(AdminReportData.ops({}), o => o.zone).size") == 4, "groupBy")
        check(len(ev("AdminReportData.events()")) == 4, "events")

        check(ev("(() => { const r = AdminReportData.seeded(7); const seen = new Set(); for (let i = 0; i < 100000; i++) { const v = r(); if (!(v >= 0 && v < 1)) return false; seen.add(v); } return seen.size > 99000; })()"), "ГПСЧ: 100k значений в [0,1), без коротких циклов")
        check(ev("AdminReportData.ops({}).every(o => Number.isInteger(o.row) && Number.isInteger(o.seat) && o.row > 0 && o.seat > 0)"), "row/seat целые, без NaN")

        # кеш сбрасывается при смене данных
        ev("AdminStore.update(s => { s.EVENTS[0].date = '2026-07-20'; })")
        c = ev("JSON.stringify(AdminReportData.ops({}))")
        check(c != a, "смена данных меняет журнал")

        check(not errors, "ошибки консоли: %s" % errors)
        br.close()
finally:
    srv.shutdown()

print("FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)
