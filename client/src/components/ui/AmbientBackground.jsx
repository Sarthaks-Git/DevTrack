function AmbientBackground({ children, className = "" }) {
  return (
    <div
      className={`relative min-h-screen bg-[var(--dt-background)] ${className}`}
    >
      {/* Independent visual background */}
      <div
        className="
                    pointer-events-none
                    fixed
                    inset-0
                    z-0
                    overflow-hidden
                "
        aria-hidden="true"
      >
        <div className="dt-stars">
          <div className="dt-stars-layer dt-stars-far" />
          <div className="dt-stars-layer dt-stars-near" />
          <div className="dt-stars-glow" />
        </div>
      </div>

      {/* Application content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AmbientBackground;
