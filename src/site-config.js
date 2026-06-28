// BERZAN — ortak Tailwind teması (tüm sayfalarda kullanılır)
tailwind.config = {
  darkMode: "class",
  theme: { extend: {
    colors: {
      "outline": "#75777d", "on-secondary-fixed-variant": "#544600", "primary-fixed": "#d9e3fa",
      "primary-fixed-dim": "#bdc7de", "on-error-container": "#93000a", "on-tertiary-container": "#998162",
      "surface-tint": "#555f72", "on-primary-container": "#7b859a", "on-tertiary-fixed-variant": "#574329",
      "secondary": "#705d00", "outline-variant": "#c5c6cd", "surface-container-highest": "#d3e4fe",
      "on-primary-fixed-variant": "#3d475a", "inverse-on-surface": "#eaf1ff", "inverse-surface": "#213145",
      "primary": "#00020a", "secondary-container": "#fcd400", "tertiary-fixed": "#fcdeb9",
      "on-primary": "#ffffff", "on-primary-fixed": "#121c2d", "on-error": "#ffffff",
      "surface-container-high": "#dce9ff", "error-container": "#ffdad6", "primary-container": "#131d2e",
      "surface": "#f8f9ff", "on-tertiary": "#ffffff", "on-surface-variant": "#45474c",
      "on-secondary-fixed": "#221b00", "surface-variant": "#d3e4fe", "on-secondary": "#ffffff",
      "surface-bright": "#f8f9ff", "error": "#ba1a1a", "on-secondary-container": "#6e5c00",
      "tertiary": "#050200", "secondary-fixed-dim": "#e9c400", "inverse-primary": "#bdc7de",
      "surface-container-lowest": "#ffffff", "on-tertiary-fixed": "#271903", "surface-container": "#e5eeff",
      "tertiary-fixed-dim": "#dec29f", "on-background": "#0b1c30", "tertiary-container": "#291a04",
      "on-surface": "#0b1c30", "surface-container-low": "#eff4ff", "background": "#f8f9ff",
      "secondary-fixed": "#ffe16d", "surface-dim": "#cbdbf5"
    },
    borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
    spacing: { "margin-desktop": "64px", "container-max": "1280px", "margin-mobile": "20px", "section-gap": "120px", "gutter": "32px" },
    fontFamily: {
      "body-lg": ["Inter"], "headline-lg-mobile": ["Hanken Grotesk"], "label-sm": ["Hanken Grotesk"],
      "headline-xl": ["Hanken Grotesk"], "headline-md": ["Hanken Grotesk"], "headline-lg": ["Hanken Grotesk"],
      "headline-sm": ["Hanken Grotesk"], "label-md": ["Hanken Grotesk"], "body-md": ["Inter"]
    },
    fontSize: {
      "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
      "headline-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
      "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
      "headline-xl": ["clamp(2.5rem, 5vw, 60px)", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "700" }],
      "headline-md": ["30px", { lineHeight: "38px", fontWeight: "600" }],
      "headline-lg": ["clamp(2rem, 3.6vw, 48px)", { lineHeight: "1.12", letterSpacing: "-0.01em", fontWeight: "700" }],
      "headline-sm": ["24px", { lineHeight: "32px", fontWeight: "600" }],
      "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600" }],
      "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }]
    }
  } }
};
