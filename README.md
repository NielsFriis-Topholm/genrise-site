# Genrise – website

Statisk site (ren HTML/CSS/JS). Ingen build-step.

## Deploy: GitHub → Vercel
1. Opret et tomt repo på GitHub (fx `genrise-site`).
2. I denne mappe:
   ```bash
   git init
   git add .
   git commit -m "Initial Genrise site"
   git branch -M main
   git remote add origin git@github.com:<bruger>/genrise-site.git
   git push -u origin main
   ```
3. Gå til vercel.com → **Add New → Project** → importér repoet.
   Framework preset: **Other**. Build command: tom. Output directory: tom (root).
4. Deploy. Hvert push til `main` udløser et nyt deploy; pull requests får preview-URL'er.
5. Under **Settings → Domains** tilføjes `genrise.com` og `www.genrise.com`, og DNS peges efter Vercels anvisning.

## Struktur
- `index.html` – forsiden (alt CSS/JS inline)
- `assets/` – billeder. Erstat med originalfiler i høj opløsning (samme filnavne) før lancering.
- `vercel.json` – clean URLs og cache-headers til assets
