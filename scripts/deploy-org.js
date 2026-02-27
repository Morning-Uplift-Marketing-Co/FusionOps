import { execSync } from "child_process"
import fetch from "node-fetch"
import fs from "fs"

const ORG = "Morning-Uplift-Marketing-Co"
const TOKEN = process.env.GITHUB_TOKEN

async function createRepo(name) {
  const res = await fetch(
    `https://api.github.com/orgs/${ORG}/repos`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json"
      },
      body: JSON.stringify({
        name,
        private: true
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }

  return res.json()
}

async function main() {
  const repoName = process.argv[2]
  if (!repoName) throw new Error("Provide repo name")

  console.log("Creating repo...")
  await createRepo(repoName)

  console.log("Initializing git...")
  execSync("git init", { stdio: "inherit" })
  execSync("git add .", { stdio: "inherit" })
  execSync(`git commit -m "Initial commit"`, { stdio: "inherit" })
  execSync(
    `git remote add origin https://github.com/${ORG}/${repoName}.git`,
    { stdio: "inherit" }
  )
  execSync("git branch -M main", { stdio: "inherit" })
  execSync("git push -u origin main", { stdio: "inherit" })

  console.log("Deploy complete.")
}

main()