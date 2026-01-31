# MongoDB Atlas Trigger Configuration

## Monthly Investigation Counter Reset Trigger

This document describes how to set up an Atlas Scheduled Trigger to automatically archive previous month's investigations and reset counters on the 1st of every month.

---

## 1. Create the Scheduled Trigger in MongoDB Atlas

1. Go to your MongoDB Atlas project
2. Navigate to **App Services** (or **Triggers** if using the legacy interface)
3. Click **Add Trigger** → Select **Scheduled**

### Trigger Configuration:

| Setting | Value |
|---------|-------|
| **Name** | `monthly_investigation_reset` |
| **Schedule Type** | Advanced |
| **Cron Expression** | `0 0 1 * *` (Runs at 00:00 UTC on the 1st of every month) |
| **Linked Database** | Your database (e.g., `repo-podcast`) |

---

## 2. Trigger Function Code

Paste the following JavaScript code into the trigger function:

```javascript
/**
 * MongoDB Atlas Scheduled Trigger: Monthly Investigation Reset
 * 
 * Runs on the 1st of every month at 00:00 UTC.
 * 
 * Actions:
 * 1. Archives all users' current month investigations to cold_cases collection
 * 2. Clears the investigations array for active users
 * 3. Logs the archive operation for audit trail
 */
exports = async function() {
  const serviceName = "mongodb-atlas"; // Your Atlas service name
  const dbName = "repo-podcast"; // Your database name
  
  const mongodb = context.services.get(serviceName);
  const db = mongodb.db(dbName);
  
  const usersCollection = db.collection("users");
  const coldCasesCollection = db.collection("cold_cases");
  const auditLogCollection = db.collection("audit_log");
  
  const now = new Date();
  const archiveDate = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Get the previous month for labeling
  const prevMonth = new Date(archiveDate);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const monthLabel = prevMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  console.log(`[Monthly Reset] Starting archive for: ${monthLabel}`);
  
  try {
    // Step 1: Find all users with investigations
    const usersWithInvestigations = await usersCollection.find({
      investigations: { $exists: true, $not: { $size: 0 } }
    }).toArray();
    
    console.log(`[Monthly Reset] Found ${usersWithInvestigations.length} users with investigations`);
    
    let totalArchived = 0;
    
    // Step 2: Archive each user's investigations
    for (const user of usersWithInvestigations) {
      const investigations = user.investigations || [];
      
      if (investigations.length > 0) {
        // Create archive document
        const archiveDoc = {
          userId: user._id,
          userEmail: user.email,
          userName: user.name,
          badgeId: user.badgeId || user.email,
          monthLabel: monthLabel,
          archiveDate: archiveDate,
          investigationCount: investigations.length,
          investigations: investigations,
          archivedAt: now
        };
        
        // Insert into cold_cases
        await coldCasesCollection.insertOne(archiveDoc);
        totalArchived += investigations.length;
        
        console.log(`[Monthly Reset] Archived ${investigations.length} investigations for user: ${user.email}`);
      }
    }
    
    // Step 3: Clear investigations array for all users
    const clearResult = await usersCollection.updateMany(
      { investigations: { $exists: true } },
      {
        $set: {
          investigations: [],
          monthlyInvestigationCount: 0,
          lastResetDate: now
        }
      }
    );
    
    console.log(`[Monthly Reset] Cleared investigations for ${clearResult.modifiedCount} users`);
    
    // Step 4: Log the operation
    const auditLog = {
      operation: "monthly_investigation_reset",
      monthArchived: monthLabel,
      usersProcessed: usersWithInvestigations.length,
      totalInvestigationsArchived: totalArchived,
      usersCleared: clearResult.modifiedCount,
      executedAt: now,
      status: "success"
    };
    
    await auditLogCollection.insertOne(auditLog);
    
    console.log(`[Monthly Reset] ✅ Complete! Archived ${totalArchived} investigations from ${usersWithInvestigations.length} users`);
    
    return {
      success: true,
      monthArchived: monthLabel,
      investigationsArchived: totalArchived,
      usersProcessed: usersWithInvestigations.length
    };
    
  } catch (error) {
    console.error(`[Monthly Reset] ❌ Error: ${error.message}`);
    
    // Log the error
    await auditLogCollection.insertOne({
      operation: "monthly_investigation_reset",
      monthArchived: monthLabel,
      executedAt: now,
      status: "error",
      errorMessage: error.message
    });
    
    throw error;
  }
};
```

---

## 3. Required Collections

The trigger expects these collections to exist (they will be created automatically on first write):

### `users` Collection
The main user collection with the following relevant fields:
```json
{
  "_id": "ObjectId",
  "email": "string",
  "name": "string",
  "badgeId": "string",
  "investigations": [
    {
      "id": "string",
      "repoUrl": "string",
      "repoName": "string",
      "timestamp": "Date",
      "podcastId": "string"
    }
  ],
  "monthlyInvestigationCount": "number",
  "lastResetDate": "Date"
}
```

### `cold_cases` Collection (Archive)
Stores historical investigation data:
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "userEmail": "string",
  "userName": "string",
  "badgeId": "string",
  "monthLabel": "string (e.g., 'January 2026')",
  "archiveDate": "Date",
  "investigationCount": "number",
  "investigations": "array",
  "archivedAt": "Date"
}
```

### `audit_log` Collection
Tracks all automated operations:
```json
{
  "_id": "ObjectId",
  "operation": "string",
  "monthArchived": "string",
  "usersProcessed": "number",
  "totalInvestigationsArchived": "number",
  "executedAt": "Date",
  "status": "string ('success' | 'error')",
  "errorMessage": "string (optional)"
}
```

---

## 4. Indexes (Recommended)

Create these indexes for optimal performance:

```javascript
// cold_cases collection
db.cold_cases.createIndex({ userId: 1, archiveDate: -1 });
db.cold_cases.createIndex({ monthLabel: 1 });

// audit_log collection  
db.audit_log.createIndex({ operation: 1, executedAt: -1 });

// users collection (if not exists)
db.users.createIndex({ email: 1 }, { unique: true });
```

---

## 5. Testing the Trigger

You can manually test the trigger in Atlas App Services:

1. Go to your trigger in the Atlas dashboard
2. Click the "Run" button to execute immediately
3. Check the logs for output

Or use the following aggregation to preview what would be archived:

```javascript
db.users.aggregate([
  { $match: { investigations: { $exists: true, $not: { $size: 0 } } } },
  { 
    $project: {
      email: 1,
      investigationCount: { $size: "$investigations" },
      investigations: 1
    }
  }
]);
```

---

## 6. Monitoring

Monitor the trigger execution in:
- **Atlas App Services** → **Logs** (for function execution logs)
- **audit_log** collection (for historical records)

Set up alerts in Atlas for:
- Trigger failures
- Unusual archive volumes
- Missing monthly runs

---

## Notes

- The trigger uses UTC timezone (00:00 UTC on the 1st)
- If the trigger fails, it will be retried automatically by Atlas
- Cold cases are kept indefinitely for historical reference
- Users can still view their archived investigations via the cold_cases collection
