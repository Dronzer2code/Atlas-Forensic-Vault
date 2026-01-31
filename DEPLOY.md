# 🚀 Deployment Guide

This guide explains how to deploy the **Atlas Forensic Vault** (Next.js application) to **Vercel** (Recommended) or Cloudflare Pages.

## Option 1: Deploy to Vercel (Recommended)

Vercel provides native support for Next.js and is the easiest way to deploy this application, especially given the MongoDB dependencies.

### Steps

1.  **Push to GitHub**: Ensure your latest code is pushed to your GitHub repository.
2.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com) and log in with GitHub.
3.  **Import Project**: Click "Add New..." > "Project" and select your `atlas-forensic-vault` repository.
4.  **Configure Project**:
    *   **Framework Preset**: Next.js (should be auto-detected).
    *   **Root Directory**: `./` (default).
5.  **Environment Variables**: Add the following variables in the "Environment Variables" section:
    *   `MONGODB_URI`
    *   `GEMINI_API_KEY`
    *   `ELEVENLABS_API_KEY`
    *   `GITHUB_TOKEN` (Optional, for higher rate limits)
6.  **Deploy**: Click "Deploy".

### Vercel Configuration (`vercel.json`)

A `vercel.json` file has been added to configure serverless function limits (memory and duration) to ensure smooth operation of the analysis pipeline.

---

## Option 2: Deploy to Cloudflare Pages

> **Note**: Cloudflare Pages requires specific compatibility flags for MongoDB.

## Prerequisites

1.  A Cloudflare account.
2.  A GitHub account.
3.  The project pushed to a GitHub repository.

## Step 1: Prepare the Project

Ensure you have the necessary configuration for Cloudflare Pages.

1.  **Runtime Configuration**: API routes are configured with `export const runtime = 'nodejs';` to ensure compatibility with MongoDB and other libraries that require Node.js modules (like `crypto`). The `@cloudflare/next-on-pages` adapter will bundle these for the Edge environment using the `nodejs_compat` flag.
2.  **Dependencies**: `@cloudflare/next-on-pages` must be installed (Already done).

## Step 2: Create a Cloudflare Pages Project

1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**.
3.  Select your GitHub repository (`atlas-forensic-vault` or whatever you named it).
4.  Click **Begin setup**.

## Step 3: Configure Build Settings

In the "Set up builds and deployments" section, use the following settings:

*   **Project name**: `atlas-forensic-vault` (or your preference)
*   **Production branch**: `main`
*   **Framework preset**: `Next.js`
*   **Build command**: `npx @cloudflare/next-on-pages`
*   **Build output directory**: `.vercel/output/static`

## Step 4: Environment Variables

Add the following environment variables in the **Environment variables** section (Production and Preview):

| Variable Name | Description |
| :--- | :--- |
| `MONGODB_URI` | Your MongoDB Atlas connection string. |
| `GEMINI_API_KEY` | Google Gemini API Key. |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key. |
| `CLOUDFLARE_R2_BUCKET` | (Optional) R2 Bucket name if using R2. |

## Step 5: Compatibility Flags (CRITICAL)

**MongoDB requires the Node.js compatibility layer in Cloudflare Workers.**

1.  After the project is created (the first build might fail, that's okay), go to **Settings** > **Functions**.
2.  Scroll down to **Compatibility Flags**.
3.  Add the following flag:
    *   `nodejs_compat`
4.  **Redeploy**: Go to the **Deployments** tab and retry the deployment.

## Step 6: Verify Deployment

Once the build finishes, visit the provided `*.pages.dev` URL.

1.  Test the **Health Check**: `/api/health`
2.  Submit a repo to test the **Analysis Pipeline**.

---

## Troubleshooting

*   **MongoDB Connection Issues**: Ensure `nodejs_compat` flag is set. Ensure your MongoDB Atlas IP Access List allows access from anywhere (`0.0.0.0/0`) since Cloudflare IPs change.
*   **Build Errors**: Check the build logs. If you see errors about `crypto` or other Node.js modules, ensure the API routes are set to `export const runtime = 'nodejs'` and that the `nodejs_compat` flag is enabled in Cloudflare Dashboard.
