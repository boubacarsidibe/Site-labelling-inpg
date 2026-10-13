#!/usr/bin/env python3
"""Voix off gratuite et locale : SVOX Pico (paquet Ubuntu `libttspico-utils`), voix française féminine.
Usage : VIDEO_DIR=... python3 tts.py [s01 s02 ...]
Le texte lu est « respelé » pour la prononciation (sigles, mots anglais) ; les sous-titres gardent le texte d'origine (vo.json)."""
import json, os, re, subprocess, sys, tempfile

V = os.environ.get('VIDEO_DIR', '/tmp/claude-0/video')
LEXIQUE = [
    (r'\bINPG\b', 'I N P G'), (r'\bNINEA\b', 'Ninéa'), (r'\bGold\b', 'Golde'), (r'\bPlatinum\b', 'Platinomme'),
    (r'\be-mails?\b', 'imèl'), (r'\bLabel\b', 'Labèl'), (r'[«»]', ''), (r'\s*:\s*', ', '), (r'\bSénégal Pétrole Distribution\b', 'Sénégal Pétrole Distribution'),
]

def prononciation(texte):
    for motif, remplacement in LEXIQUE:
        texte = re.sub(motif, remplacement, texte)
    return re.sub(r'\s+', ' ', texte).strip()

vo = json.load(open(f'{V}/vo.json'))
voulus = set(sys.argv[1:])
os.makedirs(f'{V}/audio', exist_ok=True)
for cle, texte in vo:
    if voulus and cle not in voulus:
        continue
    with tempfile.TemporaryDirectory() as tmp:
        wav = f'{tmp}/{cle}.wav'
        subprocess.run(['pico2wave', '-l', 'fr-FR', '-w', wav, prononciation(texte)], check=True)
        # 16 kHz mono -> 48 kHz, léger relief des médiums, niveau homogène
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af',
                        'aresample=48000,highpass=f=80,equalizer=f=2800:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=2.5,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ac', '1', '-q:a', '2', f'{V}/audio/{cle}.mp3'], check=True)
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{V}/audio/{cle}.mp3']))
    print(cle, f'{d:.1f}s', len(texte.split()), 'mots')
