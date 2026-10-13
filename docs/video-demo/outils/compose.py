#!/usr/bin/env python3
"""Assemble the Label INPG demo video: scenes -> crossfades -> overlays (badges,
lower thirds, subtitles) -> voice + music mix."""
import json, os, re, subprocess, sys

V = os.environ.get('VIDEO_DIR', '/tmp/claude-0/video')
SH = f'{V}/shots'
OUT = f'{V}/build'
os.makedirs(OUT, exist_ok=True)
FPS = 30
XF = 0.5          # crossfade between scenes
TEMPO = 0.95      # voice slowed slightly (rythme posé)

ROLE = {  # name: (label, ASS colour &HBBGGRR)
    'vis': ('Visiteur', '&H00B29108'),
    'ent': ('Entreprise', '&H006B9D1F'),
    'ges': ('Gestionnaire', '&H00EB6325'),
    'eva': ('Évaluateur', '&H00ED3A7C'),
    'aud': ('Auditeur', '&H000C8AEA'),
    'dec': ('Décideur', '&H004A17B5'),
    'sup': ('Superadministrateur', '&H00695547'),
    'adm': ('Administrateur', '&H008B7464'),
}

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(' '.join(cmd)[:3000]); print(r.stderr[-3000:]); sys.exit(1)
    return r.stdout

def dur(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())

def t0(name):
    return json.load(open(f'{SH}/{name}.marks.json'))['t0']

VO = dict(json.load(open(f'{V}/vo.json')))
VDUR = {k: dur(f'{V}/audio/{k}.mp3') / TEMPO for k in VO}

# ---------------------------------------------------------------- scenes
# full: parts = [(clip, a, b, speed, role)]   zoom = (t1, t2, Z, px, py) in scene time
# split: L, R clips, (a, b, speed), roles, band title
S = [
 dict(n='hook', parts=[('slide-hook', 0, 22, 1, None)], vo=('s01', 1.0)),
 dict(n='archi', parts=[('slide-archi', 0, 26, 1, None)], vo=('s02', 0.6), lt=('Solution & architecture', 'Angular · Django REST')),
 dict(n='public', parts=[('public', 0, 5.4, 1.35, 'vis'), ('public', 5.4, 8.9, 1, 'vis'), ('public', 8.9, 11.7, 1, 'vis'),
                         ('public', 14.6, 30.2, 2.4, 'vis'), ('public', 30.2, 34.5, 1, 'vis')], vo=('s03', 0.5),
      lt=('Portail public & inscription', 'Visiteur'), fast=[(10.3, 16.8)]),
 dict(n='login', parts=[('login', 0, 8.8, 1, 'ges'), ('slide-roles', 0, 9.5, 1, None)], vo=('s04', 0.5),
      lt=('Page de connexion', 'Gestionnaire')),
 dict(n='users', parts=[('users', 0, 10.3, 1, 'sup'), ('users', 10.3, 41.2, 4.0, 'sup'), ('users-admin', 0, 4.9, 1, 'adm')], vo=('s05', 0.4),
      lt=('Utilisateurs : comptes internes', 'Superadministrateur'), lt2=(18.0, 'Utilisateurs', 'Administrateur'),
      zoom=(2, 0.9, 4.9, 1.7, 1500, 560), fast=[(10.3, 18.0)]),
 dict(n='ent', parts=[('ent-demande', 0, 32.9, 1.25, 'ent')], vo=('s06', 0.4),
      lt=('Nouvelle demande & dépôt des pièces', 'Entreprise'), zoom=(0, 8.6, 11.2, 1.8, 900, 470)),
 dict(n='split1', split=('split-validation-L', 'split-validation-R', 0, 22.6, 1.25), roles=('ges', 'ent'), vo=('s07', 0.5),
      band='Validation des pièces  →  soumission du dossier'),
 dict(n='split2', split=('split-affectation-L', 'split-affectation-R', 0, 22.6, 1.25), roles=('ges', 'eva'), vo=('s08', 0.4),
      band='Démarrage de l’évaluation, affectation et audit'),
 dict(n='nc', parts=[('auditeur', 0, 8.1, 1.5, 'aud')], split=('split-nc-L', 'split-nc-R', 0, 17.1, 1.25), roles=('eva', 'ent'),
      vo=('s09', 0.4), lt=('Audit réalisé', 'Auditeur'), band='Non-conformité  →  « Corrections demandées »'),
 dict(n='split4', split=('split-reponse-L', 'split-reponse-R', 0, 20.9, 1.4), roles=('ent', 'eva'), vo=('s10', 0.5),
      band='Action corrective  →  clôture  →  décision'),
 dict(n='decision', parts=[('decideur', 0, 18.5, 1.3, 'dec')], vo=('s11', 0.4), lt=('Décision & certificat', 'Décideur'),
      zoom=(0, 8.6, 10.6, 2.0, 1620, 340)),
 dict(n='access', parts=[('refus-gestionnaire', 0, 8.9, 1.1, 'ges'), ('acces-refuse', 0, 4.7, 1, 'ent'), ('slide-menus', 0, 7.5, 1, None)],
      vo=('s12', 0.3), lt=('Contrôle des droits', 'Gestionnaire'), lt2=(8.1, 'Saisie de /admin/dashboard', 'Entreprise'),
      zoom=(0, 5.4, 7.9, 1.8, 640, 900)),
 dict(n='final', parts=[('ent-certifie', 0, 8.9, 1.15, 'ent'), ('historique', 0, 10.6, 1.5, 'sup'), ('registre', 0, 7.9, 1.2, 'sup')],
      vo=('s13', 0.4), lt=('Suivi du dossier certifié', 'Entreprise'), lt2=(7.7, 'Historique & registre des certificats', 'Superadministrateur'),
      zoom=(0, 1.6, 3.8, 1.8, 980, 400)),
 dict(n='recap', parts=[('slide-recap', 0, 19, 1, None)], vo=('s14', 0.6)),
 dict(n='end', parts=[('verification', 0, 3.7, 1, 'vis'), ('referentiels', 0, 2.5, 1, 'sup'), ('slide-end', 0, 15, 1, None)],
      vo=('s15', 0.4), lt=('Modules à venir', 'Pages non encore raccordées')),
]

