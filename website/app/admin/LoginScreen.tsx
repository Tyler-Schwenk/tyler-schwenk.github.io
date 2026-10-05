"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Field, INPUT_CLASS } from "./ui";

/**
 * The admin login form (the single admin account, see
 * pi/services/website-backend/app/routers/auth.py).
 * @param props.login - Logs in; resolves to an error message, or null on success.
 */
export default function LoginScreen({ login }: { login: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(await login(email.trim(), password));
    setBusy(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">tyler-schwenk.com</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="login-email">
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              className={INPUT_CLASS}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={INPUT_CLASS}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" className="mt-2 w-full" disabled={busy}>
            {busy ? "Logging in..." : "Log in"}
          </Button>
          {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}
        </form>
        <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-300">
          Back to the site
        </Link>
      </Card>
    </div>
  );
}
