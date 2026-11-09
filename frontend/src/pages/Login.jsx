import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Field from "../components/Field.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered;

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Log in</h1>

        {justRegistered && !error && (
          <p className="notice ok" role="status">
            Account created. Log in to continue.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}

        <Field
          id="username"
          name="username"
          label="Username"
          type="text"
          placeholder="John"
          autoComplete="username"
          minLength={3}
          required
          value={form.username}
          onChange={onChange}
        />
        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          placeholder="•••••••••"
          autoComplete="current-password"
          minLength={5}
          required
          value={form.password}
          onChange={onChange}
        />

        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>

        <p className="switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
