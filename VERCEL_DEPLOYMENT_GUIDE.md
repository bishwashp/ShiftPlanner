# ShiftPlanner Vercel Deployment Guide

## Overview

This guide covers deploying the ShiftPlanner React application to Vercel. The application is configured as a frontend-only deployment using the calendar filtering system implemented in V0.7.3.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, Bitbucket)
3. **Node.js**: Ensure you have Node.js 16+ installed locally for testing

## Project Configuration

The project is already configured for Vercel deployment with:

- ✅ `vercel.json` - Complete Vercel configuration
- ✅ `package.json` - Updated with deployment-optimized settings
- ✅ Build process tested and working
- ✅ SPA routing configured for client-side navigation

## Deployment Methods

### Method 1: Vercel Dashboard (Recommended for first deployment)

1. **Connect Repository**
   ```
   1. Go to https://vercel.com/dashboard
   2. Click "New Project"
   3. Import your Git repository
   4. Select the ShiftPlanner repository
   ```

2. **Configure Project Settings**
   ```
   Framework Preset: Other (or leave as detected)
   Root Directory: ./
   Build Command: cd frontend && npm run build
   Output Directory: frontend/build
   Install Command: cd frontend && npm install
   ```

3. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your application
   - First deployment typically takes 2-3 minutes

### Method 2: Vercel CLI (For developers)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from Project Root**
   ```bash
   cd ShiftPlanner-master
   vercel
   ```

3. **Follow CLI Prompts**
   ```
   ? Set up and deploy "~/ShiftPlanner-master"? [Y/n] y
   ? Which scope? [Select your account]
   ? Link to existing project? [N/y] n
   ? What's your project's name? shiftplanner
   ? In which directory is your code located? ./
   ```

## Environment Variables

Currently, the application runs without external environment variables. If you need to add API endpoints or other configuration:

1. **In Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add variables for `Production`, `Preview`, and `Development`

2. **Common Variables (when needed):**
   ```
   REACT_APP_API_URL=https://your-api-endpoint.com
   REACT_APP_ENVIRONMENT=production
   ```

## Verification Steps

After deployment, verify the following:

### 1. **Application Loads**
- Visit your Vercel URL (e.g., `https://shiftplanner-abc123.vercel.app`)
- Verify the main dashboard loads correctly

### 2. **Calendar Filtering System**
- Navigate to the Schedule view
- Test the filter panel functionality:
  - ✅ Filter by analyst names
  - ✅ Filter by shift types  
  - ✅ Time range filtering
  - ✅ Availability filters
  - ✅ Filter persistence (localStorage)

### 3. **SPA Routing**
- Test navigation between different views (Dashboard, Analytics, etc.)
- Refresh the page on different routes - should not show 404 errors
- Test direct URL access to internal routes

### 4. **Performance**
- Check Lighthouse scores in browser dev tools
- Verify CSS and JS assets load correctly
- Test responsive design on mobile devices

## Build Configuration Details

### File Structure
```
ShiftPlanner-master/
├── vercel.json              # Vercel configuration
├── frontend/
│   ├── package.json         # React app dependencies
│   ├── build/              # Generated build files (auto-created)
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   └── src/                # React source code
└── VERCEL_DEPLOYMENT_GUIDE.md
```

### Key Configuration Files

#### `vercel.json`
- Configures build commands for the frontend subdirectory
- Sets up SPA routing with proper fallbacks
- Includes security headers and caching policies
- Optimizes static asset delivery

#### `frontend/package.json`
- Updated with `homepage: "./"` for relative paths
- Renamed to `shiftplanner-frontend` for clarity
- All dependencies properly listed for production builds

## Automatic Deployments

Once connected to Vercel:

1. **Push to main/master branch** → Automatic production deployment
2. **Push to other branches** → Automatic preview deployments  
3. **Pull requests** → Automatic preview deployments with unique URLs

## Custom Domain (Optional)

To use a custom domain:

1. **In Vercel Dashboard:**
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., `shiftplanner.yourdomain.com`)

2. **DNS Configuration:**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or use Vercel nameservers for full DNS management

## Monitoring and Analytics

Vercel provides built-in analytics:

1. **Real User Monitoring**: Visit Project → Analytics
2. **Build Logs**: Available in deployment details  
3. **Function Logs**: For any serverless functions (if added later)

## Troubleshooting

### Common Issues and Solutions

#### Build Failures
```bash
# Check build locally first:
cd frontend
npm run build

# Common fixes:
- Update Node.js version in Vercel (Settings → General → Node.js Version)
- Clear build cache in Vercel dashboard
- Check for TypeScript errors in build logs
```

#### 404 Errors on Route Refresh
- Verify `vercel.json` has correct rewrite rules (already configured)
- Check that SPA routing is properly set up in React Router

#### Static Assets Not Loading
- Verify `homepage: "./"` is set in `package.json` (already configured)
- Check asset paths in build output
- Verify build directory structure matches Vercel expectations

#### Performance Issues
- Enable Vercel Edge Network (automatic)
- Optimize bundle size using React DevTools Profiler
- Consider code splitting for larger components

### Getting Help

1. **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
2. **Build Logs**: Available in Vercel dashboard under deployments
3. **Community Support**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

## Security Notes

The deployment includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

Static assets are cached for 1 year with immutable headers for optimal performance.

## Next Steps After Deployment

1. **Set up monitoring** for uptime and performance
2. **Configure branch protection** rules in your Git repository
3. **Set up notifications** for deployment failures
4. **Consider adding CI/CD tests** before deployment
5. **Plan for API integration** if backend functionality is needed

---

**Deployment Status**: ✅ Ready for Production  
**Last Updated**: August 2025  
**Version**: V0.7.3 with Advanced Calendar Filtering