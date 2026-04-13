# Dealership Email Assistant

This app connects to your Gmail, reads new customer emails, uses AI to draft replies, and shows you a simple dashboard where you can review and send each reply — or skip it. **Nothing sends automatically. You approve every reply before it goes out.**

---

## What You Need Before Starting

1. A computer with **Node.js** installed
2. A **Google account** (the Gmail inbox this will connect to)
3. An **Anthropic API key** (for the AI reply drafting)

---

## Step 1 — Install Node.js (if you haven't already)

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the one that says "Recommended for most users")
3. Run the installer and follow the steps
4. When done, open a command prompt and type: `node --version`
   - You should see something like `v20.11.0`. If you do, you're good!

---

## Step 2 — Get Your Anthropic API Key

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign in (or create a free account)
3. Click **API Keys** in the left menu
4. Click **Create Key**, give it a name like "Dealership App"
5. Copy the key — it starts with `sk-ant-...`
6. Save it somewhere safe — you'll need it in Step 4

---

## Step 3 — Set Up Google OAuth Credentials

This lets the app read and send email from your Gmail account.

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
   - Name it something like "Dealership Email App" → click **Create**
3. In the left menu, go to **APIs & Services → Library**
   - Search for **Gmail API** → click it → click **Enable**
4. In the left menu, go to **APIs & Services → OAuth consent screen**
   - Choose **External** → click **Create**
   - Fill in **App name** (e.g. "Dealership Email") and your email → click **Save and Continue**
   - On the Scopes page, click **Save and Continue** (no changes needed)
   - On the Test users page, click **+ Add Users**, enter your Gmail address → click **Save and Continue**
5. In the left menu, go to **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: anything you want
   - Under **Authorized redirect URIs**, click **+ Add URI** and enter:
     ```
     http://localhost:3000/auth/callback
     ```
   - Click **Create**
6. A popup will show your **Client ID** and **Client Secret** — copy both

---

## Step 4 — Fill In Your Settings

1. Open the `dealer-email-app` folder on your computer
2. Open the file called `.env` in any text editor (Notepad works fine)
3. Fill in each line with your values:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
CHECK_INTERVAL_MINUTES=10
```

4. Save the file

---

## Step 5 — Edit Your Dealership Info

1. Open the file `dealership-profile.js`
2. Near the top, you'll see text like `[DEALERSHIP NAME]`, `[OWNER NAME]`, etc.
3. Replace everything in square brackets with your real information
4. Save the file

This is what the AI uses to write replies in your voice.

---

## Step 6 — Verify Your Setup

Open a command prompt, navigate to the `dealer-email-app` folder, and run:

```
node setup-check.js
```

You should see green checkmarks next to each setting. If you see any red X marks, go back and fill in the missing values.

---

## Step 7 — Start the App

In the same command prompt, run:

```
node server.js
```

You should see:
```
Dealership Email Assistant running at http://localhost:3000
Inbox will be checked every 10 minutes.
Gmail not connected yet. Visit http://localhost:3000 and click "Connect Gmail".
```

Leave this window open. The app runs as long as this window is open.

---

## Step 8 — Connect Your Gmail

1. Open your web browser and go to: [http://localhost:3000](http://localhost:3000)
2. You'll see a yellow banner that says "Connect your Gmail account"
3. Click **Connect Gmail**
4. A Google sign-in page will open — sign in with the Gmail account you want to use
5. Click **Allow** to grant the app access
6. You'll be sent back to the dashboard, and the banner at the top will now say **Connected**

---

## Using the Dashboard

**Check Inbox Now** — Click this to immediately check for new customer emails. New draft replies will appear on the page.

**Each Email Card:**
- Shows who it's from, what it's about, and when it arrived
- Shows the original email text (for your reference)
- Has an editable text box with the AI's suggested reply
- **You can edit the reply** before sending — just click in the text box and type

**Send This Reply** — Sends the reply through your Gmail and logs it

**Skip — I'll Handle It** — Removes the card without sending anything. You can reply manually through Gmail later.

**Yellow border cards** — These were flagged by the AI as potentially needing your closer attention. Review them carefully before sending.

**Recent Activity** — Shows the last 10 emails that were sent or skipped, with timestamps.

---

## Stopping the App

Press `Ctrl + C` in the command prompt window to stop the server.

To start it again later, just run `node server.js` again.

---

## Troubleshooting

**"Cannot find module" error on startup**
Run `npm install` in the `dealer-email-app` folder first.

**Gmail says "Access blocked" during OAuth**
Your Google app is in test mode. Go back to Google Cloud Console → OAuth consent screen → Test users, and make sure your email is added as a test user.

**"Gmail not connected" after OAuth**
The `tokens.json` file may have been deleted. Just click "Connect Gmail" again to go through the OAuth flow.

**Emails aren't showing up**
- Make sure the emails are unread and in your Inbox (not Spam or Promotions)
- Click "Check Inbox Now" to trigger an immediate check
- Check the command prompt window for any error messages

---

## Privacy & Security

- Your Gmail tokens are stored locally in `tokens.json` on your computer — they never leave your machine
- Emails are sent to Anthropic's API for AI processing (subject to Anthropic's privacy policy)
- The `.env` file with your keys is never shared or committed to any code repository
