"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";

type Enrollment = { otpauthUri: string; expiresAt: string };
type Status = { state: string; pendingReplacement: boolean; recoveryCodesRemaining: number; required: boolean; localPassword: boolean };

function EnrollmentQr({ enrollment }: { enrollment: Enrollment }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (canvas.current) QRCode.toCanvas(canvas.current, enrollment.otpauthUri, { width: 240, margin: 4, errorCorrectionLevel: "M" }).catch(() => setFailed(true));
  }, [enrollment]);
  const seed = new URL(enrollment.otpauthUri).searchParams.get("secret") ?? "";
  return <div className="mfa-enrollment"><p>Escanea el QR con tu aplicación autenticadora. También puedes copiar la clave manualmente. Esta configuración vence en diez minutos.</p>
    {!failed && <canvas ref={canvas} role="img" aria-label="QR para agregar SIARE a tu aplicación autenticadora" />}
    <div className="field"><label htmlFor="manual-seed">Clave de configuración (solo se muestra ahora)</label><input id="manual-seed" value={seed} readOnly autoComplete="off" spellCheck={false} /></div>
    <p className="hint">Algoritmo SHA-1 · seis dígitos · periodo de 30 segundos. Conserva la hora automática de tu dispositivo.</p></div>;
}

export function MfaPanel({ challenge = false, enrollRequired = false }: { challenge?: boolean; enrollRequired?: boolean }) {
  const router = useRouter();
  const messageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>();
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [codes, setCodes] = useState<string[]>();
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!challenge) api<Status>("users/me/mfa").then(setStatus).catch(e => setError(e.message));
  }, [challenge]);
  async function run(work: () => Promise<void>) {
    setPending(true); setError("");
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); requestAnimationFrame(() => messageRef.current?.focus()); }
    finally { setPending(false); }
  }
  async function begin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(async () => setEnrollment(await api<Enrollment>(challenge ? "auth/mfa/enroll" : "users/me/mfa/enroll", "POST", challenge ? {} : { password: form.get("password"), code: String(form.get("code") ?? "") })));
  }
  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(async () => {
      const result = await api<{ recoveryCodes: string[] }>(challenge ? "auth/mfa/confirm" : "users/me/mfa/confirm", "POST", { code: form.get("code") });
      setEnrollment(undefined); setCodes(result.recoveryCodes);
    });
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(async () => { await api(recovery ? "auth/mfa/recover" : "auth/mfa/verify", "POST", { code: form.get("code") }); router.replace("/inicio"); router.refresh(); });
  }
  async function manage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const operation = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    await run(async () => {
      const result = await api<{ recoveryCodes?: string[] }>(`users/me/mfa/${operation === "disable" ? "disable" : "recovery-codes"}`, "POST", { password: form.get("password"), code: form.get("code") });
      if (result.recoveryCodes) { setCodes(result.recoveryCodes); setRequiresLogin(true); }
      else { router.replace("/login"); router.refresh(); }
    });
  }
  function reauthentication(prefix: string, needsCode: boolean) {
    return <>{status?.localPassword === false ? <p className="hint">Vuelve a iniciar sesión con tu proveedor si han pasado cinco minutos.</p> : <div className="field"><label htmlFor={`${prefix}-password`}>Contraseña actual</label><input id={`${prefix}-password`} name="password" type="password" autoComplete="current-password" required maxLength={2048} /></div>}
      {needsCode && <div className="field"><label htmlFor={`${prefix}-code`}>TOTP actual o código de recuperación sin usar</label><input id={`${prefix}-code`} name="code" autoComplete="one-time-code" required maxLength={22} spellCheck={false} autoCapitalize="none" /></div>}</>;
  }
  return <section className="security-panel form-stack" aria-busy={pending}>
    {error && <div ref={messageRef} role="alert" tabIndex={-1} className="notice error">{error}</div>}
    {codes ? <div className="form-stack"><h2>Guarda tus códigos de recuperación</h2><p className="notice success" role="status">Cada código se puede usar una sola vez, después de verificar tu contraseña o proveedor. No volverán a mostrarse.</p>
      <ul className="recovery-codes" aria-label="Códigos de recuperación">{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul>
      <p>Guárdalos en tu gestor de contraseñas o en un lugar seguro fuera del dispositivo autenticador.</p>
      <Link className="button primary" href={requiresLogin ? "/login" : "/inicio"} onClick={() => { setCodes(undefined); router.refresh(); }}>Ya guardé los códigos · continuar</Link></div>
    : enrollment ? <><EnrollmentQr enrollment={enrollment} /><form className="form-stack" onSubmit={confirm}>
      <div className="field"><label htmlFor="confirmation-code">Código de tu nueva aplicación</label><input id="confirmation-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} aria-describedby="confirmation-help" /><span id="confirmation-help" className="hint">Escribe o pega los seis dígitos para activar el factor.</span></div>
      <button className="button primary" disabled={pending}>{pending ? "Verificando…" : "Confirmar y activar MFA"}</button></form></>
    : challenge && !enrollRequired ? <><p>Tu identidad fue validada. Completa el segundo factor en cinco minutos para abrir tu sesión.</p><form className="form-stack" onSubmit={verify}>
      <div className="field"><label htmlFor="login-code">{recovery ? "Código de recuperación" : "Código de tu aplicación autenticadora"}</label><input key={String(recovery)} id="login-code" name="code" autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"} required pattern={recovery ? "[A-Za-z0-9_-]{22}" : "[0-9]{6}"} maxLength={recovery ? 22 : 6} spellCheck={false} autoCapitalize="none" /></div>
      <button className="button primary" disabled={pending}>{pending ? "Verificando…" : "Verificar segundo factor"}</button>
      <button className="button secondary" type="button" disabled={pending} onClick={() => setRecovery(!recovery)}>{recovery ? "Usar mi aplicación autenticadora" : "Usar un código de recuperación"}</button></form>
      <p className="hint">Si perdiste todos los factores, contacta al responsable institucional para la verificación independiente de identidad.</p></>
    : <>{!challenge && !status ? <p role="status">Consultando seguridad de la cuenta…</p> : <>
      {status && <p className="notice" role="status">Estado MFA: {status.state === "ENABLED" ? "activo" : status.state === "PENDING" ? "pendiente de confirmación" : "sin configurar"}. {status.required ? "Obligatorio para tu rol." : "Puedes proteger tu cuenta con una aplicación autenticadora."} Códigos disponibles: {status.recoveryCodesRemaining}.</p>}
      {challenge && <p>Tu rol exige MFA. Puedes registrar el factor con este desafío provisional; los permisos administrativos se habilitan tras confirmarlo.</p>}
      <form className="form-stack" onSubmit={begin}>{!challenge && reauthentication("enroll", status?.state === "ENABLED")}
        <button className="button primary" disabled={pending}>{pending ? "Preparando…" : status?.state === "ENABLED" ? "Preparar reemplazo del factor" : "Configurar aplicación autenticadora"}</button></form>
      {status?.state === "ENABLED" && <form className="form-stack security-actions" onSubmit={manage}><h2>Recuperación y cambios</h2><p>Estos cambios cierran todas tus sesiones. Espera al siguiente código si acabas de utilizar el actual.</p>{reauthentication("manage", true)}
        <button className="button secondary" value="regenerate" disabled={pending}>Regenerar códigos de recuperación</button>
        {!status.required && <button className="button secondary" value="disable" disabled={pending}>Desactivar MFA y cerrar sesiones</button>}</form>}
    </>}</>}
  </section>;
}
