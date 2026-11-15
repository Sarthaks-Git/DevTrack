import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <>
      <h1>DevTrack</h1>

      <h3>Your Developer Command Center</h3>

      <h4>
        Track your coding, projects, goals, and developer growth in one place.
      </h4>

      <button
        onClick={() => {
          navigate("/login");
        }}
      >
        Get Started
      </button>
    </>
  );
};

export default Hero;