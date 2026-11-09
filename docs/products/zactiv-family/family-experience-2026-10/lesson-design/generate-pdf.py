from pathlib import Path
import json
r=Path(__file__).resolve().parent
d=json.loads((r/"data/lesson.json").read_text())
assert d['activities'], 'Lesson requires activities'
for a in d['activities']:
 assert a['minutes']['min'] <= a['minutes']['max']
 assert a['diagram'] in ['castle','tunnels','defenders']
 assert a['steps'], 'Each activity requires steps'
(r/'output/pdf').mkdir(parents=True,exist_ok=True)
# Schematics deliberately separate from pedagogical content, rendered identically on web and PDF.
import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
fontroot=Path(reportlab.__file__).parent/"fonts"
pdfmetrics.registerFont(TTFont("MovesRegular", str(fontroot/"Vera.ttf")))
pdfmetrics.registerFont(TTFont("MovesBold", str(fontroot/"VeraBd.ttf")))
from reportlab.graphics.shapes import Drawing, Rect, Circle, Polygon, Line, String
from reportlab.graphics import renderSVG,renderPDF
from reportlab.lib.colors import HexColor
P=HexColor('#482C53'); L=HexColor('#DED5EB'); C=HexColor('#D5E75A'); T=HexColor('#302A38')
def diagram(kind):
 q=Drawing(360,230);q.add(Rect(0,0,360,230,rx=14,fillColor=HexColor('#F6F5FA'),strokeColor=None))
 def cone(x,y):q.add(Polygon([x-5,y-5,x+5,y-5,x,y+5],fillColor=C,strokeColor=T,strokeWidth=.6))
 def player(x,y,light=False):q.add(Circle(x,y,7,fillColor=L if light else P,strokeColor=P,strokeWidth=1))
 if kind=='castle':
  pts=[(125,173),(145,190),(237,136),(237,112),(133,60),(112,78)]
  for x,y in pts:cone(x,y)
  for x,y in [(137,175),(226,124),(125,80)]:player(x,y)
  player(175,125,True)
  q.add(Line(181,127,213,137,strokeColor=P,strokeWidth=2));q.add(Polygon([213,137,203,139,206,131],fillColor=P,strokeColor=None))
  q.add(String(175,103,'Start',fontName='MovesRegular',fontSize=9,textAnchor='middle',fillColor=T))
 else:
  for i in range(3):
   x=25+i*110;q.add(Rect(x,35,90,156,fillColor=None,strokeColor=P,strokeWidth=1))
   for xx in [x,x+90]:
    for yy in [35,191]:cone(xx,yy)
   for j in range(4):
    px=x+25+(j%2)*40;py=65+(j//2)*75;player(px,py);q.add(Circle(px+10,py-8,3,fillColor=None,strokeColor=T))
   if kind=='defenders':
    for py in [90,160]:cone(x+45,py)
   q.add(String(x+45,205,f'Group {i+1}',fontName='MovesRegular',fontSize=10,textAnchor='middle',fillColor=T))
 q.add(String(180,14,'Schematic redraw - check setup before use',fontName='MovesRegular',fontSize=8,textAnchor='middle',fillColor=T))
 return q
for kind in ['castle','tunnels','defenders']:renderSVG.drawToFile(diagram(kind),str(r/f'{kind}.svg'))
# Five page teacher handout, generated from exactly the same JSON consumed by the webpage.
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from xml.sax.saxutils import escape
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='HeroSM',fontName='MovesBold',fontSize=29,leading=32,textColor=P,spaceAfter=14))
styles.add(ParagraphStyle(name='HSM',fontName='MovesBold',fontSize=15,leading=19,textColor=P,spaceBefore=11,spaceAfter=6))
styles.add(ParagraphStyle(name='BodySM',fontName='MovesRegular',fontSize=10,leading=13.5,textColor=T,spaceAfter=5))
styles.add(ParagraphStyle(name='MetaSM',fontName='MovesBold',fontSize=9,leading=13,textColor=P,spaceAfter=10))
styles.add(ParagraphStyle(name='SmallSM',fontName='MovesRegular',fontSize=8,leading=11,textColor=T))
def clean(s):return escape(s.replace('\u2019',"'").replace('\u2013','-'))
def p(s,style='BodySM'):return Paragraph(clean(s),styles[style])
def bullets(xs):return [Paragraph('&#8226; '+clean(x),styles['BodySM']) for x in xs]
def heading(s):return p(s,'HSM')
def duration(a):
 m=a['minutes'];return str(m['min'])+('–'+str(m['max']) if m['max']!=m['min'] else '')+' min'
