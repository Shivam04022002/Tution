# Demo Accounts Seed Scripts

Complete demo data setup for testing Parent and Teacher Dashboards.

---

## 📦 Deliverables

1. **`seedDemoAccounts.ts`** - TypeScript seed script (Recommended)
2. **`mongodb-insert-demo.js`** - MongoDB shell script for direct insertion
3. **`README.md`** - This documentation file

---

## 🎯 Demo Accounts

### Demo Parent
| Field | Value |
|-------|-------|
| **Role** | parent |
| **Name** | Demo Parent |
| **Mobile** | 9999999991 |
| **Email** | parent@test.com |
| **Password** | Parent@123 |

**Student Details:**
- Name: Rahul
- Class: 10
- Board: CBSE
- Subjects: Mathematics, Science
- Mode: Home Tuition
- Budget: ₹5000
- City: Kanpur

### Demo Teacher
| Field | Value |
|-------|-------|
| **Role** | teacher |
| **Name** | Demo Teacher |
| **Mobile** | 9999999992 |
| **Email** | teacher@test.com |
| **Password** | Teacher@123 |

**Profile Details:**
- Qualification: B.Tech
- Experience: 5 years
- Subjects: Mathematics, Science
- Classes: 8-10
- Board: CBSE
- Teaching Mode: Home Tuition
- Pricing: ₹5000/month
- Verification: Approved

---

## 🚀 Usage

### Method 1: TypeScript Seed Script (Recommended)

#### Prerequisites
- Node.js installed
- MongoDB running
- Dependencies installed (`npm install`)

#### Steps

1. **Navigate to backend directory:**
```bash
cd d:\Tution\backend
```

2. **Ensure environment variables are set:**
```bash
# .env file should contain:
MONGODB_URI=mongodb://localhost:27017/tuition_app
JWT_SECRET=your_jwt_secret
```

3. **Run the seed script:**

**Option A - Using ts-node (if installed):**
```bash
npx ts-node src/scripts/seedDemoAccounts.ts
```

**Option B - Using compiled JavaScript:**
```bash
# First build the project
npm run build

# Then run the compiled script
node dist/scripts/seedDemoAccounts.js
```

**Option C - Using npm script:**
Add to `package.json`:
```json
{
  "scripts": {
    "seed:demo": "ts-node src/scripts/seedDemoAccounts.ts"
  }
}
```
Then run:
```bash
npm run seed:demo
```

---

### Method 2: MongoDB Shell Script

#### Prerequisites
- MongoDB installed
- mongosh or mongo shell available

#### Steps

1. **Navigate to scripts directory:**
```bash
cd d:\Tution\backend\src\scripts
```

2. **Run the MongoDB script:**

**Using mongosh (MongoDB 5.0+):**
```bash
mongosh "mongodb://localhost:27017/tuition_app" < mongodb-insert-demo.js
```

**Using legacy mongo shell:**
```bash
mongo "mongodb://localhost:27017/tuition_app" < mongodb-insert-demo.js
```

3. **Update passwords with bcrypt hash:**

⚠️ **IMPORTANT:** The MongoDB script uses placeholder password hashes. You MUST update them with proper bcrypt hashes:

```javascript
// Connect to MongoDB
mongosh "mongodb://localhost:27017/tuition_app"

// In MongoDB shell:
use tuition_app

// Update parent password
db.users.updateOne(
  { email: "parent@test.com" },
  { $set: { password: "$2a$10$YourActualBcryptHashHere" } }
)

// Update teacher password
db.users.updateOne(
  { email: "teacher@test.com" },
  { $set: { password: "$2a$10$YourActualBcryptHashHere" } }
)
```

To generate bcrypt hashes:
```bash
# In Node.js
node -e "console.log(require('bcryptjs').hashSync('Parent@123', 10))"
node -e "console.log(require('bcryptjs').hashSync('Teacher@123', 10))"
```

---

## 🧪 Verification Steps

### 1. Backend API Test

Start the backend server:
```bash
cd d:\Tution\backend
npm run dev
```

#### Test Parent Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrMobile": "parent@test.com",
    "password": "Parent@123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbG...",
  "user": {
    "id": "...",
    "email": "parent@test.com",
    "role": "parent",
    "profileCompleted": true,
    "onboardingCompleted": true
  }
}
```

#### Test Teacher Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrMobile": "teacher@test.com",
    "password": "Teacher@123"
  }'
```

---

### 2. Database Verification

Connect to MongoDB and verify:

```bash
mongosh "mongodb://localhost:27017/tuition_app"
```

