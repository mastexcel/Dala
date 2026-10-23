# Découpe la planche d’icônes DALA (design/icon-sheet.png) en PNG transparents 144x144.
# Usage : python design/cut_icons.py design/icon-sheet.png apps/mobile/assets/icons 6
# (nécessite numpy + pillow ; le dernier argument est l’écart minimal entre deux icônes)
import sys, numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB'); A = np.asarray(img).astype(int)
nonwhite = (765 - A.sum(-1)) > 60
BANDS = {
  'r1': (58, 180, ['home','savings','invest','crowdfund','credit','profile','send','receive','scan','more']),
  'r3': (272, 392, ['goals','tontines','vault','autosave','contribution','interest','bonds','fcp','sukuk','performance','details','simulation']),
  'r5': (480, 592, ['explore','submit-project','validated-projects','investors','portfolio','news','score','request-loan','my-loans','schedule','repay','status']),
  'r7': (703, 800, ['tx-all','tx-savings','tx-invest','tx-crowdfund','tx-credit','transfers','deposit','withdraw','user','security','kyc','notifications','referral','settings']),
  'r9': (891, 968, ['back','close','menu','next','previous','add','edit','delete','success','pending','info','warning','error','more-dots']),
}
sheet = []
GAP=int(sys.argv[3]) if len(sys.argv)>3 else 22
for key,(y0,y1,names) in BANDS.items():
    band = nonwhite[y0:y1]
    col = band.sum(0) > 0
    segs=[]; x=0; W=len(col)
    while x<W:
        if col[x]:
            s=x
            while x<W and col[x]: x+=1
            segs.append([s,x])
        else: x+=1
    # merge gaps < 22px, drop thin lines
    merged=[]
    for s in segs:
        if merged and s[0]-merged[-1][1] < (22 if key=='r1' else GAP): merged[-1][1]=s[1]
        else: merged.append(s)
    merged=[m for m in merged if m[1]-m[0] > 12]
    if key=='r7': merged=[[30,104],[131,220],[241,316],[346,436],[461,518],[544,618],[649,726],[752,822],[871,954],[981,1053],[1079,1170],[1201,1274],[1307,1396],[1423,1507]]
    print(key, len(merged), len(names), merged)
    for name,(x0,x1) in zip(names, merged):
        sub = nonwhite[y0:y1, x0:x1]; rows=np.where(sub.any(1))[0]
        top, bot = y0+rows[0], y0+rows[-1]+1
        w, h = x1-x0, bot-top; side=max(w,h)+8
        cx, cy = (x0+x1)//2, (top+bot)//2
        clean = np.full_like(A, 255); clean[top:bot, x0:x1] = A[top:bot, x0:x1]
        crop = Image.fromarray(clean.astype(np.uint8)).crop((cx-side//2, cy-side//2, cx-side//2+side, cy-side//2+side))
        a = np.asarray(crop).astype(float)
        d = 765 - a.sum(-1)
        alpha = np.clip((d-18)/60,0,1)
        safe = np.where(alpha>0, alpha, 1)[...,None]
        rgb = np.clip((a - 255*(1-alpha[...,None]))/safe, 0, 255)
        rgba = Image.fromarray(np.dstack([rgb, alpha*255]).astype(np.uint8), 'RGBA').resize((144,144), Image.LANCZOS)
        rgba.save(f'{out}/{name}.png', optimize=True)
        sheet.append((name, rgba))
cs = Image.new('RGBA', (10*160, ((len(sheet)+9)//10)*180), (15,27,61,255))
d = ImageDraw.Draw(cs)
for i,(n,ic) in enumerate(sheet):
    x,y=(i%10)*160+8,(i//10)*180+4
    cs.paste(Image.new('RGBA',(144,144),(255,255,255,255)),(x,y)); cs.alpha_composite(ic,(x,y)); d.text((x,y+148),n,fill='white')
cs.save('design/icons-contact-sheet.png')
