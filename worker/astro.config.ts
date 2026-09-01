import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig, envField } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react()],
  session: false,
  env: {
    schema: {
      AAD_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      AAD_TENANT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      AAD_AUTHORITY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      AAD_REDIRECT_URI: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      AAD_POST_LOGOUT_REDIRECT_URI: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      AAD_SCOPES: envField.string({
        context: "server",
        access: "secret",
        default: "User.Read",
      }),
      API_BASE_URL: envField.string({
        context: "server",
        access: "secret",
      }),
      ENABLE_DEMO_ROUTES: envField.boolean({
        context: "server",
        access: "secret",
        default: false,
      }),
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ["astro/assets/services/noop"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
