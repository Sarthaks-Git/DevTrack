
import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshUser } = useContext(AuthContext);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed");
      }

      await refreshUser();

      setMessage(result.message || "Login successful!");

      navigate("/app/dashboard", { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleEmail = (event) => {
    setEmail(event.target.value);
  };

  const handlePassword = (event) => {
    setPassword(event.target.value);
  };

  return (
    <>
      <h1>DevTrack</h1>
      <img src="" alt="logo" />

      <form onSubmit={handleSubmit}>
        Email:{" "}
        <input
          type="email"
          name="email"
          onChange={handleEmail}
          value={email}
        />

        Password:{" "}
        <input
          type="password"
          name="password"
          onChange={handlePassword}
          value={password}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p>{message}</p>

        Don't have an account? <Link to="/register">Register</Link>

        <Link to="#">Forgot Password?</Link>
      </form>
    </>
  );
};

export default Login;