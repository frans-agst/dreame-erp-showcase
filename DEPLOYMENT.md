# Deploying OmniERP Retail ERP to Vercel

This guide will walk you through deploying your Next.js + Supabase ERP application to Vercel.

## Prerequisites

- A GitHub account (or GitLab/Bitbucket)
- A Vercel account (sign up at https://vercel.com)
- Your Supabase project URL and keys
- Git installed on your machine

## Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - OmniERP Retail ERP"
```

### 1.2 Create a GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `omnierp-retail-erp`)
3. Don't initialize with README (you already have one)

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/omnierp-retail-erp.git
git branch -M main
git push -u origin main
```

## Step 2: Prepare Environment Variables

Create a `.env.production` file (for reference only, don't commit this):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important**: These will be added to Vercel's dashboard, not committed to Git.

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/new
   - Sign in with your GitHub account

2. **Import Your Repository**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select your `omnierp-retail-erp` repository
   - Click "Import"

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://gepchzhrrdygpiwrnign.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY = your_service_role_key_here
   ```

   **Important**: 
   - Add these for all environments (Production, Preview, Development)
   - Never commit these values to Git

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (2-5 minutes)
   - Your app will be live at `https://your-project.vercel.app`

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Add Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   ```

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Step 4: Configure Supabase for Production

### 4.1 Update Supabase Site URL

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Update **Site URL** to your Vercel domain:
   ```
   https://your-project.vercel.app
   ```

### 4.2 Add Redirect URLs

Add these to **Redirect URLs**:
```
https://your-project.vercel.app/auth/callback
https://your-project.vercel.app/reset-password
https://*.vercel.app/auth/callback
https://*.vercel.app/reset-password
```

The wildcard `*` allows preview deployments to work.

### 4.3 Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Update the password reset email template to use your domain:
   ```
   {{ .SiteURL }}/reset-password?token={{ .Token }}
   ```

## Step 5: Run Database Migrations

Your Supabase database needs to have all migrations applied:

1. **Via Supabase Dashboard**:
   - Go to **SQL Editor**
   - Run each migration file in order:
     - `001_initial_schema.sql`
     - `002_rls_policies.sql`
     - `003_audit_triggers.sql`
     - `004_v2_refactor.sql`
     - `005_data_migration.sql`
     - `006_fiscal_calendar_seed.sql`
     - `007_branch_to_store_migration.sql`
     - `008_restrict_audit_log_admin_only.sql`

2. **Via Supabase CLI** (if you have it set up):
   ```bash
   supabase db push
   ```

## Step 6: Verify Deployment

### 6.1 Check Build Logs

1. Go to your Vercel project dashboard
2. Click on the latest deployment
3. Check the "Build Logs" tab for any errors

### 6.2 Test Your Application

Visit your deployed URL and test:

- ✅ Login page loads
- ✅ Can log in with test credentials
- ✅ Dashboard loads correctly
- ✅ Password reset flow works
- ✅ All routes are accessible based on roles
- ✅ Data loads from Supabase

### 6.3 Common Issues

**Build Fails**:
- Check build logs for TypeScript errors
- Run `npm run build` locally first
- Ensure all dependencies are in `package.json`

**Environment Variables Not Working**:
- Verify they're added in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly

**Supabase Connection Issues**:
- Verify Supabase URL and keys are correct
- Check Supabase project is not paused
- Verify redirect URLs are configured

**Password Reset Not Working**:
- Check Supabase email templates
- Verify redirect URLs include your Vercel domain
- Check email provider settings in Supabase

## Step 7: Set Up Custom Domain (Optional)

1. **Add Domain in Vercel**:
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., `erp.yourdomain.com`)

2. **Configure DNS**:
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or follow Vercel's specific instructions

3. **Update Supabase**:
   - Add your custom domain to Supabase redirect URLs
   - Update Site URL if using custom domain as primary

## Step 8: Enable Automatic Deployments

Vercel automatically deploys when you push to GitHub:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

To disable auto-deploy:
1. Go to Project Settings → Git
2. Configure deployment branches

## Step 9: Monitor Your Application

### 9.1 Vercel Analytics

Enable analytics in Project Settings → Analytics

### 9.2 Error Tracking

Consider adding error tracking:
- Sentry
- LogRocket
- Vercel's built-in error tracking

### 9.3 Performance Monitoring

Monitor in Vercel Dashboard:
- Build times
- Function execution times
- Edge network performance

## Step 10: Production Checklist

Before going live, verify:

- [ ] All environment variables are set
- [ ] Database migrations are applied
- [ ] Supabase redirect URLs are configured
- [ ] Email templates are updated
- [ ] Test all user roles (admin, manager, staff, dealer)
- [ ] Test password reset flow
- [ ] Test all CRUD operations
- [ ] Verify RLS policies are working
- [ ] Check mobile responsiveness
- [ ] Test in different browsers
- [ ] Set up error monitoring
- [ ] Configure custom domain (if applicable)
- [ ] Set up backups for Supabase database
- [ ] Document admin credentials securely

## Continuous Deployment

Every time you push to GitHub:

1. Vercel automatically builds your app
2. Runs tests (if configured)
3. Deploys to preview URL (for PRs)
4. Deploys to production (for main branch)

## Rollback

If something goes wrong:

1. Go to Vercel Dashboard → Deployments
2. Find a previous working deployment
3. Click "..." → "Promote to Production"

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Supabase Docs**: https://supabase.com/docs

## Security Notes

- Never commit `.env` files to Git
- Use Vercel's environment variables feature
- Rotate Supabase keys if exposed
- Enable Supabase's security features (RLS, email verification)
- Set up rate limiting in Supabase
- Monitor for suspicious activity

---

**Your app is now deployed! 🎉**

Access it at: `https://your-project.vercel.app`
