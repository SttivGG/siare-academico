"""Verificación documental reproducible, sin acceso a servicios ni cambios productivos."""
from pathlib import Path
import hashlib
import json
import re
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
DESIGN = HERE.parent
REPO = HERE.parents[2]
OUT = DESIGN / 'evidencias/h6-1'
OUT.mkdir(exist_ok=True, parents=True)
css = (HERE / 'tokens.css').read_text(encoding='utf-8')
blocks = re.findall(r':root(?:\[data-theme=dark\])?\s*\{([^}]+)\}', css)
assert len(blocks) == 2
variables = lambda block: dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', block))
light = variables(blocks[0])
dark_override = variables(blocks[1])
dark = light | dark_override
tokens = {'status': 'proposed; not approved or imported by frontend', 'source': 'tokens.css',
          'light': light, 'dark': dark, 'darkOverrides': dark_override,
          'targets': {'textNormal': 4.5, 'controlAndFocus': 3, 'touchCSSPixels': 44}}
(HERE/'tokens.json').write_text(json.dumps(tokens, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')

def rgba(value):
    if value.startswith('#'):
        return [int(value[i:i+2],16)/255 for i in (1,3,5)] + [1]
    parts = [float(v) for v in re.findall(r'[\d.]+', value)]
    assert len(parts) == 4, value
    return [v/255 for v in parts[:3]] + [parts[3]]

def composite(front, back):
    return [front[i]*front[3]+back[i]*(1-front[3]) for i in range(3)] + [1]

def luminance(color):
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color[:3]]
    return sum(v*w for v,w in zip(c,[.2126,.7152,.0722]))

def ratio(a,b):
    x,y=sorted([luminance(a),luminance(b)])
    return (y+.05)/(x+.05)

results=[]
for theme,v in [('light',light),('dark',dark)]:
    for fg,bg in [('text','surface'),('muted','surface'),('faint','surface'),('link','surface'),
                  ('text','rose'),('text','mint'),('text','cream'),('text','blue-pastel'),
                  ('on-brand','brand'),('on-brand','brand-hover'),('success','success-bg'),
                  ('info','info-bg'),('warning','warning-bg'),('danger','danger-bg')]:
        r=ratio(rgba(v['--'+fg]),rgba(v['--'+bg]))
        results.append({'theme':theme,'foreground':fg,'background':bg,'ratio':round(r,3),'target':4.5,'pass':r>=4.5})
    for base in ['canvas','wash-a','wash-b']:
        surface=composite(rgba(v['--glass']),rgba(v['--'+base]))
        for fg in ['text','muted','link']:
            r=ratio(rgba(v['--'+fg]),surface)
            results.append({'theme':theme,'foreground':fg,'background':f'glass over {base}','ratio':round(r,3),'target':4.5,'pass':r>=4.5})
        field=composite(rgba(v['--input']),surface)
        for fg in ['control','focus']:
            r=ratio(rgba(v['--'+fg]),field)
            results.append({'theme':theme,'foreground':fg,'background':f'input over glass over {base}','ratio':round(r,3),'target':3,'pass':r>=3})
data={'checkedAt':datetime.now(timezone.utc).isoformat(),'method':'WCAG relative luminance sRGB; alpha composited against declared canvas and two gradient extremes',
      'limitations':'Calculated token pairs, not pixel-level or complete WCAG audit; decorative borders excluded; browser rendering/forced colors still need manual review',
      'results':results,'failures':[r for r in results if not r['pass']]}
(OUT/'contraste.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert not data['failures'], data['failures']

# Existing source asset and original H6-0 evidence must remain intact.
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(HERE/'assets/urbanist-latin.woff2') == sha(REPO/'frontend/public/fonts/urbanist-latin.woff2')
assert sha(HERE/'assets/OFL-Urbanist.txt') == sha(REPO/'frontend/public/fonts/OFL-Urbanist.txt')
old=DESIGN/'evidencias/h6-0'
for row in (old/'manifest.sha256').read_text(encoding='utf-8').splitlines():
    expected,name=row.split('  ',1)
    assert sha(old/name)==expected, f'H6-0 changed: {name}'

# Relative links across new Markdown/HTML assets, ignoring query parameters and anchors.
for folder in [HERE,OUT]:
    (folder/'manifest.sha256').touch(exist_ok=True)
broken=[]
for doc in [*DESIGN.glob('H6_1_*.md'),*HERE.glob('*.html'),OUT/'README.md']:
    if not doc.exists():continue
    text=doc.read_text(encoding='utf-8')
    static_html=re.sub(r'<script\b[^>]*>.*?</script>','',text,flags=re.S)
    links=re.findall(r'\]\(([^)]+)\)',text) if doc.suffix=='.md' else re.findall(r'(?:href|src)="([^"]+)"',static_html)
    for link in links:
        if link.startswith(('http:','https:','#','data:')) or '${' in link:continue
        dest=link.split('?')[0].split('#')[0]
        if dest and not (doc.parent/dest).exists():broken.append(f'{doc.name}: {link}')
assert not broken, broken
for folder in [HERE,OUT]:
    rows=[f'{sha(p)}  {p.relative_to(folder).as_posix()}' for p in sorted(folder.rglob('*')) if p.is_file() and p.name!='manifest.sha256']
    (folder/'manifest.sha256').write_text('\n'.join(rows)+'\n',encoding='utf-8')
print(json.dumps({'contrastPairs':len(results),'contrastFailures':len(data['failures']),
                  'h60EvidencePreserved':True,'fontAndLicenseMatch':True,'brokenLinks':broken},indent=2))
