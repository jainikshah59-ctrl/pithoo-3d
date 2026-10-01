/* Pithoo 3D — Saat Pathar / Lagori — configuration.
   Free game: full Pithoo loop. Pro: extra grounds, ball skins, Pro League (harder AI + 2x score). */
window.PT = window.PT || {};
(function () {
  PT.config = {
    APP_NAME: "Pithoo 3D",
    TAGLINE: "Saat Pathar \u2022 Lagori",
    // TODO: paste your real UPI ID here, e.g. "jainik@okhdfcbank". Pay button stays disabled until then.
    UPI_ID: "REPLACE_WITH_YOUR_UPI_ID",
    UPI_PAYEE_NAME: "Pithoo 3D",
    PRO_PRICE_INR: 99,

    ARENA_R: 16,
    STONE_R: 0.55,
    STONE_H: 0.16,
    STONE_COUNT: 7,
    THROWS_PER_ROUND: 3,
    BALL_R: 0.22,
    GRAVITY: 22,
    HERO_SPEED: 5.4,
    MATE_SPEED: 3.7,
    DEF_SPEED: 4.6,
    LIVES: 3,
    REBUILD_TIME: 120,

    BALLS: [
      { id: "tennis", name: "Tennis Ball", pro: false, color: 0xc8e64a, seam: 0xffffff },
      { id: "rubber", name: "Street Rubber", pro: false, color: 0xd94f3d, seam: 0x7a1f14 },
      { id: "leather", name: "Leather Cherry", pro: true, color: 0x8e1f1f, seam: 0xf5e6c8 },
      { id: "gold", name: "Golden Ball", pro: true, color: 0xd9a441, seam: 0xfff3c4 },
      { id: "neon", name: "Neon Night", pro: true, color: 0x27e0ff, seam: 0x0a2a33 }
    ],
    GROUNDS: [
      { id: "maidan", name: "Maidan", pro: false, ground: 0x4e7a3e, ground2: 0x3e6530, sky: 0x1b2340, fog: 0x2a3352, line: 0xf5f1e8, ring: 0xffc94d },
      { id: "galli", name: "Galli", pro: false, ground: 0x6b6f75, ground2: 0x595d63, sky: 0x232733, fog: 0x333844, line: 0xffe9a8, ring: 0xff9d4d },
      { id: "beach", name: "Beach", pro: true, ground: 0xd9b878, ground2: 0xc7a566, sky: 0x274b63, fog: 0x3a6a86, line: 0xffffff, ring: 0xff6b4d },
      { id: "night", name: "Night Turf", pro: true, ground: 0x2e6b46, ground2: 0x255a3a, sky: 0x070a18, fog: 0x101a33, line: 0x9df2ff, ring: 0x27e0ff }
    ]
  };
})();
