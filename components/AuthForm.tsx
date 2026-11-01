"use client";
import { useFormState } from "react-dom";
type Action = (s: any, fd: FormData) => Promise<{ error?: string; ok?: string } | void>;
export default function AuthForm({ action, label, next }: { action: Action; label: string; next?: string }) {
  const [state, formAction] = useFormState(action, null as any);
  return (
    <form action={formAction} noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete={label === "Log in" ? "current-password" : "new-password"} minLength={8} required />
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      {state?.ok && <div className="msg ok" role="status">{state.ok}</div>}
      <p><button className="btn" type="submit">{label}</button></p>
    </form>
  );
}