def footer(c,doc):
 w,h=A4;c.saveState();c.setStrokeColor(L);c.line(40,h-51,w-40,h-51);c.setFillColor(P);c.setFont('MovesBold',12);c.drawString(69,h-35,'School Moves');c.setStrokeColor(P);c.setLineWidth(3);c.setLineCap(1);c.line(42,h-35,47,h-30);c.line(50,h-35,55,h-25);c.setStrokeColor(C);c.line(59,h-35,64,h-21);c.setFont('MovesRegular',8);c.drawRightString(w-40,h-34,f"{d['year'].upper()} / {d['unit'].upper()} / WEEK {d['week']}");c.setStrokeColor(L);c.line(40,40,w-40,40);c.setFillColor(T);c.setFont('MovesRegular',7);c.drawString(40,27,'DESIGN EXAMPLE | Screenshot-transcribed content | '+d['revision']);c.drawRightString(w-40,27,f"{doc.page} / {len(d['activities'])+2}");c.restoreState()
story=[p('LESSON OVERVIEW','MetaSM'),p(d['title'],'HeroSM'),p(d['summary'])]
meta=Table([[p('YEAR GROUP','MetaSM'),p('CLASS','MetaSM'),p('SPACE','MetaSM')],[p(d['year']),p(str(d['children'])+' children'),p(d['space'])]],colWidths=[170,170,170]);meta.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),HexColor('#F6F5FA')),('BOX',(0,0),(-1,-1),.5,L),('LEFTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10)]));story+=[Spacer(1,10),meta,heading('Before you start'),p('Equipment: '+d['equipment']),p('Category: '+d['category']),heading('Key learning objectives')]+bullets(d['objectives'])+[heading('Whole child')]+bullets(d['wholeChild'])+[heading('Session at a glance')]
rows=[[p(a['phase'],'MetaSM'),p(a['title']),p(duration(a).replace('–','-'))] for a in d['activities']]
t=Table(rows,colWidths=[100,325,85]);t.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.5,L),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),5)]));story+=[t,p(f"Activity blocks total {sum(a['minutes']['min'] for a in d['activities'])}-{sum(a['minutes']['max'] for a in d['activities'])} minutes. Reflection and transitions have no specified duration in the source.",'SmallSM'),heading('Teacher reminder'),p(d['tip']),Spacer(1,15),p(d['reviewStatus']+'. No new adaptation or safety guidance has been inferred.','SmallSM'),PageBreak()]
for idx,a in enumerate(d['activities']):
 story += [p(a['phase'].upper()+' / '+duration(a).replace('–','-'),'MetaSM'),p(a['title'],'HeroSM'),p(a['setup'])]
 dg=diagram(a['diagram']);dg.width=360;dg.height=230;dg.scale(.60,.60);dg.width=216;dg.height=138
 story += [dg,heading('How to run it')]+bullets(a['steps'])
 if a['progression']:story += [heading('Progression')]+bullets(a['progression'])
 story += [heading('Teaching cues')]+bullets(a['cues'])+[PageBreak()]
story += [p('FINISH & REVIEW','MetaSM'),p('Reflect on the learning','HeroSM'),p(d['reflectionIntro']),heading('Ask the children')]+bullets(d['reflection'])+[heading('After you teach')]+bullets(d['afterTeach'])+[heading('Your notes'),Spacer(1,12)]
for i in range(5):
 line=Table([['']],colWidths=[510],rowHeights=[22]);line.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),.5,L)]));story.append(line)
SimpleDocTemplate(str(r/'output/pdf/school-moves-year-3-football-week-1.pdf'),pagesize=A4,rightMargin=40,leftMargin=40,topMargin=70,bottomMargin=55,title='School Moves - Year 3 Football Week 1',author='School Moves design example').build(story,onFirstPage=footer,onLaterPages=footer)
print('Built shared lesson JSON, diagrams and PDF.')