def zoom_filter(z, total):
    t1, t2, Z, px, py = z; r = 0.6
    T = f'(on/{FPS})'
    s = (f"if(lt({T},{t1}),0,if(lt({T},{t1+r}),({T}-{t1})/{r},if(lt({T},{t2-r}),1,if(lt({T},{t2}),({t2}-{T})/{r},0))))")
    zexpr = f"1+{Z-1}*(({s})*({s})*(3-2*({s})))"
    return (f"zoompan=z='{zexpr}':x='clip({px}-iw/zoom/2,0,iw-iw/zoom)':y='clip({py}-ih/zoom/2,0,ih-ih/zoom)'"
            f":d=1:s=1920x1080:fps={FPS}")

def build_scene(sc):
    """Render one scene to OUT/<n>.mp4; returns (duration, timeline of (start,end,role|tuple))."""
    inputs, chains, labels, roles_tl, t = [], [], [], [], 0.0
    def add_input(f):
        inputs.extend(['-i', f]); return len(inputs) // 2 - 1
    for pi, (clip, a, b, sp, role) in enumerate(sc.get('parts', [])):
        i = add_input(f'{SH}/{clip}.mp4')
        lab = f'p{len(labels)}'
        f = f"[{i}:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps={FPS},scale=1920:1080,setsar=1"
        z = sc.get('zoom')
        if z and z[0] == pi: f += ',' + zoom_filter(z[1:], 0)
        if role: f += ",scale=1812:1020:flags=lanczos,pad=1920:1080:54:60:color=0x0b2647,setsar=1"
        chains.append(f + f"[{lab}]")
        labels.append(lab); d = (b - a) / sp
        roles_tl.append((t, t + d, role)); t += d
    if 'split' in sc:
        L, R_, segs = sc['split'][0], sc['split'][1], sc['split'][2]
        if not isinstance(segs, list): segs = [tuple(sc['split'][2:])]
        off = t0(R_) - t0(L)
        il, ir = add_input(f'{SH}/{L}.mp4'), add_input(f'{SH}/{R_}.mp4')
        sp_labels = []
        for si, (a, b, sp) in enumerate(segs):
            chains.append(f"[{il}:v]tpad=stop_mode=clone:stop_duration=60,trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps={FPS}[sl{si}]")
            chains.append(f"[{ir}:v]tpad=start_duration={max(off,0):.3f}:start_mode=clone:stop_mode=clone:stop_duration=60,trim={a + max(-off,0)}:{b + max(-off,0)},setpts=(PTS-STARTPTS)/{sp},fps={FPS}[sr{si}]")
            lab = f'p{len(labels)}'
            chains.append(f"[sl{si}][sr{si}]hstack=inputs=2,pad=1920:1080:0:60:color=0x0b2647,drawbox=x=958:y=60:w=4:h=1020:color=0x0b2647:t=fill,setsar=1[{lab}]")
            labels.append(lab); d = (b - a) / sp
            roles_tl.append((t, t + d, ('split',) + sc['roles'] + (sc['band'],))); t += d
    vtot = t
    vo, off = sc['vo']
    total = max(vtot, off + VDUR[vo] + 0.7)
    chains.append(''.join(f'[{l}]' for l in labels) + f"concat=n={len(labels)}:v=1:a=0,tpad=stop_mode=clone:stop_duration={total - vtot + 1:.3f},trim=0:{total:.3f},setpts=PTS-STARTPTS[c]")
    last = 'c'
    chains.append(f"[{last}]format=yuv420p[out]")
    out = f'{OUT}/{sc["n"]}.mp4'
    run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(chains), '-map', '[out]',
         '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', out])
    real = dur(out)
    print(f'{sc["n"]:9s} video {vtot:6.2f}s  scene {real:6.2f}s  voice {VDUR[vo]:5.2f}s')
    return real, roles_tl

