import fs from "fs";
import { execSync } from "child_process";

const domain = process.env.DOMAIN;
const template = process.env.TEMPLATE;

if (!domain || !template) {
  console.error("❌ Missing DOMAIN or TEMPLATE");
  process.exit(1);
}

const cleanDomain = domain.replace(/[^a-z0-9.-]/gi, "").toLowerCase();
const outputDir = `dist-${cleanDomain}`;
const templateDir = `./src/templates/${template}`;

if (!fs.existsSync(templateDir)) {
  console.error(`❌ Template not found: ${template}`);
  process.exit(1);
}

process.env.SITE_URL = `https://${cleanDomain}`;

console.log(`🚀 Building ${cleanDomain}`);

if (fs.existsSync("dist")) {
  fs.rmSync("dist", { recursive: true, force: true });
}

execSync("astro build", { stdio: "inherit" });

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

fs.cpSync("dist", outputDir, { recursive: true });
fs.rmSync("dist", { recursive: true, force: true });

console.log(`✅ Done: ${outputDir}`);