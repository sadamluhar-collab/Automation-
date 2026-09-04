# Deployment
Render runs the API and disposable workers. Configure secrets in Render and apply migrations to Supabase before worker startup. The API exposes `/health`. Never commit `.env` or media artifacts.
