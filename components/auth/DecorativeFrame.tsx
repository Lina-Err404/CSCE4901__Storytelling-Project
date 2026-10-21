export default function DecorativeFrame() {
  const topStars = [120, 180, 245, 320, 400, 500, 700, 795, 885, 965, 1040];
  const sideStars = [170, 250, 520, 615];

  return (
    <svg
      className="decorative-frame"
      viewBox="0 0 1200 800"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <g id="small-star">
          <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" />
        </g>
      </defs>

      <rect
        x="18"
        y="18"
        width="1164"
        height="764"
        rx="2"
        className="frame-line frame-line-outer"
      />

      <rect
        x="52"
        y="52"
        width="1096"
        height="696"
        rx="2"
        className="frame-line frame-line-inner"
      />

      {/* Corner flourishes */}
      <path
        d="M54 155 C70 92 104 61 165 54 M54 112 C88 112 111 88 111 54"
        className="frame-flourish"
      />
      <path
        d="M1146 155 C1130 92 1096 61 1035 54 M1146 112 C1112 112 1089 88 1089 54"
        className="frame-flourish"
      />
      <path
        d="M54 645 C70 708 104 739 165 746 M54 688 C88 688 111 712 111 746"
        className="frame-flourish"
      />
      <path
        d="M1146 645 C1130 708 1096 739 1035 746 M1146 688 C1112 688 1089 712 1089 746"
        className="frame-flourish"
      />

      {/* Small stars keep the hand-drawn border feel without crowding the center. */}
      {topStars.map((x) => (
        <use key={`top-${x}`} href="#small-star" x={x} y="35" />
      ))}

      {topStars.map((x) => (
        <use key={`bottom-${x}`} href="#small-star" x={x} y="765" />
      ))}

      {sideStars.map((y) => (
        <use key={`left-${y}`} href="#small-star" x="35" y={y} />
      ))}

      {sideStars.map((y) => (
        <use key={`right-${y}`} href="#small-star" x="1165" y={y} />
      ))}

      {/* Small grimoire-style geometric details */}
      <path d="M580 36 H620" className="frame-detail-line" />
      <path d="M600 26 L607 36 L600 46 L593 36 Z" className="frame-detail" />

      <path d="M580 764 H620" className="frame-detail-line" />
      <path d="M600 754 L607 764 L600 774 L593 764 Z" className="frame-detail" />
    </svg>
  );
}