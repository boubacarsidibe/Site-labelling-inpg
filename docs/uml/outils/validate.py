import json,sys,collections
d=json.load(open(sys.argv[1]))
ids=collections.Counter(); refs=[]; noid=[]
def walk(o,path):
    if isinstance(o,dict):
        if '_type' in o:
            if '_id' in o: ids[o['_id']]+=1
            else: noid.append((o['_type'],path))
        if set(o.keys())=={'$ref'}: refs.append((o['$ref'],path))
        for k,v in o.items(): walk(v,path+'/'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): walk(v,path+f'[{i}]')
walk(d,'')
dup=[k for k,v in ids.items() if v>1]
bad=[(r,p) for r,p in refs if r not in ids]
print('elements',len(ids),'refs',len(refs),'dup',len(dup),'unresolved',len(bad),'noid',len(noid))
for x in (bad[:5]+noid[:5]): print(' ',x)
sys.exit(1 if dup or bad or noid else 0)
