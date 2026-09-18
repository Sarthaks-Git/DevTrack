import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();

  const [username, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const result = await response.json();
      console.log("Backend response:", result);
      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      setMessage(result.message || "Registration successful!");

      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Create your DevTrack account</h1>

      <form onSubmit={handleSubmit}>
        <label>Username:</label>
        <input
          type="text"
          value={username}
          onChange={(event) => setUserName(event.target.value)}
          required
        />

        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label>Password:</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <label>Confirm Password:</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p>{message}</p>

      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </>
  );
};

export default Register;
