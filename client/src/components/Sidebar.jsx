import React from "react";
import { Link } from "react-router-dom";
const Sidebar = () => {
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
    </>
  );
};

export default Sidebar;
