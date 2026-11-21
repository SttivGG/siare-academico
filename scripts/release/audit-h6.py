"""Read-only inventory of committed H6/main and local worktrees (Python 3.12).

Run from the candidate: python scripts/release/audit-h6.py --workspace <root>
Generated/private paths are summarized as groups; their file-level manifests stay
in ignored .cache/h6-final. No source files, Docker resources or refs are changed.
"""
import argparse
import collections
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

BASE = 'c8f934492f0cc7809282657270df34b4474915ca'
H6 = '597d045f8bcdbc14a2e68f4d7d8cdc435267c98f'
URL = 'https://github.com/SttivGG/siare-academico/blob/' + H6 + '/'

def git(root, *args):
    return subprocess.check_output(['git', '-c', 'safe.directory='+root.as_posix(), '-C', str(root), *args])

def tree(root, ref):
    result = {}
    for entry in git(root, 'ls-tree', '-rlz', ref).split(b'\0'):
        if not entry:
            continue
        meta, name = entry.split(b'\t', 1)
        mode, kind, oid, size = meta.split()
        if kind == b'blob':
            result[name.decode('utf8')] = (oid.decode(), int(size))
    return result

def blobs(root, ids):
    process = subprocess.Popen(['git', '-c', 'safe.directory='+root.as_posix(), '-C', str(root), 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    result = {}
    for oid in sorted(ids):
        process.stdin.write((oid+'\n').encode()); process.stdin.flush()
        header = process.stdout.readline().split()
        data = process.stdout.read(int(header[2])); process.stdout.read(1)
        result[oid] = data
    process.stdin.close(); process.wait()
    return result

def write_csv(path, rows, fields):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)

def classify(path):
    if path.startswith(('docs/design/evidencias/', 'docs/release/evidence/', 'docs/capturas/')):
        return 'C', 'Evidencia histórica; no se usa en runtime ni como fixture'
    if path.startswith('docs/design/h6-1/'):
        return 'C', 'Prototipo H6-1 histórico; tokens y componentes finales viven en frontend'
    if path.startswith('docs/design/') and Path(path).name not in {'H6_APARIENCIA_RECURSOS.md', 'H6_SORVO_SISTEMA.md', 'H6_3_RECUPERACION_SEGURIDAD.md'}:
        return 'C', 'Decisión o resultado de fase H6 anterior; conservar original e índice permanente'
    if path.startswith('docs/') or path == 'README.md' or path.endswith(('LICENSE.txt', 'OFL-Urbanist.txt')):
        return 'B', 'Documentación, contrato, guía o licencia; conservar trazabilidad académica'
    if path.startswith('frontend/tests/'):
        return 'A', 'Código de regresión, soporte o fixture; no confundir con resultados de ejecución'
    return 'A', 'Fuente, configuración o recurso del producto/desarrollo; no retirar por búsqueda textual'

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--reuse-local', action='store_true', help='Reuse prior physical snapshot; refresh canonical classifications only')
    args = parser.parse_args(); workspace = args.workspace.resolve(); candidate = Path.cwd().resolve()
    out = candidate/'docs/release'; local = workspace/'.cache/h6-final'; local.mkdir(parents=True, exist_ok=True)
    base, approved = tree(workspace, BASE), tree(workspace, H6)
    content = blobs(workspace, {item[0] for item in [*base.values(), *approved.values()]})
    texts = {}
    for path, (oid, size) in approved.items():
        data = content[oid]
        if b'\0' not in data and size < 2_000_000:
            texts[path] = data.decode('utf8', errors='replace')
    rows = []; duplicates = collections.defaultdict(list); archived = []
    consumers = {}
    for path in sorted(set(base) | set(approved)):
        oid, size = approved.get(path, base.get(path)); data = content[oid]
        digest = hashlib.sha256(data).hexdigest(); duplicates[digest].append(path)
        origin = 'main-sin-cambio' if base.get(path) == approved.get(path) else 'H6-añadido' if path not in base else 'H6-modificado'
        category, reason = classify(path)
        needles = {path, './'+Path(path).name}
        if path.startswith('frontend/public/'):
            needles.add('/'+path.removeprefix('frontend/public/'))
        if path.startswith('frontend/src/'):
            needles.add('@/'+str(Path(path).with_suffix('')).replace('\\', '/').removeprefix('frontend/src/'))
            needles.add(Path(path).stem)
        if path.endswith('.java'):
            needles.add(Path(path).stem)
        refs = sorted(p for p, text in texts.items() if p != path and any(n in text for n in needles))
        consumers[path] = refs
        if path.startswith('frontend/src/app/') or Path(path).name in {'Dockerfile', 'package.json', 'package-lock.json', 'pom.xml', 'tsconfig.json', 'next.config.ts', 'playwright.config.ts'}:
            refs.append('[convención/configuración del framework]')
        kept = (candidate/path).is_file()
        target = 'candidato' if kept else 'histórico: '+URL+path
        if origin == 'main-sin-cambio':
            reason += '; pertenece a main: no se autoriza retirarlo'
        row = dict(ruta=path, bytes=size, sha256=digest, git_blob=oid, origen=origin, categoria=category,
                   referencias=';'.join(refs) or 'sin referencia estática demostrada; revisar dinámica antes de borrar',
                   destino=target, motivo=reason, produccion='sí' if category=='A' and '/tests/' not in path and '/test/' not in path and not path.startswith('scripts/') else 'no',
                   desarrollo_pruebas='sí' if category in {'A','B'} else 'histórico', informacion_unica='conservar; ver duplicados exactos', versionar='sí' if kept else 'solo histórico', archivos=1)
        rows.append(row)
        if not kept and origin == 'H6-añadido':
            archived.append(dict(ruta=path, bytes=size, sha256=digest, git_blob=oid, commit=H6, url=URL+path, categoria=category, motivo=reason))
    exact = []
    for digest, paths in sorted(duplicates.items()):
        if len(paths)<2: continue
        retained = [p for p in paths if (candidate/p).is_file()]
        for path in paths:
            exact.append(dict(sha256=digest, ruta=path, bytes=len(content[approved.get(path,base.get(path))[0]]),
                              grupo=';'.join(paths), consumidores=';'.join(consumers[path]), conservar=';'.join(retained),
                              accion='conservar fixture/licencia o main; no deduplicar automáticamente' if path in retained else 'excluir del candidato; original histórico conservado'))
    write_csv(out/'H6_EXACT_DUPLICATES.csv', exact, ['sha256','ruta','bytes','grupo','consumidores','conservar','accion'])
    write_csv(out/'H6_HISTORICAL_ARCHIVE.csv', archived, ['ruta','bytes','sha256','git_blob','commit','url','categoria','motivo'])
    # Release large historical image blobs before scanning generated local files.
    content.clear(); texts.clear()
    import gc
    gc.collect()
    # Physical worktree files are classified separately from canonical Git bytes.
    # One group per top-level generated area, each with a deterministic digest over
    # sorted relative paths, sizes and per-file SHA-256. Reparse links are not followed.
    worktrees = [Path(item.split('\n')[0].removeprefix('worktree ')) for item in git(workspace,'-c','core.quotePath=false','worktree','list','--porcelain').decode().strip().split('\n\n')]
    physical = []; errors = []; total = 0; total_bytes = 0
    cached = []
    if args.reuse_local:
        with (local/'physical-files.csv').open(encoding='utf8') as stream:
            cached = list(csv.DictReader(stream))
    for wi, wt in enumerate(worktrees):
        wt = wt.resolve(); label = 'workspace' if wt==workspace else wt.name
        tracked = set(git(wt,'ls-files','-z').decode().split('\0'))
        ignored = set(git(wt,'ls-files','--others','--ignored','--exclude-standard','-z').decode().split('\0'))
        groups = collections.defaultdict(list)
        if args.reuse_local:
            for row in cached:
                if row['worktree'] != label: continue
                rel=row['ruta']; size=int(row['bytes']); digest=row['sha256']; status=row['estado']
                physical.append(dict(worktree=label,ruta=rel,bytes=size,sha256=digest,estado=status))
                total+=1; total_bytes+=size
                parts=rel.split('/'); special=next((i for i,p in enumerate(parts) if p in {'.cache','.local','node_modules','.next','target','.venv','__pycache__','.pytest_cache','dist','coverage','test-results','playwright-report'}),None)
                group='/'.join(parts[:special+1])+'/' if special is not None else '[archivos '+status+']'
                groups[(status,group)].append((rel,size,digest))
        def walk_error(error):
            errors.append({'worktree':label,'ruta':str(Path(error.filename).relative_to(wt)), 'error':type(error).__name__})
        for directory, dirs, files in ([] if args.reuse_local else os.walk(wt, followlinks=False, onerror=walk_error)):
            current=Path(directory)
            dirs[:] = [d for d in dirs if d not in {'.git','.worktrees'} and not (current/d).is_symlink() and not (current/d).is_junction()]
            for name in files:
                fp=current/name; rel=fp.relative_to(wt).as_posix()
                if name=='.git' or fp.is_symlink(): continue
                # Exclude this audit's changing output from its own snapshot.
                if rel.startswith('.cache/h6-final/') or (wt==candidate and rel.startswith('docs/release/H6_FILE_AUDIT')): continue
                try:
                    readable = Path('\\\\?\\'+str(fp.resolve())) if os.name=='nt' else fp
                    size=readable.stat().st_size
                    with readable.open('rb') as stream:
                        digest=hashlib.file_digest(stream,'sha256').hexdigest()
                except (OSError, PermissionError) as error:
                    errors.append({'worktree':label,'ruta':rel,'error':type(error).__name__}); continue
                status='tracked' if rel in tracked else 'ignored' if rel in ignored else 'untracked'
                physical.append(dict(worktree=label,ruta=rel,bytes=size,sha256=digest,estado=status))
                total+=1; total_bytes+=size
                parts=rel.split('/'); special=next((i for i,p in enumerate(parts) if p in {'.cache','.local','node_modules','.next','target','.venv','__pycache__','.pytest_cache','dist','coverage','test-results','playwright-report'}),None)
                group='/'.join(parts[:special+1])+'/' if special is not None else '[archivos '+status+']'
                groups[(status,group)].append((rel,size,digest))
        for (status, group), members in sorted(groups.items()):
            members.sort(); manifest=''.join(f'{digest} {size} {path}\n' for path,size,digest in members).encode()
            private=status!='tracked'; category='E' if private else 'C' if 'h6' in label else 'A'
            rows.append(dict(ruta=f'@local/{label}/{group}',bytes=sum(x[1] for x in members),sha256=hashlib.sha256(manifest).hexdigest(),git_blob='',origen='worktree-'+status,categoria=category,
                referencias='manifiesto privado en .cache/h6-final/physical-files.csv',destino='conservar local; fuera del PR',motivo='Grupo local sin modificar; hash del manifiesto ordenado, no del directorio; no se publican contenidos privados',produccion='local',desarrollo_pruebas='local',informacion_unica='no borrar',versionar='no' if private else 'en su rama',archivos=len(members)))
        print(f'{label}: {sum(len(m) for m in groups.values())} archivos físicos', flush=True)
    write_csv(local/'physical-files.csv', physical, ['worktree','ruta','bytes','sha256','estado'])
    write_csv(out/'H6_FILE_AUDIT.csv', rows, list(rows[0]))
    summary=dict(base=BASE,h6=H6,main_files=len(base),h6_files=len(approved),union_files=len(set(base)|set(approved)),
                 physical_files=total,physical_bytes=total_bytes,worktrees=len(worktrees),physical_errors=errors,
                 historical_excluded_files=len(archived),historical_excluded_bytes=sum(r['bytes'] for r in archived),
                 added_h6_bytes=sum(size for p,(_,size) in approved.items() if p not in base),
                 exact_duplicate_groups=len({r['sha256'] for r in exact}),exact_duplicate_files=len(exact),
                 category_counts=dict(collections.Counter(r['categoria'] for r in rows if not r['ruta'].startswith('@local/'))))
    (local/'audit-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
