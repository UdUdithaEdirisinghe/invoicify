# Change Password - User Guide

## How to Change Your Password

### Step-by-Step Instructions

1. **Login to your account**
   - Go to http://localhost:3000/login.html
   - Enter your username and password
   - Click "Login"

2. **Navigate to Settings**
   - Click "Settings" in the left sidebar
   - Or go directly to http://localhost:3000/settings.html

3. **Scroll to Security Section**
   - Find the "Security" section at the bottom of the settings page
   - You'll see three password fields

4. **Fill in the Password Fields**
   ```
   Current Password:  [enter your current password]
   New Password:      [enter your new password - min 6 chars]
   Confirm Password:  [enter the same new password again]
   ```

5. **Click "Change Password" Button**
   - A confirmation dialog will appear
   - Click "OK" to proceed

6. **Wait for Confirmation**
   - You'll see a loading spinner
   - After a moment, you'll see: "✓ Password changed successfully!"
   - The password fields will clear automatically

7. **Optional: Logout and Login Again**
   - After 2 seconds, you'll be asked if you want to logout
   - Click "OK" to logout and login with your new password
   - Or click "Cancel" to stay logged in

---

## Password Requirements

✅ **Minimum 6 characters**
✅ **Must be different from your current password**
✅ **New password and confirm password must match**

---

## What You'll See

### Success
```
✓ Password changed successfully!
```
Then:
```
Password changed! Would you like to logout and login again with your new password?
[OK] [Cancel]
```

### Errors (with helpful messages)
- "Please enter your current password" → Current field is empty
- "Please enter a new password" → New password field is empty
- "New password must be at least 6 characters" → Too short
- "Please confirm your new password" → Confirm field is empty
- "New passwords do not match" → Typo in one of the new password fields
- "New password must be different from current password" → Same as old
- "Current password is incorrect" → You typed your current password wrong

---

## Tips

💡 **Caps Lock** - Make sure Caps Lock is off if having trouble

💡 **Copy-Paste** - You can copy-paste passwords if needed

💡 **Leave Empty** - If you don't want to change password, leave all three fields empty

💡 **Strong Password** - Use a mix of letters, numbers, and symbols for better security

💡 **Remember It** - Write down your new password in a safe place

---

## Troubleshooting

### "Current password is incorrect"
- Double-check you typed your current password correctly
- Make sure Caps Lock is off
- Try copy-pasting if you have it saved somewhere

### "Cannot connect to server"
- Make sure the server is running
- Check your internet connection
- Try refreshing the page

### Page doesn't load
- Check the URL is correct: http://localhost:3000/settings.html
- Make sure you're logged in
- Try clearing browser cache (Ctrl+Shift+R)

### Button doesn't work
- Check browser console (F12) for errors
- Make sure JavaScript is enabled
- Try a different browser

---

## Security Notes

🔒 **Your password is encrypted** - Stored as a secure hash, never in plain text

🔒 **Current password required** - You must know your current password to change it

🔒 **JWT token** - Your session is verified before allowing password change

🔒 **Automatic logout** - Can logout immediately after change for extra security

---

## Quick Reference

| Action | What to Do |
|--------|-----------|
| Change password | Fill 3 fields → Click button |
| Cancel | Just leave the fields empty |
| Strong password | 8+ chars, mixed case, numbers |
| Forgot current | Can't change (security), must reset |
| Test new password | Logout and login again |

---

## Example Walkthrough

```
1. Navigate to Settings
   → Click "Settings" in sidebar

2. Scroll to bottom (Security section)
   → See three password fields

3. Fill in:
   Current:  myoldpass123
   New:      mynewpass456
   Confirm:  mynewpass456

4. Click "Change Password"
   → Dialog: "Are you sure?"
   → Click OK

5. Loading...
   → Spinner shows

6. Success!
   → "✓ Password changed successfully!"
   → Fields cleared

7. Logout?
   → Dialog: "Would you like to logout?"
   → Click OK to logout
   → Or Cancel to stay logged in

8. Done!
   → Can now login with new password
```

---

## Questions?

- Check CHANGE_PASSWORD_DOCS.md for technical details
- Run test-change-password.ps1 to verify it works
- Check browser console (F12) for any errors

---

**Remember:** Keep your new password safe and don't share it with anyone!
