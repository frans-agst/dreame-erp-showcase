# Quick Deploy Guide - 5 Minutes

Follow these steps to deploy your app to Vercel in 5 minutes:

## 1. Push to GitHub (2 minutes)

```bash
# Initialize git if not done
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/dreame-retail-erp.git
git branch -M main
git push -u origin main
```

## 2. Deploy to Vercel (2 minutes)

1. Go to https://vercel.com/new
2. Click "Import" next to your repository
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click "Deploy"

## 3. Configure Supabase (1 minute)

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL**: `https://your-project.vercel.app`
3. Add **Redirect URLs**:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app/reset-password`
   - `https://*.vercel.app/auth/callback`
   - `https://*.vercel.app/reset-password`

## Done! 🎉

Your app is live at: `https://your-project.vercel.app`

---

**Need help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.
