import React from "react";
import { Link, useNavigate } from "react-router-dom";
const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new AppError("Logout Failed");
      }

      navigate("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };
  return (
    <>
      <ul>
        <li>
          <Link to="/app/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link to="/app/goals">Goals</Link>
        </li>
        <li>
          <Link to="/app/projects">Projects</Link>
        </li>
        <li>
          <Link to="/app/coding">Coding</Link>
        </li>
        <li>
          <Link to="/app/journal">Journal</Link>
        </li>
        <li>
          <Link to="/app/timeline">Timeline</Link>
        </li>
      </ul>
      <button onClick={handleLogout}>Logout</button>
    </>
  );
};

export default Sidebar;
