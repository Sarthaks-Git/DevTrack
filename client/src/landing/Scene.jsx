// One chapter of the landing story: a heading and text, beside a sample visual.
// The text comes first in the DOM so the page reads correctly with no styles or motion.
export default function Scene({ id, title, children, visual, caption = "Sample data", flip = false }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="lp-scene">
      <div className={`lp-scene-inner ${flip ? "lp-scene-flip" : ""}`}>
        <div className="lp-scene-text">
          <h2 id={`${id}-title`} className="lp-h2">{title}</h2>
          <div className="lp-body">{children}</div>
        </div>
        {visual ? (
          <figure className="lp-scene-visual">
            <div aria-hidden="true">{visual}</div>
            {caption ? <figcaption className="lp-caption">{caption}</figcaption> : null}
          </figure>
        ) : null}
      </div>
    </section>
  );
}
