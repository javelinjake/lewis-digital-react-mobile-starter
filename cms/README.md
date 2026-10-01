# CMS

`pnpm create:project` can write `cms/projects/<slug>/project.json` with `"platform": "react"`. That marker is the bootstrap record for a Directus project. Run Directus separately and point `VITE_DIRECTUS_URL` at it.

Retry a marker with:

```bash
pnpm directus:bootstrap-project -- --site <slug>
```
