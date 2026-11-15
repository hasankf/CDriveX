import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

// Pages that need a logged-in user (the /home page).
function Protected({ children }) {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "anon") return <Navigate to="/" replace />;
  return children;
}


// Login and register: skip them if you're already signed in.
function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "authed") return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
