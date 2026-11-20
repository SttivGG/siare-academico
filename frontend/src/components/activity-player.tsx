"use client";

import { useId, useRef, useState } from 'react';
import { useAcademic } from './academic-provider';
import { api } from '../lib/api';
import { clueCells, crosswordAnswers, freezeSubmission, normalize, type Activity, type CrosswordActivity, type Evaluation, type Submission } from '../lib/activities';

export function EvaluationView({ result }: { result: Evaluation }) {
  return <section aria-label="Evaluación de Spring" className="evaluation">
    <h3>Resultado del intento</h3><p role="status" className="result-score">{result.percentage}% <span>{result.points} de {result.total} aciertos</span></p>
    <p>{result.feedback}</p><p className="hint identity-id">Intento: {result.attemptId}</p>
    <p className="hint">{Number.isFinite(Date.parse(result.occurredAt)) ? new Date(result.occurredAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : 'Fecha no disponible'}</p>
    <ul className="feedback-list">{result.items.map(item => <li key={item.id}><strong>{item.id}: {item.correct ? 'Correcta' : 'Por repasar'}</strong>
      <p>Tu respuesta: {item.submitted || 'Sin respuesta'}</p><p>Respuesta esperada: {item.expected}</p><p>{item.rationale}</p><p className="hint">{item.feedback}</p></li>)}</ul>
  </section>;
}

function CrosswordGrid({ activity, cells, onChange, locked, direction, setDirection }: { activity: CrosswordActivity; cells: Record<string, string>; onChange: (cells: Record<string, string>) => void; locked: boolean; direction: 'ACROSS' | 'DOWN'; setDirection: (direction: 'ACROSS' | 'DOWN') => void }) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const helpId = useId(), cluePrefix = useId();
  const [focusedCell, setFocusedCell] = useState('');
  const { rows, columns, clues } = activity.content;
  const available = new Set(activity.content.cells.map(c => `${c.row}:${c.column}`));
  const currentClue = clues.find(clue => clue.direction === direction && clueCells(clue).includes(focusedCell));
  const currentCells = new Set(currentClue ? clueCells(currentClue) : []);
  function move(row: number, column: number, dr: number, dc: number) {
    refs.current[`${row + dr}:${column + dc}`]?.focus();
  }
  return <div className="crossword">
    <p className="hint" id={helpId}>Escribe una letra por celda. Usa las flechas para moverte, Retroceso para borrar y Enter para cambiar de dirección. Las palabras incompletas se envían sin respuesta.</p>
    <div className="actions"><button type="button" className="button secondary" onClick={() => setDirection(direction === 'ACROSS' ? 'DOWN' : 'ACROSS')}>Entrada: {direction === 'ACROSS' ? 'horizontal' : 'vertical'}</button></div>
    <div className="crossword-scroll" role="region" aria-label="Cuadrícula del crucigrama" tabIndex={0}>
      <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${columns}, 2.8rem)` }}>
        {Array.from({ length: rows * columns }, (_, index) => {
          const row = Math.floor(index / columns), column = index % columns, key = `${row}:${column}`;
          if (!available.has(key)) return <div className="crossword-block" key={key} aria-hidden="true" />;
          const number = clues.find(c => c.row === row && c.column === column)?.number;
          return <div className="crossword-cell" data-active-word={currentCells.has(key) || undefined} key={key}>{number && <span aria-hidden="true">{number}</span>}
            <input ref={el => { refs.current[key] = el; }} aria-label={`Fila ${row + 1}, columna ${column + 1}${number ? `, inicio ${number}` : ''}`} aria-describedby={`${helpId}${currentClue && currentCells.has(key) ? ` ${cluePrefix}-${currentClue.id}` : ''}`} onFocus={() => setFocusedCell(key)}
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
        <button type="button" id={`${cluePrefix}-${clue.id}`} className="clue-button" aria-current={currentClue?.id === clue.id || undefined} disabled={locked} onClick={() => { setDirection(dir); refs.current[clueCells(clue)[0]]?.focus(); }}><strong>{clue.number}.</strong> {clue.clue} <span className="hint">({clue.length} letras)</span></button>
        {clue.source && <p className="hint">Fuente: {clue.source.reference} · fragmento {clue.source.fragmentIndex}</p>}
      </li>)}</ul></section>)}
  </div>;
}

export function ActivityPlayer({ activity, archived }: { activity: Activity; archived: boolean }) {
  const { state, controller, recovery } = useAcademic(activity.subjectId);
  const attempt = state.attempts[activity.activityId];
  const { answers, cells, index, result, error, direction } = attempt;
  const pending = attempt.status === 'sending', locked = !!attempt.frozen;
  const setAnswers = (answers: Record<string, string>) => controller.attempt(activity.activityId, { answers });
  const setCells = (cells: Record<string, string>) => controller.attempt(activity.activityId, { cells });
  const setIndex = (index: number) => controller.attempt(activity.activityId, { index });
  const setDirection = (direction: 'ACROSS' | 'DOWN') => controller.attempt(activity.activityId, { direction });
  const heading = useRef<HTMLHeadingElement>(null);
  const questionId = useId();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await controller.submit(activity.activityId, body => api<Evaluation>(`activities/${activity.activityId}/submissions`, 'POST', body), recovery.getSnapshot().enabled ? recovery.flush : undefined);
  }
  function navigate(next: number) { setIndex(next); requestAnimationFrame(() => heading.current?.focus()); }
  return <div className="activity-player">
    <h3 tabIndex={-1}>{activity.type === 'QUIZ' ? 'Quiz' : 'Crucigrama'} · {activity.title}</h3>
    {result ? <><EvaluationView result={result} />{!archived && <button className="button secondary" onClick={() => { controller.restart(activity.activityId); }}>Nuevo intento</button>}</>
      : <form onSubmit={submit} aria-busy={pending}>
        {activity.type === 'QUIZ' ? (() => { const question = activity.content.questions[index]; return <>
          <p className="hint" role="status">Pregunta {index + 1} de {activity.content.questions.length} · {Object.keys(answers).length} respondidas</p>
          <progress aria-label="Preguntas respondidas" value={Object.keys(answers).length} max={activity.content.questions.length} />
          <h4 id={questionId} ref={heading} tabIndex={-1}>{question.prompt}</h4>
          <fieldset className="quiz-options" aria-labelledby={questionId} disabled={locked || archived}><legend className="sr-only">Opciones para {question.id}</legend>
            {question.options.map(option => <label key={option.id} className={answers[question.id] === option.id ? 'selected' : ''}>
              <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} />{option.text}</label>)}
          </fieldset>{question.source && <p className="hint">Fuente: {question.source.reference} · fragmento {question.source.fragmentIndex}</p>}
          <div className="actions"><button type="button" className="button secondary" disabled={index === 0} onClick={() => navigate(index - 1)}>Anterior</button>
            <button type="button" className="button secondary" disabled={index === activity.content.questions.length - 1} onClick={() => navigate(index + 1)}>Siguiente</button></div>
        </>; })() : <CrosswordGrid activity={activity} direction={direction} setDirection={setDirection} cells={cells} onChange={setCells} locked={locked || archived} />}
        <p className="hint">Spring evaluará las respuestas al enviar. Las omisiones cuentan como error.</p>
        {error && <p className="notice error" role="alert">{error} Reintenta el envío; se conservarán la clave y las respuestas originales.</p>}
        {locked && !pending && <p className="notice">Envío pendiente de confirmación. Las respuestas permanecen bloqueadas para poder reintentar exactamente el mismo intento.</p>}
        <button className="button primary full" type="submit" aria-busy={pending || undefined} disabled={pending || archived && !locked}>{pending ? 'Obteniendo evaluación…' : locked ? 'Reintentar envío' : 'Enviar respuestas'}</button>
      </form>}
  </div>;
}
