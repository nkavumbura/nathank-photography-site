// Commits and pushes the current state of site/ to GitHub, which triggers
// Netlify to rebuild and redeploy automatically. Run after making edits in
// the admin editor (npm run admin) that you're happy to make live.
import { execSync } from "child_process";

const message = process.argv.slice(2).join(" ") || `Update site — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  const status = execSync("git status --porcelain").toString();
  if (!status.trim()) {
    console.log("Nothing to publish - working tree is clean.");
    process.exit(0);
  }

  run("git add -A");
  run(`git commit -m ${JSON.stringify(message)}`);
  run("git push");
  console.log("\nPushed. Netlify will rebuild and redeploy automatically (usually live within a minute).");
} catch (err) {
  console.error("\nPublish failed:", err.message);
  process.exit(1);
}
