"""Verify release equivalence, acceptance references and local documentation links.

Read-only. Run from the candidate worktree with Python 3.12.
"""
import csv
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

ROOT = Path.cwd().resolve()
SOURCE = '597d045f8bcdbc14a2e68f4d7d8cdc435267c98f'
BASE = 'c8f934492f0cc7809282657270df34b4474915ca'
GIT = ['git', '-c', 'safe.directory='+ROOT.as_posix()]

def git(*args):
    return subprocess.check_output([*GIT, *args]).decode('utf-8').strip()

def main():
    changed = git('diff', '--name-only', SOURCE, '--', 'frontend')
    assert not changed, 'Frontend differs from approved H6: '+changed
    assert git('rev-parse', SOURCE+':frontend') == 'd7c0ff7905bbacb98c82664ca0568bb5afafc8e0'
    protected = git('diff', '--name-only', BASE, '--', 'services', 'docker', 'compose.yaml', 'compose.apps.yml', 'compose.datos.yml')
    assert not protected, 'Protected scope changed: '+protected
    cases = list(csv.DictReader((ROOT/'docs/release/H6_RELEASE_MATRIX.csv').open(encoding='utf-8-sig')))
    assert len(cases)==58 and len({row['ID'] for row in cases})==58
    assert sum(bool(re.fullmatch(r'R\d+', row['ID'])) for row in cases)==15
    for case in cases:
        for ref in case['Evidencia'].split(';'):
            ref=ref.strip()
            assert any((ROOT/('frontend/tests/'+prefix+ref)).is_file() for prefix in ('','e2e/')), (case['ID'],ref)
    pages=list((ROOT/'frontend/src/app').rglob('page.tsx'))
    assert len(pages)==15
    # New H6 docs must have no missing local file links. Baseline issues are
    # reported separately and must not cause unauthorized edits to main docs.
    base=set(git('ls-tree','-r','--name-only',BASE).splitlines())
    broken_new=[]; broken_base=[]; checked=0
    for p in [ROOT/'README.md', *(ROOT/'docs').rglob('*.md')]:
        body=re.sub(r'```[\s\S]*?```','',p.read_text(encoding='utf-8'))
        for target in re.findall(r'\]\(([^)]+)\)',body):
            target=target.split(' "',1)[0].strip('<>')
            if re.match(r'\w+:|#|/',target):continue
            # File existence only; heading fragments are intentionally kept.
            target=unquote(target.split('#',1)[0])
            if not target:continue
            checked+=1
            if not (p.parent/target).exists():
                record={'source':p.relative_to(ROOT).as_posix(),'target':target}
                (broken_base if record['source'] in base else broken_new).append(record)
    result={'frontendTree':'d7c0ff7905bbacb98c82664ca0568bb5afafc8e0','frontendDiff':changed,
            'protectedDiff':protected,'routes':len(pages),'acceptanceCases':len(cases),
            'localLinksChecked':checked,'brokenNewLinks':broken_new,'brokenBaselineLinks':broken_base}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    assert not broken_new, 'New documentation contains broken local file links'

if __name__=='__main__': main()
