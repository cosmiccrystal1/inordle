import pathlib,json,re
p=pathlib.Path(__file__).resolve().parent
blocked=set((p/'data/blocked.txt').read_text(encoding='utf-8').splitlines())
# Exclude listed terms and their common inflections; additions belong in blocked.txt.
blocked |= {w+s for w in list(blocked) for s in ['s','es','ed','ing','er','ers']}
words=sorted({w for w in (p/'data/dictionary-source.txt').read_text(encoding='utf-8').splitlines() if re.fullmatch('[a-z]{2,32}',w) and w not in blocked})
(p/'data/words.json').write_text(json.dumps(words,separators=(',',':')))
with (p/'supabase/dictionary.sql').open('w') as f:
 for i in range(0,len(words),2000):
  f.write('insert into public.dictionary(word) values '+','.join("('%s')"%w for w in words[i:i+2000])+' on conflict do nothing;\n')
print(len(words),'filtered dictionary entries')

# Keep the prevalidated trail catalog in sync with dictionary changes.
import subprocess,sys
subprocess.run([sys.executable,str(p/"build-trails.py")],check=True)
