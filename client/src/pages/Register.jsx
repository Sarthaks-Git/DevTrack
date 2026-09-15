import { useState } from "react";
import { Link } from "react-router-dom";
const Register = () => {
  const [username, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (confirmPassword !== password) {alert("!Same Password was not entered!");}
    else alert ("Registration Successful!")
  }
  function handleUsername(event) {
    const { value } = event.target;
    setUserName(value);
  }
  function handleEmail(event) {
    const { value } = event.target;
    setEmail(value);
  }
  function handlePassword(event) {
    const { value } = event.target;
    setPassword(value);
  }
  function handleConfirmPassword(event) {
    const { value } = event.target;
    setConfirmPassword(value);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>Username:</label>
        <input type="text" value={username} onChange={handleUsername} />
        <label>Email:</label>
        <input type="email" value={email} onChange={handleEmail} />
        <label>Password:</label>
        <input type="password" value={password} onChange={handlePassword} />
        <label>Confirm Password:</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPassword}
        />

        <button type="submit">Register</button>
      </form>
      Already have an account? <Link to="/login">Login</Link>
    </>
  );
};

export default Register;
