import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;

  // Debug: log the first few lines
  const lines = content.split("\n");
  const firstFewLines = lines.slice(0, 5).join("\n");
  console.log("Processing file:", filePath);
  console.log("First few lines:", firstFewLines);

  // Replace @shared/* imports with @bubbles/shared/*
  content = content.replace(/from ['"`]@shared\/([^'"`]*)['"`]/g, 'from "@bubbles/shared/$1"');

  // Replace the specific problematic import pattern for database
  const beforeReplace = content;
  content = content.replace(/from ['"`]\.\.\/\.\.\/\.\.\/['"`]/g, 'from "@bubbles/shared/database"');
  if (beforeReplace !== content) {
    console.log("Fixed database import in:", filePath);
  }

  // Replace any other relative path imports that point to the wrong location
  content = content.replace(/from ['"`](\.\.\/?)*\.\.\/\.\.\/['"`]/g, 'from "@bubbles/shared/database"');
  content = content.replace(/from ['"`](\.\.\/?)*\.\.\/\.\.\/database['"`]/g, 'from "@bubbles/shared/database"');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log("Fixed imports in:", filePath);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith(".js")) {
      replaceInFile(filePath);
    }
  });
}

// Start from the build directory
const buildDir = path.join(__dirname, "..", "build");
console.log("Fixing imports in:", buildDir);
walkDir(buildDir);
console.log("Import fixes completed!");