only = sys.argv[1:]
meta = {}
cache = f'{OUT}/meta.json'
if os.path.exists(cache): meta = json.load(open(cache))
for sc in S:
    if not only or sc['n'] in only or 'all' in only or sc['n'] not in meta:
        d, tl = build_scene(sc); meta[sc['n']] = {'dur': d, 'tl': tl}
json.dump(meta, open(cache, 'w'))

# ---------------------------------------------------------------- timeline
starts, t = [], 0.0
for k, sc in enumerate(S):
    starts.append(t); t += meta[sc['n']]['dur'] - (XF if k < len(S) - 1 else 0)
TOTAL = t
print(f'TOTAL {TOTAL:.2f}s')

# ---------------------------------------------------------------- video concat with crossfades
inp = []
for sc in S: inp += ['-i', f'{OUT}/{sc["n"]}.mp4']
fc, prev, acc = [], '0:v', meta[S[0]['n']]['dur']
for k in range(1, len(S)):
    lab = f'x{k}'
    fc.append(f"[{prev}][{k}:v]xfade=transition=fade:duration={XF}:offset={acc - XF:.3f}[{lab}]")
    prev = lab; acc += meta[S[k]['n']]['dur'] - XF
fc.append(f"[{prev}]fade=t=in:st=0:d=0.8,fade=t=out:st={TOTAL - 1.2:.3f}:d=1.2,format=yuv420p[v]")
run(['ffmpeg', '-y', '-v', 'error', *inp, '-filter_complex', ';'.join(fc), '-map', '[v]', '-c:v', 'libx264',
     '-preset', 'medium', '-crf', '17', '-r', str(FPS), f'{OUT}/video_raw.mp4'])

# ---------------------------------------------------------------- ASS overlays
def ts(x):
    x = max(0, x); h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f'{h}:{m:02d}:{s:05.2f}'

ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 0", "",
       "[V4+ Styles]",
       "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
       "Style: Sub,Inter,40,&H00FFFFFF,&H00FFFFFF,&H8C0B1A2E,&H8C0B1A2E,0,0,0,0,100,100,0,0,3,14,0,2,160,160,34,1",
       "Style: Badge,Inter,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0.5,0,3,12,0,7,0,0,0,1",
       "Style: BadgeS,Inter,25,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0.5,0,3,9,0,7,0,0,0,1",
       "Style: Band,Inter,27,&H00F2E0CF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0.5,0,1,0,0,8,0,0,0,1",
       "Style: LT1,Inter,40,&H00FFFFFF,&H00FFFFFF,&H22472B10,&H22472B10,1,0,0,0,100,100,0,0,3,18,0,1,0,0,0,1",
       "Style: LT2,Inter,28,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0.5,0,3,10,0,1,0,0,0,1",
       "Style: Fast,Inter,24,&H00FFFFFF,&H00FFFFFF,&H64000000,&H64000000,1,0,0,0,100,100,1,0,3,8,0,9,0,0,0,1",
       "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
def ev(a, b, style, text, layer=0):
    ass.append(f"Dialogue: {layer},{ts(a)},{ts(b)},{style},,0,0,0,,{text}")

