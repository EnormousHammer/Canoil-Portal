# Copy This App to a New GitHub Repo (Work from the Copy)

Use this so you **leave the current repo as-is** and do all new work (auth, automation, etc.) in a **copy**.

---

## Step 1: Create a new repo on GitHub

1. Go to **https://github.com/new** (or your org’s “New repository”).
2. Set:
   - **Repository name:** e.g. `Canoil-Portal-ERP` (ERP / manufacturing focus) or `canoil-portal-v2`
   - **Visibility:** Private or Public (your choice)
   - **Do NOT** add a README, .gitignore, or license (keep it empty).
3. Click **Create repository**.

Copy the new repo URL, e.g.:
- `https://github.com/EnormousHammer/Canoil-Portal-ERP.git`  
  or  
- `https://github.com/YourOrg/Canoil-Portal-ERP.git`

---

## Step 2: Push this app to the new repo (from this folder)

**Option A – Run the script (easiest)**

1. Open PowerShell in this folder (`canoil-portal`).
2. Run:
   ```powershell
   .\push-copy-to-new-repo.ps1 -NewRepoUrl "https://github.com/EnormousHammer/Canoil-Portal-ERP.git"
   ```
   Replace with your real new repo URL if different.

**Option B – Run commands yourself**

In this folder (`canoil-portal`), run:

```powershell
# Add the new repo as a remote named "copy"
git remote add copy https://github.com/YOUR_USER_OR_ORG/YOUR_NEW_REPO_NAME.git

# Push main to the new repo (this is the copy)
git push copy main
```

After this, the **new GitHub repo** has a full copy of the app. This folder is **unchanged**; `origin` still points to the original repo.

---

## Step 3: Work from the copy (leave this one untouched)

1. **Clone the new repo** into a different folder, e.g.:
   ```powershell
   cd "g:\Shared drives\IT_Automation\Canoil Apps\Canoil Helper"
   git clone https://github.com/EnormousHammer/Canoil-Portal-ERP.git Canoil-Portal-ERP
   cd Canoil-Portal-ERP
   ```
2. Do all new work (auth, automation, etc.) **inside `canoil-portal-copy`**.
3. Keep **this** folder (`canoil-portal`) as your stable/original; no need to change it.

---

## Summary

| Location              | Role                                      |
|-----------------------|-------------------------------------------|
| **This folder** (current repo) | Leave as-is; original / stable.           |
| **New GitHub repo**   | Copy of the app (created in Step 2).      |
| **New clone** (e.g. `Canoil-Portal-ERP`) | Your working copy for new features.       |

---

## If you need to push updates from this folder to the copy later

```powershell
git push copy main
```

(Only run this if you intentionally want to sync this original into the copy repo again.)
