import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAKEME",
    short_name: "TAKEME",
    description: "Buy. Sell. Give. Reuse.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#00C853",
    icons: [
      {
        src: "/brand/takeme-app-icon.png",
        sizes: "1080x1080",
        type: "image/png",
      },
    ],
  };
}
