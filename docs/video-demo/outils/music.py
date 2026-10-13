import numpy as np, wave, os, sys
V=os.environ.get('VIDEO_DIR','/tmp/claude-0/video')
SR=44100; DUR=int(sys.argv[1]) if len(sys.argv)>1 else 306; BPM=84; beat=60/BPM; bar=4*beat
t_total=np.zeros(int(SR*DUR)); L=t_total.copy(); R=t_total.copy()
def mtof(m): return 440*2**((m-69)/12)
# progression (C major): C - G/B - Am - F , then Dm - G - Em - F ...
prog=[[48,55,60,64,67],[47,55,59,62,67],[45,52,57,60,64],[41,48,57,60,65],
      [50,57,62,65,69],[43,50,59,62,67],[40,52,59,64,67],[41,48,57,60,65]]
def add(buf,start,sig):
    i=int(start*SR); n=min(len(sig),len(buf)-i)
    if n>0: buf[i:i+n]+=sig[:n]
def pad(freq,length):
    t=np.arange(int(length*SR))/SR
    s=sum(np.sin(2*np.pi*freq*k*t+0.3*k)/k**1.6 for k in (1,2,3))
    s+=0.5*np.sin(2*np.pi*freq*1.003*t)
    env=np.minimum(1,t/1.2)*np.minimum(1,(length-t)/1.0)
    return s*env
def pluck(freq,length=1.6):
    t=np.arange(int(length*SR))/SR
    s=sum(np.sin(2*np.pi*freq*k*t)*np.exp(-t*(2.5+k*1.5))/k for k in (1,2,3,4))
    return s*np.minimum(1,t/0.005)
nbars=int(DUR/bar)+1
rng=np.random.default_rng(7)
for b in range(nbars):
    ch=prog[b%len(prog)]; t0=b*bar
    for m in ch[:4]:
        s=pad(mtof(m),bar+1.0)*0.045
        add(L,t0,s*0.9); add(R,t0,s*1.1)
    add(L,t0,pad(mtof(ch[0]-12),bar+0.8)*0.05); add(R,t0,pad(mtof(ch[0]-12),bar+0.8)*0.05)
    # gentle arpeggio in 8ths
    arp=[ch[2]+12,ch[3]+12,ch[4]+12,ch[3]+12]
    if b>=1:
        for k in range(8):
            m=arp[k%4]+(12 if (k==6 and b%2) else 0)
            v=0.05*(0.8+0.2*rng.random())
            s=pluck(mtof(m))*v; pan=0.5+0.35*np.sin(k)
            add(L,t0+k*beat/2,s*(1-pan)*1.2); add(R,t0+k*beat/2,s*pan*1.2)
    # soft pulse (kick-like) on beats 1 and 3 after intro
    if 2<=b:
        for k in (0,2):
            t=np.arange(int(0.3*SR))/SR
            kick=np.sin(2*np.pi*(55+40*np.exp(-t*30))*t)*np.exp(-t*12)*0.06
            add(L,t0+k*beat,kick); add(R,t0+k*beat,kick)
fade=np.ones_like(L); n=int(4*SR); fade[:n]=np.linspace(0,1,n); fade[-n:]=np.linspace(1,0,n)
st=np.stack([L*fade,R*fade],1); st/=np.abs(st).max()*1.12
with wave.open(f'{V}/audio/music_raw.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype('<i2').tobytes())
print('ok')
