export default function Field({ label, hint, id, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...inputProps} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
