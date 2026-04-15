# Pre-Deployment Checklist

Complete this checklist before deploying to production.

## Code Quality

- [ ] All TypeScript errors resolved (`npm run build`)
- [ ] All tests passing (`npm run test`)
- [ ] No console.log statements in production code
- [ ] All TODO comments addressed or documented
- [ ] Code reviewed and approved

## Environment Configuration

- [ ] `.env.local` contains all required variables
- [ ] `.env.production.example` is up to date
- [ ] Environment variables documented
- [ ] No sensitive data in Git history
- [ ] `.gitignore` includes all env files

## Database

- [ ] All migrations applied to Supabase
- [ ] RLS policies tested and working
- [ ] Database indexes created for performance
- [ ] Seed data loaded (if applicable)
- [ ] Backup strategy in place

## Authentication & Security

- [ ] Password reset flow tested
- [ ] All user roles tested (admin, manager, staff, dealer)
- [ ] RLS policies prevent unauthorized access
- [ ] CORS configured correctly
- [ ] Rate limiting configured in Supabase
- [ ] Security headers configured (see vercel.json)

## Supabase Configuration

- [ ] Site URL configured
- [ ] Redirect URLs added for all environments
- [ ] Email templates updated with production URLs
- [ ] Email provider configured and tested
- [ ] Storage buckets configured (if using)
- [ ] Edge functions deployed (if using)

## Application Testing

- [ ] Login/logout works
- [ ] Password reset works
- [ ] All CRUD operations work
- [ ] File uploads work (if applicable)
- [ ] PDF generation works
- [ ] Excel export works
- [ ] All forms validate correctly
- [ ] Error handling works
- [ ] Loading states display correctly

## Performance

- [ ] Images optimized
- [ ] Bundle size acceptable
- [ ] Lighthouse score > 90
- [ ] No memory leaks
- [ ] Database queries optimized

## Mobile & Browser Testing

- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Tested on Edge
- [ ] Tested on mobile devices
- [ ] Responsive design works

## Monitoring & Analytics

- [ ] Error tracking configured (Sentry, etc.)
- [ ] Analytics configured (if needed)
- [ ] Logging strategy in place
- [ ] Performance monitoring enabled

## Documentation

- [ ] README.md updated
- [ ] API documentation complete
- [ ] User guide created (if needed)
- [ ] Admin credentials documented securely
- [ ] Deployment process documented

## Vercel Configuration

- [ ] vercel.json configured
- [ ] Build command correct
- [ ] Environment variables ready
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid

## Final Checks

- [ ] All features work in production build
- [ ] No broken links
- [ ] All images load
- [ ] Favicon displays correctly
- [ ] Meta tags configured for SEO
- [ ] 404 page works
- [ ] Error page works

## Post-Deployment

- [ ] Smoke test all critical paths
- [ ] Monitor error logs for 24 hours
- [ ] Check performance metrics
- [ ] Verify email notifications work
- [ ] Test with real users
- [ ] Document any issues found

---

**Ready to deploy?** Follow [QUICK-DEPLOY.md](./QUICK-DEPLOY.md) or [DEPLOYMENT.md](./DEPLOYMENT.md)
