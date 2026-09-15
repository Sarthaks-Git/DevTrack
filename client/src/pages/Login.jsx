import { useState } from "react";
import { Link } from "react-router-dom";
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
  }

  const handleEmail=(event)=>{
    const {value} =event.target;
    setEmail(value);

  }

  const handlePassword=(event)=>{
    const {value} = event.target;
    setPassword(value);
  }

  return (
    <>
      <h1>DevTrack</h1>
      <img src="" alt="logo" />

      <form onSubmit={handleSubmit}>
        Email: <input
          type="email"
          name="email"
          onChange={handleEmail}
          value={email}
        /> 
        Password: <input
          type="password"
          name="password"
          onChange={handlePassword}
          value={password}
        />
        <button type="submit">Login</button>
        Don't have an account? <Link to="/register">Register</Link>
        <Link to="#">Forgot Password?</Link>
      </form>
    </>
  );
};

export default Login;
