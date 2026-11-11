# Louis Chavey's scratch space

Small browser experiments live here. [(P)rose garden](./scratch/poetree/) is a local garden of word-grown plants.

## Run (P)rose garden locally

Do not open the HTML file directly with `file://`: its browser Python runtime needs an HTTP origin. From `scratch/poetree`, run:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Portfolio content publishing

Portfolio descriptions and media can live in `descriptions/` and `media/`. The portfolio spreadsheet can reference a description with a raw GitHub Markdown URL and list media in its `Artifacts` cell as `![Alt text](https://raw.githubusercontent.com/...)`.

`portfolio-sheet-on-edit.gs` is the Google Apps Script source that requests a portfolio Vercel deployment when a work-sheet row changes. It needs a `VERCEL_DEPLOY_HOOK_URL` Script Property and an installable spreadsheet edit trigger. The `Rebuild portfolio` workflow does the same after pushes to `descriptions/` or `media/`, using the `PORTFOLIO_DEPLOY_HOOK_URL` GitHub Actions secret.
