# Friends & Folder Sharing - Setup Instructions

## Step 1: Run the Updated SQL Migration

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Paste the contents of `friends-sharing-migration.sql`
4. Click "Run" - no warnings should appear this time
5. Wait for confirmation that all tables were created

## Step 2: Backfill Existing Users

After running the SQL migration, you need to populate the `users` table with existing accounts:

**Option A: Using the API directly**
```bash
curl -X POST http://localhost:3000/api/users/backfill
```

**Option B: Using a browser**
1. Make sure your app is running (`npm run dev`)
2. Visit: `http://localhost:3000/api/users/backfill` in your browser
3. You should see a JSON response confirming users were created

## Step 3: Verify Everything Works

1. **Sign out and sign back in** to trigger automatic profile creation
2. **Check the Friends section** in the sidebar - you should see the "Friends" section
3. **Click "Add Friends"** to search for users
4. **Test folder sharing** - create a folder and click the share icon

## How It Works

### Automatic Profile Creation
- **On sign-in**: User profile is automatically created/updated in Supabase
- **On app load**: If user already signed in, profile is synced
- **Both existing and new users** get profiles automatically

### Existing Users
- The backfill script creates placeholder profiles for all existing users
- When those users next sign in, their profiles will be updated with real email/names from Google

### New Users
- Profiles are created automatically when they first sign in
- All Google OAuth info (email, name, picture) is stored

## What Changed

✅ **RLS Policies**: Updated to work with Google OAuth (authentication handled in app)
✅ **User Profiles**: Auto-created on sign-in and synced on app load
✅ **Backfill Script**: Populates existing users with placeholder data
✅ **API Routes**: Updated to handle user profile creation

## Troubleshooting

**If friends search returns no results:**
- Make sure you've run the backfill endpoint
- Make sure your friends have signed in at least once
- Check browser console for any errors

**If you see permission errors:**
- The RLS policies are now permissive, so this shouldn't happen
- If it does, check that the SQL migration ran successfully

**If profiles aren't updating:**
- Check the browser console for error messages
- Verify Supabase credentials are set correctly in `.env.local`

## Summary

Everything is now set up for friends and folder sharing! The system will:
- Automatically create user profiles when someone signs in
- Allow searching for friends by email
- Allow sharing folders with view/edit permissions
- Show shared folders in a separate section

No manual intervention needed after initial setup - it all happens automatically when users sign in! 🎉

