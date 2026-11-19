"use client";

import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { clueCells, crosswordAnswers, freezeSubmission, normalize, type Activity, type CrosswordActivity, type Evaluation, type Submission } from '../lib/activities';

export function EvaluationView({ result }: { result: Evaluation }) {
  return <section aria-label="Evaluación de Spring" className="evaluation">
    <h3>Resultado del intento</h3><p className="result-score">{result.percentage}% <span>{result.points} de {result.total} aciertos</span></p>
    <p>{result.feedback}</p><p className="hint identity-id">Intento: {result.attemptId}</p>
    <p className="hint">{new Date(result.occurredAt).toLocaleString('es-CO')}</p>
    <ul className="feedback-list">{result.items.map(item => <li key={item.id}><strong>{item.id}: {item.correct ? 'Correcta' : 'Por repasar'}</strong>
      <p>Tu respuesta: {item.submitted || 'Sin respuesta'}</p><p>Respuesta esperada: {item.expected}</p><p>{item.rationale}</p><p className="hint">{item.feedback}</p></li>)}</ul>
  </section>;
}

function CrosswordGrid({ activity, cells, onChange, locked }: { activity: CrosswordActivity; cells: Record<string, string>; onChange: (cells: Record<string, string>) => void; locked: boolean }) {
  const [direction, setDirection] = useState<'ACROSS' | 'DOWN'>('ACROSS');
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const { rows, columns, clues } = activity.content;
  const available = new Set(activity.content.cells.map(c => `${c.row}:${c.column}`));
  function move(row: number, column: number, dr: number, dc: number) {
    refs.current[`${row + dr}:${column + dc}`]?.focus();
  }
  return <div className="crossword">
    <p className="hint" id="crossword-help">Escribe una letra por celda. Usa las flechas para moverte, Retroceso para borrar y Enter para cambiar de dirección. Las palabras incompletas se envían sin respuesta.</p>
    <div className="actions"><button type="button" className="button secondary" onClick={() => setDirection(direction === 'ACROSS' ? 'DOWN' : 'ACROSS')}>Entrada: {direction === 'ACROSS' ? 'horizontal' : 'vertical'}</button></div>
    <div className="crossword-scroll" role="region" aria-label="Cuadrícula del crucigrama" tabIndex={0}>
      <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${columns}, 2.8rem)` }}>
        {Array.from({ length: rows * columns }, (_, index) => {
          const row = Math.floor(index / columns), column = index % columns, key = `${row}:${column}`;
          if (!available.has(key)) return <div className="crossword-block" key={key} aria-hidden="true" />;
          const number = clues.find(c => c.row === row && c.column === column)?.number;
          return <div className="crossword-cell" key={key}>{number && <span aria-hidden="true">{number}</span>}
            <input ref={el => { refs.current[key] = el; }} aria-label={`Fila ${row + 1}, columna ${column + 1}${number ? `, inicio ${number}` : ''}`} aria-describedby="crossword-help"
              value={cells[key] ?? ''} disabled={locked} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              onChange={e => { const value = normalize(e.target.value).replace(/[^A-ZÑ]/g, '').slice(-1); onChange({ ...cells, [key]: value }); if (value) move(row, column, direction === 'DOWN' ? 1 : 0, direction === 'ACROSS' ? 1 : 0); }}
              onKeyDown={e => {
                const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
                if (moves[e.key]) { e.preventDefault(); setDirection(e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'DOWN' : 'ACROSS'); move(row, column, ...moves[e.key]); }
                if (e.key === 'Enter') { e.preventDefault(); setDirection(direction === 'ACROSS' ? 'DOWN' : 'ACROSS'); }
                if (e.key === 'Backspace') { e.preventDefault(); onChange({ ...cells, [key]: '' }); move(row, column, direction === 'DOWN' ? -1 : 0, direction === 'ACROSS' ? -1 : 0); }
              }} />
          </div>;
        })}
      </div>
    </div>
    {(['ACROSS', 'DOWN'] as const).map(dir => <section key={dir}><h3>{dir === 'ACROSS' ? 'Horizontales' : 'Verticales'}</h3>
      <ul className="clue-list">{clues.filter(c => c.direction === dir).map(clue => <li key={clue.id}>
        <button type="button" className="clue-button" onClick={() => { setDirection(dir); refs.current[clueCells(clue)[0]]?.focus(); }}><strong>{clue.number}.</strong> {clue.clue} <span className="hint">({clue.length} letras)</span></button>
        {clue.source && <p className="hint">Fuente: {clue.source.reference} · fragmento {clue.source.fragmentIndex}</p>}
      </li>)}</ul></section>)}
  </div>;
}

export function ActivityPlayer({ activity, archived, onResult, onPending }: { activity: Activity; archived: boolean; onResult: (result: Evaluation) => void; onPending: (pending: boolean) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cells, setCells] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');
  const startedAt = useRef(Date.now());
  const envelope = useRef<Submission | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (pending) return;
    envelope.current ??= freezeSubmission(activity.type === 'QUIZ' ? answers : crosswordAnswers(activity.content.clues, cells), startedAt.current);
    setLocked(true); setPending(true); onPending(true); setError('');
    try {
      const evaluation = await api<Evaluation>(`activities/${activity.activityId}/submissions`, 'POST', envelope.current);
      setResult(evaluation); onResult(evaluation); onPending(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar.'); }
    finally { setPending(false); }
  }
  function navigate(next: number) { setIndex(next); requestAnimationFrame(() => heading.current?.focus()); }
  return <div className="activity-player">
    <h3>{activity.type === 'QUIZ' ? 'Quiz' : 'Crucigrama'} · {activity.title}</h3>
    {result ? <><EvaluationView result={result} />{!archived && <button className="button secondary" onClick={() => { envelope.current = null; setResult(null); setAnswers({}); setCells({}); setIndex(0); setLocked(false); startedAt.current = Date.now(); }}>Nuevo intento</button>}</>
      : <form onSubmit={submit}>
        {activity.type === 'QUIZ' ? (() => { const question = activity.content.questions[index]; return <>
          <p className="hint">Pregunta {index + 1} de {activity.content.questions.length} · {Object.keys(answers).length} respondidas</p>
          <h4 ref={heading} tabIndex={-1}>{question.prompt}</h4>
          <fieldset className="quiz-options" disabled={locked || archived}><legend className="sr-only">Opciones para {question.id}</legend>
            {question.options.map(option => <label key={option.id} className={answers[question.id] === option.id ? 'selected' : ''}>
              <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} />{option.text}</label>)}
          </fieldset>{question.source && <p className="hint">Fuente: {question.source.reference} · fragmento {question.source.fragmentIndex}</p>}
          <div className="actions"><button type="button" className="button secondary" disabled={index === 0} onClick={() => navigate(index - 1)}>Anterior</button>
            <button type="button" className="button secondary" disabled={index === activity.content.questions.length - 1} onClick={() => navigate(index + 1)}>Siguiente</button></div>
        </>; })() : <CrosswordGrid activity={activity} cells={cells} onChange={setCells} locked={locked || archived} />}
        <p className="hint">Spring evaluará las respuestas al enviar. Las omisiones cuentan como error.</p>
        {error && <p className="notice error" role="alert">{error} Reintenta el envío; se conservarán la clave y las respuestas originales.</p>}
        {locked && !pending && <p className="notice">Envío pendiente de confirmación. Las respuestas permanecen bloqueadas para poder reintentar exactamente el mismo intento.</p>}
        <button className="button primary full" type="submit" disabled={pending || archived && !locked}>{pending ? 'Obteniendo evaluación…' : locked ? 'Reintentar envío' : 'Enviar respuestas'}</button>
      </form>}
  </div>;
}
