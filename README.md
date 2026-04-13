# Dealership Email Assistant

This app reads new customer emails from your Gmail, uses AI to write a draft reply, and shows you a simple screen where you can review and send each reply — or skip it.

**Nothing sends automatically. You approve every reply before it goes out.**

---

## What This Does

- Checks your Gmail inbox on a schedule (every 10 minutes by default)
- Drafts a reply for each new customer email
- Shows you a dashboard where you read, edit, and click Send or Skip
- Keeps a log of everything sent or skipped

---

## What You'll Need

- A Windows computer
- Internet connection
- A Gmail account (the one you want to connect)
- An Anthropic API key (for the AI — free to sign up)
- Google credentials (explained below — takes about 10 minutes to set up)

---

## STEP 1 — Download the App

You have two options. Option A is easier if you've never used Git.

### Option A — Download as a ZIP file (easiest)

1. Go to: **https://github.com/drewkeriazes/dealership-auto-responder**
2. Click the green **Code** button
3. Click **Download ZIP**
4. Once downloaded, find the ZIP file in your Downloads folder
5. Right-click it → **Extract All** → choose where to save it (e.g. your Desktop)
6. Open the extracted folder — it's called `dealership-auto-responder-main`

### Option B — Use Git (if you already have it installed)

Open Command Prompt and run:
```
git clone https://github.com/drewkeriazes/dealership-auto-responder.git
cd dealership-auto-responder
```

---

## STEP 2 — Install Node.js

Node.js is the engine that runs the app. You only need to install this once.

1. Go to: **https://nodejs.org**
2. Click the big button that says **"LTS — Recommended for most users"**
3. Run the downloaded installer — just click Next through everything
4. When it's done, open Command Prompt (search "cmd" in the Start menu)
5. Type `node --version` and press Enter
   - You should see something like `v20.11.0`
   - If you see that, Node.js is installed correctly

---

## STEP 3 — Install the App's Dependencies

This downloads the extra code the app needs to run. You only do this once.

1. Open Command Prompt
2. Navigate to the app folder. Type this (adjust the path to match where you saved it):
   ```
   cd C:\Users\YourName\Desktop\dealership-auto-responder-main
   ```
   > **Tip:** You can also just type `cd ` (with a space), then drag the folder into the Command Prompt window, then press Enter.
3. Run:
   ```
   npm install
   ```
4. Wait for it to finish — it'll show some text and then stop. That's normal.

---

## STEP 4 — Get Your Anthropic API Key

This is the AI service that writes the draft replies.