role_colour = lambda r: ROLE[r][1]
for k, sc in enumerate(S):
    st = starts[k]; d = meta[sc['n']]['dur']
    for (a, b, r) in meta[sc['n']]['tl']:
        A = st + a + (0.25 if a == 0 and k else 0); B = st + b - (XF if b >= d - 0.01 and k < len(S) - 1 else 0)
        if r is None: continue
        if isinstance(r, list) or isinstance(r, tuple):
            if r[0] == 'split':
                _, rl, rr, band = r
                for x, rr_ in ((22, rl), (982, rr)):
                    ev(A, B, 'BadgeS', f"{{\\pos({x},14)\\3c{role_colour(rr_)}\\4c{role_colour(rr_)}\\fad(250,200)}}● {ROLE[rr_][0]}", 3)
                continue
        ev(A, B, 'BadgeS', f"{{\\pos(22,14)\\3c{role_colour(r)}\\4c{role_colour(r)}\\fad(250,200)}}● {ROLE[r][0]}", 3)
    def lower(at, title, sub, role=None):
        col = role_colour(role) if role else '&H00472B10'
        ev(at, at + 3.8, 'LT1', f"{{\\pos(56,872)\\fad(300,350)}}{title}", 4)
        ev(at, at + 3.8, 'LT2', f"{{\\pos(56,930)\\3c{col}\\4c{col}\\fad(300,350)}}{sub}", 4)
    rolekey = {v[0]: k for k, v in ROLE.items()}
    if 'lt' in sc:
        lower(st + 0.6, sc['lt'][0], sc['lt'][1], rolekey.get(sc['lt'][1]))
    if 'split' in sc and 'band' in sc:
        tl = meta[sc['n']]['tl']; sa = [x[0] for x in tl if isinstance(x[2], (list, tuple)) and x[2][0] == 'split'][0]
        rl, rr = sc['roles']; lower(st + sa + 0.5, sc['band'], f"{ROLE[rl][0]}  ⇄  {ROLE[rr][0]}", rl)
    if 'lt2' in sc:
        at, t1, t2 = sc['lt2']; lower(st + at + 0.3, t1, t2, rolekey.get(t2))
    for (a, b) in sc.get('fast', []):
        ev(st + a, st + b, 'Fast', "{\\pos(1890,24)\\fad(200,200)}▶▶ Accéléré", 5)

# subtitles: split each voice segment into chunks, timed by character count
def chunks(text):
    parts = re.split(r'(?<=[.:!?])\s+', text.strip())
    out = []
    for p in parts:
        while len(p) > 84:
            cut = p.rfind(', ', 0, 84)
            if cut < 30: cut = p.rfind(' ', 0, 84)
            out.append(p[:cut + 1].strip()); p = p[cut + 1:].strip()
        if p: out.append(p)
    return out
VOICE_AT = {}
for k, sc in enumerate(S):
    vo, off = sc['vo']; a0 = starts[k] + off; VOICE_AT[vo] = a0
    cs = chunks(VO[vo]); total = sum(len(c) for c in cs); t = a0; span = VDUR[vo] - 0.25
    for c in cs:
        d = span * len(c) / total
        ev(t, t + d - 0.05, 'Sub', c.replace('« ', '« ').replace(' »', ' »'), 2); t += d
open(f'{OUT}/overlay.ass', 'w').write('\n'.join(ass) + '\n')
json.dump({'starts': starts, 'voice_at': VOICE_AT, 'total': TOTAL}, open(f'{OUT}/timeline.json', 'w'), indent=1)

# ---------------------------------------------------------------- audio
ai, af, mix = [], [], []
for n, (vo, at) in enumerate(sorted(VOICE_AT.items())):
    ai += ['-i', f'{V}/audio/{vo}.mp3']
    af.append(f"[{n}:a]aresample=48000,atempo={TEMPO},adelay={int(at * 1000)}:all=1[v{n}]"); mix.append(f'[v{n}]')
nv = len(VOICE_AT)
ai += ['-i', f'{V}/audio/music.wav']
af.append(f"{''.join(mix)}amix=inputs={nv}:normalize=0,apad,atrim=0:{TOTAL:.3f}[voice]")
af.append("[voice]asplit=2[vk][vs]")
af.append(f"[{nv}:a]atrim=0:{TOTAL:.3f},volume=0.26,afade=t=out:st={TOTAL - 4:.3f}:d=4[mus]")
af.append("[mus][vs]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=700:makeup=1[duck]")
af.append("[vk][duck]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
run(['ffmpeg', '-y', '-v', 'error', *ai, '-filter_complex', ';'.join(af), '-map', '[a]', '-ar', '48000', '-c:a', 'pcm_s16le', f'{OUT}/mix.wav'])

# ---------------------------------------------------------------- final
final = f'{V}/Label-INPG-demo.mp4'
run(['ffmpeg', '-y', '-v', 'error', '-i', f'{OUT}/video_raw.mp4', '-i', f'{OUT}/mix.wav',
     '-vf', f"ass={OUT}/overlay.ass:fontsdir=/usr/share/fonts/opentype/inter", '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
     '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', final])
print('FINAL', final, dur(final))
