# -*- coding: utf-8 -*-
"""Образец финансового отчёта ТБДТ (книга операций) — PDF-шаблон."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable
)

FONTS = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Arial", FONTS + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", FONTS + "Arial Bold.ttf"))

# palette (admin theme)
NAVY   = colors.HexColor("#1E2042")
NAVY_HI= colors.HexColor("#2C2E5C")
GOLD   = colors.HexColor("#E6B81C")
GOLD_D = colors.HexColor("#A8810F")
INK    = colors.HexColor("#16161A")
INK2   = colors.HexColor("#6B6B73")
LINE   = colors.HexColor("#E3E1DB")
SURF2  = colors.HexColor("#F4F3EF")
OK     = colors.HexColor("#2f9e5e")
OK_BG  = colors.HexColor("#E7F3EC")
BAD    = colors.HexColor("#c0492f")
BAD_BG = colors.HexColor("#F7E7E3")

def rub(n):
    s = f"{abs(int(n)):,}".replace(",", " ")
    return ("−" if n < 0 else "") + s + " руб."

# ---- ledger data (mirrors admin.js LEDGER) ----
LEDGER = [
    ("01.06", "Продажа билетов · онлайн",     "Касса",      318400, "income"),
    ("02.06", "Аренда сцены · репетиции",     "Постановка", -64000, "expense"),
    ("03.06", "Продажа билетов · касса",      "Касса",      142900, "income"),
    ("03.06", "Гонорары артистов",            "Зарплата",  -210000, "expense"),
    ("04.06", "Реклама · соцсети",            "Маркетинг",  -38500, "expense"),
    ("05.06", "Продажа билетов · агрегаторы", "Партнёры",    96700, "income"),
    ("06.06", "Костюмы и реквизит",           "Постановка", -52300, "expense"),
    ("07.06", "Продажа билетов · онлайн",     "Касса",      274100, "income"),
]
income  = sum(a for *_ , a, t in LEDGER if t == "income")
expense = sum(a for *_ , a, t in LEDGER if t == "expense")
profit  = income + expense

# styles
def st(name, **kw):
    base = dict(fontName="Arial", fontSize=9.5, textColor=INK, leading=13)
    base.update(kw); return ParagraphStyle(name, **base)

S        = st("s")
S_MUTE   = st("m", textColor=INK2, fontSize=9)
S_R      = st("r", alignment=2)
S_RB     = st("rb", alignment=2, fontName="Arial-Bold")
S_INCOME = st("inc", alignment=2, fontName="Arial-Bold", textColor=OK)
S_EXP    = st("exp", alignment=2, fontName="Arial-Bold", textColor=BAD)
S_TH     = st("th", fontName="Arial-Bold", fontSize=7.5, textColor=colors.white)
S_THR    = st("thr", fontName="Arial-Bold", fontSize=7.5, textColor=colors.white, alignment=2)
S_OP     = st("op", fontName="Arial-Bold", fontSize=9.5)

class HeaderBand(Flowable):
    """Navy header with theatre name + report title."""
    def __init__(self, w, h=30*mm): self.w, self.h = w, h
    def wrap(self, *a): return (self.w, self.h)
    def draw(self):
        c = self.canv
        c.setFillColor(NAVY); c.roundRect(0, 0, self.w, self.h, 6, fill=1, stroke=0)
        c.setFillColor(GOLD); c.rect(0, 0, 4, self.h, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Arial-Bold", 20); c.drawString(16, self.h-21, "ТБДТ")
        c.setFont("Arial", 8.5)
        c.setFillColor(colors.HexColor("#C9CAD8"))
        c.drawString(16, self.h-32, "Тюменский Большой Драматический Театр")
        c.setFillColor(GOLD)
        c.setFont("Arial-Bold", 8); c.drawRightString(self.w-16, self.h-16, "ФИНАНСОВЫЙ ОТЧЁТ")
        c.setFillColor(colors.HexColor("#C9CAD8"))
        c.setFont("Arial", 8); c.drawRightString(self.w-16, self.h-28, "Книга операций")

doc = SimpleDocTemplate(
    "/Users/thesimakov/Documents/GitHub/bk/docs/otchet-buhgalteriya-shablon.pdf",
    pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=14*mm, bottomMargin=16*mm,
    title="ТБДТ · Финансовый отчёт (образец)", author="ТБДТ")
W = A4[0] - 32*mm
story = []

story.append(HeaderBand(W))
story.append(Spacer(1, 9))

meta = Table([[
    Paragraph("Период: <b>01–07 июня 2026</b>", S_MUTE),
    Paragraph("Сформировано: <b>07.06.2026</b>", ParagraphStyle("x", parent=S_MUTE, alignment=2)),
]], colWidths=[W*0.6, W*0.4])
meta.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                          ("LINEBELOW",(0,0),(-1,-1),0.75,LINE),
                          ("BOTTOMPADDING",(0,0),(-1,-1),7)]))
story.append(meta)
story.append(Spacer(1, 12))

# ---- summary cards ----
def card(label, value, accent, vcolor):
    inner = Table(
        [[Paragraph(label.upper(), ParagraphStyle("cl", fontName="Arial-Bold", fontSize=7, textColor=INK2))],
         [Paragraph(value, ParagraphStyle("cv", fontName="Arial-Bold", fontSize=15, textColor=vcolor, leading=18))]],
        colWidths=[(W-16)/3])
    inner.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.white),
        ("LINEABOVE",(0,0),(-1,0),2.2,accent),
        ("BOX",(0,0),(-1,-1),0.75,LINE),
        ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
        ("TOPPADDING",(0,0),(0,0),11),("BOTTOMPADDING",(0,0),(0,0),2),
        ("TOPPADDING",(0,1),(0,1),0),("BOTTOMPADDING",(0,1),(0,1),12),
    ]))
    return inner

summary = Table([[card("Доходы", rub(income), OK, OK),
                  card("Расходы", rub(expense), BAD, BAD),
                  card("Прибыль", rub(profit), NAVY, NAVY)]],
                colWidths=[(W)/3]*3)
summary.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(0,0),8),
                             ("RIGHTPADDING",(1,0),(1,0),8),("VALIGN",(0,0),(-1,-1),"TOP")]))
story.append(summary)
story.append(Spacer(1, 16))

# ---- operations table ----
story.append(Paragraph("Книга операций", ParagraphStyle("h2", fontName="Arial-Bold", fontSize=12, textColor=INK)))
story.append(Spacer(1, 7))

rows = [[Paragraph("Дата", S_TH), Paragraph("Операция", S_TH), Paragraph("Категория", S_TH),
         Paragraph("Тип", S_TH), Paragraph("Сумма, руб.", S_THR)]]
for date, op, cat, amt, typ in LEDGER:
    badge = Paragraph(("Доход" if typ == "income" else "Расход"),
                      ParagraphStyle("b", fontName="Arial-Bold", fontSize=8,
                                     textColor=(OK if typ=="income" else BAD)))
    amt_p = Paragraph(rub(amt), S_INCOME if typ == "income" else S_EXP)
    rows.append([Paragraph(date, S_MUTE), Paragraph(op, S_OP),
                 Paragraph(cat, S_MUTE), badge, amt_p])

# total row
rows.append([Paragraph("", S), Paragraph("Итого за период", S_OP), Paragraph("", S),
             Paragraph("", S), Paragraph(rub(profit), S_RB)])

tbl = Table(rows, colWidths=[W*0.10, W*0.40, W*0.18, W*0.12, W*0.20], repeatRows=1)
ts = [
    ("BACKGROUND",(0,0),(-1,0),NAVY),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("LINEBELOW",(0,1),(-1,-2),0.5,LINE),
    ("LINEABOVE",(0,-1),(-1,-1),1.2,NAVY),
    ("BACKGROUND",(0,-1),(-1,-1),SURF2),
]
for i in range(1, len(LEDGER)+1):
    if i % 2 == 0:
        ts.append(("BACKGROUND",(0,i),(-1,i),colors.HexColor("#FBFAF7")))
tbl.setStyle(TableStyle(ts))
story.append(tbl)
story.append(Spacer(1, 16))

# ---- category breakdown ----
cats = {}
for *_, cat, in [(r[2], ) for r in []]: pass
agg = {}
for date, op, cat, amt, typ in LEDGER:
    agg.setdefault(cat, 0)
    agg[cat] += amt
story.append(Paragraph("Итоги по категориям", ParagraphStyle("h3", fontName="Arial-Bold", fontSize=11, textColor=INK)))
story.append(Spacer(1, 6))
crows = [[Paragraph("Категория", S_TH), Paragraph("Сумма, руб.", S_THR)]]
for cat, total in sorted(agg.items(), key=lambda x: x[1]):
    crows.append([Paragraph(cat, S),
                  Paragraph(rub(total), S_INCOME if total >= 0 else S_EXP)])
ctbl = Table(crows, colWidths=[W*0.6, W*0.4])
ctbl.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),NAVY_HI),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
    ("LINEBELOW",(0,1),(-1,-1),0.5,LINE),
]))
story.append(ctbl)
story.append(Spacer(1, 26))

# ---- signatures ----
sig = Table([
    [Paragraph("Главный бухгалтер", S_MUTE), Paragraph("Директор театра", S_MUTE)],
    [Paragraph("______________________  / Н. К. Аксёнова /", S),
     Paragraph("______________________  / А. Винтур /", S)],
], colWidths=[W/2, W/2])
sig.setStyle(TableStyle([("TOPPADDING",(0,0),(-1,0),0),("BOTTOMPADDING",(0,0),(-1,0),14),
                         ("TOPPADDING",(0,1),(-1,1),0)]))
story.append(sig)
story.append(Spacer(1, 16))
story.append(Paragraph(
    "Демонстрационный документ. Сформирован автоматически из книги операций кабинета ТБДТ. "
    "Суммы иллюстративные. М. П.",
    ParagraphStyle("foot", fontName="Arial", fontSize=7.5, textColor=INK2, leading=11)))

doc.build(story)
print("OK")