```javascript
// Check users
db.users.find({ email: { $in: ["parent@test.com", "teacher@test.com"] } })

// Check parent requirement
db.parentrequirements.findOne({ "studentDetails.studentName": "Rahul" })

// Check teacher profile
db.teacherprofiles.findOne({ "basicDetails.fullName": "Demo Teacher" })

// Check tutor match
db.tutormatches.findOne({ overallScore: 92 })

// Check tutor application
db.tutorapplications.findOne({ status: "pending" })

// Check demo class
db.democlasses.findOne({ "studentDetails.studentName": "Rahul" })
```

---

### 3. Mobile App Test

#### Test Parent Dashboard

1. **Launch the mobile app**
2. **Navigate to Login screen**
3. **Enter credentials:**
   - Email: `parent@test.com`
   - Password: `Parent@123`
4. **Tap Login**

**Expected Result:**
- Login successful
- Redirected to Parent Dashboard
- Dashboard displays:
  - Student: Rahul (Class 10, CBSE)
  - Subjects: Mathematics, Science
  - Matches: 1 tutor found (Demo Teacher)
  - Applications: 1 pending
  - Demo Class: Scheduled for tomorrow

#### Test Teacher Dashboard

1. **Logout or clear app data**
2. **Navigate to Login screen**
3. **Enter credentials:**
   - Email: `teacher@test.com`
   - Password: `Teacher@123`
4. **Tap Login**

**Expected Result:**
- Login successful
- Redirected to Teacher Dashboard
- Dashboard displays:
  - Profile: Demo Teacher (B.Tech, 5 years exp)
  - Subjects: Mathematics, Science
  - Matches: 1 requirement (Rahul)
  - Applications: 1 pending application
  - Demo Class: Scheduled for tomorrow

---

## 📊 Data Relationships

```
┌─────────────────┐         ┌──────────────────┐
│  Demo Parent    │         │  Demo Teacher    │
│  (User)         │         │  (User)          │
│  ID: parent_123 │         │  ID: teacher_456 │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│ParentRequirement│         │  TeacherProfile  │
│  ID: req_789    │         │  ID: prof_abc    │
│  Student: Rahul │         │  B.Tech, 5 yrs   │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         └──────────┬────────────────┘
                    │
         ┌──────────▼──────────┐
         │    TutorMatch       │
         │    ID: mat_xyz      │
         │    Score: 92%       │
         │    Status: rec.     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  TutorApplication   │
         │    ID: app_123      │
         │    Status: pending  │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │     DemoClass       │
         │    ID: demo_456     │
         │    Status: sched.   │
         │    Date: Tomorrow   │
         └─────────────────────┘
```

---

## 🔄 Re-running the Script

The seed script is **idempotent** - it will:
1. Clear existing demo data (if present)
2. Create fresh demo accounts
3. Re-establish all relationships

Simply run the script again to reset to initial state.

---

## 🛠️ Troubleshooting

### Issue: "Cannot find module 'bcryptjs'"
**Solution:** Install dependencies
```bash
cd d:\Tution\backend
npm install
```

### Issue: "MongoDB connection failed"
**Solution:** Ensure MongoDB is running
```bash
# Check MongoDB service status
# Windows: Services → MongoDB Server
# Or start manually:
net start MongoDB
```

### Issue: "Login returns 'Invalid credentials'"
**Solution:** Password hash mismatch. Update passwords:
```javascript
// In MongoDB shell
use tuition_app

// Generate hash in Node.js first:
// node -e "console.log(require('bcryptjs').hashSync('Parent@123', 10))"

// Then update
db.users.updateOne(
  { email: "parent@test.com" },
  { $set: { password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" } }
)
```

### Issue: "Dashboard shows no data"
**Solution:** Check data relationships
```javascript
// Verify all data exists
db.users.countDocuments()
db.parentrequirements.countDocuments()
db.teacherprofiles.countDocuments()
db.tutormatches.countDocuments()
db.tutorapplications.countDocuments()
db.democlasses.countDocuments()
```

---

## 📝 Notes

- **No production logic modified** - These scripts only insert data
- **Safe to run multiple times** - Clears old demo data before inserting
- **Passwords are hashed** using bcrypt (10 salt rounds)
- **DemoClass scheduled for tomorrow** - Updates automatically based on current date
- **TutorMatch score: 92%** - High match for demonstration purposes

---

## 📧 Support

For issues or questions:
1. Check MongoDB connection
2. Verify environment variables
3. Review console output for specific errors
4. Ensure all dependencies are installed
