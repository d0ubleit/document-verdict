#!/usr/bin/env python3
"""Benchmark: Russian NER models on our real-contract corpus.

Compares:
  - Gherman/bert-base-NER-Russian (quality ceiling, ~440 MB fp32)
  - Evolett/rubert-tiny2-finetuned-ner (light, ~25 MB)

Metric: does the model detect the KNOWN person names in each corpus-real
file (PER), and does it produce false positives on NO_MASK templates?
Run from the repo root:  /tmp/ner-bench-venv/bin/python scripts/benchmark-ner.py
"""
import os
import sys
import warnings

warnings.filterwarnings('ignore')
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

CORPUS_DIR = 'packages/masker/corpus-real'
TXT_DIR = os.path.join(CORPUS_DIR, 'txt')

# Known person names per file (ground truth from our earlier PII analysis).
GROUND_TRUTH = {
    'dogovor-zajma-besprocent.txt': ['Иванов', 'Петров'],
    'mikrozajm.txt': ['Морозов', 'Смирнова'],
    'oferta-shkd.txt': ['Ромашкин'],
    'pravila-dms.txt': ['Гаврилова'],
    'franchajzing.txt': ['Соколова', 'Орлов'],
    'dogovor-gph-user-style.txt': ['Смирнов', 'Ковалёв'],
    'dogovor-postavki.txt': ['Онищук'],
    'dogovor-arendy.txt': [],
    'kredit-gorbank.txt': [],
    'kuplya-prodazha-kvartiry.txt': [],
    'gph-podryad-blank.txt': [],
    'gph-uslugi-fizlic.txt': [],
    'gph-uslugi-blank.txt': [],
    'doverennost-fas.txt': [],
    'dogovor-gph-podryad.txt': [],
    'dogovor-gph-universal.txt': [],
    'dogovor-okazaniya-uslug.txt': [],
    'dogovor-samozanyatyi-glavbukh.txt': [],
    'dogovor-samozanyatyi-zavolzh.txt': [],
    'trudovoj.txt': [],
}

# Files with zero expected persons: used for false-positive rate.
NO_PERSON_FILES = [f for f, names in GROUND_TRUTH.items() if not names]


def load_pipe(model_id):
    from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForTokenClassification.from_pretrained(model_id)
    pipe = pipeline('token-classification', model=model, tokenizer=tokenizer,
                    aggregation_strategy='simple')
    labels = set(model.config.id2label.values())
    print(f'  labels: {sorted(labels)[:20]}')
    return pipe


# Две схемы меток: Gherman (LAST_NAME/FIRST_NAME/... — паспортная NER)
# и стандартная (PER/PERSON).
PERSON_LABELS = {'PER', 'PERSON', 'LAST_NAME', 'FIRST_NAME', 'MIDDLE_NAME', 'NAME'}


def person_entities(text, pipe):
    out = []
    for e in pipe(text[:20000]):
        if e['entity_group'] in PERSON_LABELS and e['score'] >= 0.5:
            out.append(e['word'])
    return out


def run_benchmark(pipe, label):
    import time
    print(f'\n===== {label} =====')
    total_names = 0
    found_names = 0
    fp_files = 0
    total_sec = 0.0
    for fname in sorted(GROUND_TRUTH):
        path = os.path.join(CORPUS_DIR, fname)
        if not os.path.exists(path):
            path = os.path.join(TXT_DIR, fname)
        with open(path, encoding='utf8') as fh:
            text = fh.read()
        # strip corpus header lines
        text = '\n'.join(l for l in text.split('\n') if not l.startswith(
            ('EXPECT:', 'KEEP:', 'LEAK:', 'NO_MASK:')))
        t0 = time.time()
        persons = person_entities(text, pipe)
        total_sec += time.time() - t0
        expected = GROUND_TRUTH[fname]
        if expected:
            hit = [n for n in expected if any(n[:6].lower() in p[:10].lower() for p in persons)]
            total_names += len(expected)
            found_names += len(hit)
            status = f'{len(hit)}/{len(expected)}'
            if len(hit) < len(expected):
                status += f'  MISSED: {[n for n in expected if n not in hit]}'
            print(f'  {fname:45s} PER={len(persons):2d}  names {status}')
        else:
            if persons:
                fp_files += 1
                print(f'  {fname:45s} PER={len(persons):2d}  ⚠️  FP: {persons[:3]}')
            else:
                print(f'  {fname:45s} PER= 0  ok')
    recall = found_names / total_names * 100 if total_names else 0
    print(f'\n  RECALL по известным именам: {found_names}/{total_names} = {recall:.0f}%')
    print(f'  Ложные срабатывания (файлы без имён): {fp_files}/{len(NO_PERSON_FILES)}')
    print(f'  Время на корпус (20 файлов, CPU): {total_sec:.1f} c ({total_sec/20*1000:.0f} мс/файл)')


if __name__ == '__main__':
    run_benchmark(load_pipe('Gherman/bert-base-NER-Russian'), 'Gherman/bert-base-NER-Russian')
    run_benchmark(load_pipe('r1char9/ner-rubert-tiny-news'), 'r1char9/ner-rubert-tiny-news (tiny, 29M)')