1. Go to: **https://console.anthropic.com**
2. Click **Sign Up** (it's free to start)
3. Once logged in, click **API Keys** in the left menu
4. Click **Create Key**, name it "Dealership App"
5. Copy the key — it looks like `sk-ant-api03-...`
6. Paste it somewhere safe (like Notepad) — you'll need it in Step 6

---

## STEP 5 — Set Up Google Access

This is the most involved step, but you only do it once. It allows the app to read and send email through your Gmail account.

1. Go to: **https://console.cloud.google.com** and sign in with your Google account

2. **Create a new project:**
   - Click the dropdown at the very top of the page (it might say "Select a project")
   - Click **New Project**
   - Name it `Dealership Email App` → click **Create**
   - Wait a moment, then make sure that project is selected in the dropdown

3. **Turn on Gmail:**
   - In the left menu, click **APIs & Services → Library**
   - In the search box, type `Gmail API`
   - Click **Gmail API** in the results → click **Enable**

4. **Set up the permissions screen:**
   - In the left menu, click **APIs & Services → OAuth consent screen**
   - Select **External** → click **Create**
   - Fill in **App name**: `Dealership Email App`
   - Fill in **User support email**: your email address
   - Scroll down, fill in **Developer contact information**: your email address again
   - Click **Save and Continue**
   - On the next screen (Scopes), click **Save and Continue** — don't change anything
   - On the next screen (Test users), click **+ Add Users**
     - Enter the Gmail address you want to connect
     - Click **Add**, then **Save and Continue**
   - Click **Back to Dashboard**

5. **Create your credentials:**
   - In the left menu, click **APIs & Services → Credentials**
   - Click **+ Create Credentials** → **OAuth client ID**
   - For **Application type**, choose **Web application**
   - For **Name**, type anything (e.g. `Dealership App`)
   - Under **Authorized redirect URIs**, click **+ Add URI**
   - Type exactly: `http://localhost:3000/auth/callback`
   - Click **Create**
   - A popup will appear with your **Client ID** and **Client Secret**
   - Copy both — paste them into Notepad for the next step

---

## STEP 6 — Fill In Your Settings

1. Open the app folder
2. Find the file called `.env` — right-click it → **Open with** → **Notepad**
   > If you can't see `.env`, Windows may be hiding it. In File Explorer, click **View** at the top and check **Hidden items**.
3. Fill in the values you collected:

```
ANTHROPIC_API_KEY=paste-your-anthropic-key-here
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
CHECK_INTERVAL_MINUTES=10
```

4. Save the file (Ctrl+S)

---

## STEP 7 — Customize Your Dealership Info

The AI uses this information to write replies in your voice.

1. Open the file `dealership-profile.js` in Notepad
2. Replace everything in `[square brackets]` with your real info:
   - `[DEALERSHIP NAME]` → your dealership's name
   - `[OWNER NAME]` → your name
   - `[CITY, STATE]` → your city and state
   - `[PHONE NUMBER]` → your phone number
   - `[WEBSITE URL]` → your website (or remove the line if you don't have one)
   - `[HOURS]` → your business hours
3. Save the file (Ctrl+S)

---

## STEP 8 — Check That Everything Is Set Up

1. Open Command Prompt
2. Navigate to the app folder (same as Step 3)
3. Run:
   ```
   node setup-check.js
   ```
4. You should see green checkmarks (✓) next to each item
5. If you see any red X marks, go back and fix the missing values in `.env`

---

## STEP 9 — Start the App

**Option A — Double-click to start (easiest):**

Double-click the file called `start.bat` in the app folder.

A black window will open and show:
```
Starting Dealership Email Assistant...
Once started, open your browser and go to: http://localhost:3000
```

**Option B — Command Prompt:**

```
node server.js
```

**Leave this window open.** The app only runs while the window is open. If you close it, the app stops.

---

## STEP 10 — Connect Your Gmail

1. Open your web browser (Chrome, Edge, etc.)
2. Go to: **http://localhost:3000**
3. You'll see a yellow banner — click **Connect Gmail**
4. Google's sign-in page will open — sign in with your Gmail account
5. Click **Allow** when it asks for permission
6. You'll be brought back to the dashboard
7. The top of the page will now show a green **Connected** badge

You're all set!

---

## Using the Dashboard

**Check Inbox Now** — Click to immediately check for new emails (otherwise it checks automatically every 10 minutes)

**Each email card shows:**
- Who it's from and what it's about
- The original email text
- A text box with the AI's draft reply — **you can edit this before sending**

**Send This Reply** — Sends the email through Gmail and logs it

**Skip — I'll Handle It** — Removes the card. No email is sent. You can reply manually from Gmail later.

**Yellow border** — The AI flagged this email as something you should look at carefully before sending.

**Recent Activity** — Shows the last 10 emails that were sent or skipped.

---

## Every Day: How to Start and Stop

**To start:** Double-click `start.bat` (or run `node server.js` in Command Prompt)

**To stop:** Close the black Command Prompt window, or press `Ctrl + C` inside it

---

## Troubleshooting

**"Cannot find module" error**
Run `npm install` in the app folder, then try again.

**"Gmail not connected" or the connect button isn't working**
Go through the Connect Gmail steps again — it only takes a few seconds.

**Gmail shows "Access blocked"**
Your Google app is still in test mode. Go to Google Cloud Console → APIs & Services → OAuth consent screen → Test users, and add your Gmail address.

**Emails aren't showing up after clicking "Check Inbox Now"**
- Make sure the emails are unread and sitting in your main Inbox (not Promotions or Spam)
- Check the black Command Prompt window for any error messages in red

**The app isn't running / browser says "This site can't be reached"**
The app window was probably closed. Double-click `start.bat` to start it again.

---

## Your Privacy

- Your Gmail login is saved in a file called `tokens.json` on your computer only — it never goes anywhere else
- Email content is sent to Anthropic's AI service to generate replies
- Your API keys in `.env` are never shared or uploaded anywhere
