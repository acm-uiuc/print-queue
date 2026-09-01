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
      AAD_API_AUDIENCE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      DEFAULT_PRINTER_ID: envField.string({
        context: "server",
        access: "secret",
        default: "office-main",
      }),
      DEVICE_CERTIFICATES: envField.string({
        context: "server",
        access: "secret",
        default: "{}",
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
