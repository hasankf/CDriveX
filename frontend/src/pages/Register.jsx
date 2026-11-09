import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field.jsx";
import { api } from "../api.js";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.register(form);
      // Same as the EJS flow: after registering, go to the login page.
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Create your account</h1>

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
          hint="At least 3 characters."
          value={form.username}
          onChange={onChange}
        />
        <Field
          id="email"
          name="email"
          label="Email address"
          type="email"
          placeholder="john.doe@company.com"
          autoComplete="email"
          minLength={13}
          required
          hint="At least 13 characters."
          value={form.email}
          onChange={onChange}
        />
        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          placeholder="•••••••••"
          autoComplete="new-password"
          minLength={5}
          required
          hint="At least 5 characters."
          value={form.password}
          onChange={onChange}
        />

        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
