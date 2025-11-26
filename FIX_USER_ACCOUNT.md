# Fix User Account Issues

## Problem: User Exists but Can't Login

If you see "User already exists" when registering but "Invalid credentials" when logging in, the user account might have been created with a corrupted password.

## Solution Options:

### Option 1: Delete the Existing User (Recommended)

You can delete the existing user and register again. Use one of these methods:

#### Method A: Using API (Easy)
1. Make sure backend server is running
2. Open Postman, curl, or any API client
3. Send DELETE request to:
   ```
   DELETE http://localhost:5000/api/auth/delete-user
   Content-Type: application/json
   
   {
     "email": "vedpawar292001@gmail.com"
   }
   ```
4. Then try registering again

#### Method B: Using MongoDB directly
1. Open MongoDB Compass or mongo shell
2. Connect to your database
3. Go to `users` collection
4. Delete the user document with email: `vedpawar292001@gmail.com`

### Option 2: Reset Password

Reset the password for the existing user:

1. Make sure backend server is running
2. Send POST request to:
   ```
   POST http://localhost:5000/api/auth/reset-password
   Content-Type: application/json
   
   {
     "email": "vedpawar292001@gmail.com",
     "newPassword": "123456789"
   }
   ```
3. Then try logging in with the new password

### Option 3: Quick Fix Script

I'll create a script to fix this automatically. Run:

```bash
node fix-user.js vedpawar292001@gmail.com 123456789
```

## Steps to Fix Your Account:

1. **Stop the backend server** (Ctrl+C)

2. **Delete the user from database** (choose one):
   
   **Option A: Using MongoDB Compass**
   - Open MongoDB Compass
   - Connect to: `mongodb://localhost:27017/hrms`
   - Find `users` collection
   - Delete document with email: `vedpawar292001@gmail.com`

   **Option B: Using mongo shell**
   ```bash
   mongo
   use hrms
   db.users.deleteOne({email: "vedpawar292001@gmail.com"})
   exit
   ```

3. **Start backend server again**

4. **Register again** with the same email and password

5. **Login** - it should work now!

## Prevention:

The code has been fixed to:
- Normalize emails to lowercase
- Better password validation
- Better error messages
- Proper password hashing

After fixing, future registrations should work correctly.

