import { Assistant, Frank_Ruhl_Libre, Heebo, IBM_Plex_Mono, IBM_Plex_Sans_Hebrew, Secular_One, Varela_Round } from "next/font/google";

// Fonts used only by the A/B dashboard designs. Not preloaded, so the rest of the app doesn't pay for them.
// next/font needs literal options here, so they are spelled out per font.
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "900"], variable: "--f-frank", display: "swap", preload: false });
const assistant = Assistant({ subsets: ["hebrew", "latin"], weight: ["400", "600", "700"], variable: "--f-assistant", display: "swap", preload: false });
const plex = IBM_Plex_Sans_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600"], variable: "--f-plex", display: "swap", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-mono", display: "swap", preload: false });
const secular = Secular_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--f-secular", display: "swap", preload: false });
const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "700", "800", "900"], variable: "--f-heebo", display: "swap", preload: false });
const varela = Varela_Round({ subsets: ["hebrew", "latin"], weight: "400", variable: "--f-varela", display: "swap", preload: false });

export const fontVars = [frank, assistant, plex, plexMono, secular, heebo, varela].map((f) => f.variable).join(" ");
