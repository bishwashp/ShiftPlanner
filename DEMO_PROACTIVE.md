# Proactive Analysis Demo

This demonstrates how to safely use the new proactive analysis feature without breaking existing functionality.

## ✅ Safety Verification

First, let's verify that the existing system works perfectly without proactive analysis:

### 1. Normal Operations Work
```bash
# Your existing endpoints still work exactly the same
curl http://localhost:4000/api/
curl http://localhost:4000/api/analysts
curl http://localhost:4000/api/schedules
```

### 2. GraphQL Still Works
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ analysts { id name email } }"}'
```

### 3. Proactive Analysis is Safely Disabled
```bash
# This will show the feature is available but disabled by default
curl http://localhost:4000/api/proactive/status
```

Expected response:
```json
{
  "success": true,
  "data": {
    "initialized": false,
    "isRunning": false,
    "isEnabled": false,
    "message": "Proactive analysis not available"
  }
}
```

## 🧠 Enable Proactive Analysis

Now let's safely enable the proactive analysis:

### 1. Check System Status
```bash
curl http://localhost:4000/api/proactive/test
```

### 2. Enable Proactive Analysis
```bash
curl -X POST http://localhost:4000/api/proactive/enable
```

Expected response:
```json
{
  "success": true,
  "message": "Proactive analysis enabled successfully"
}
```

### 3. Verify It's Running
```bash
curl http://localhost:4000/api/proactive/status
```

Now you should see:
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "isRunning": true,
    "isEnabled": true,
    "config": { ... },
    "adaptiveThresholds": { ... },
    "lastUpdate": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🎯 Test Proactive Analysis

With the system running, it will now:

1. **Monitor continuously** (every 30 seconds)
   - Check for potential conflicts
   - Monitor analyst burnout risk
   
2. **Analyze hourly**
   - Review workload balance
   - Check fairness metrics
   
3. **Generate insights daily**
   - Identify optimization opportunities
   - Suggest improvements

### Check for Alerts
Your existing alert system will now include proactive alerts:

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ dashboard { alerts { id type message severity timestamp } } }"}'
```

### View Analysis Results
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ proactiveAnalysisStatus { performance { totalActions successRates } } }"}'
```

## ⚙️ Customize Configuration

Adjust what gets analyzed and how aggressively:

```bash
curl -X POST http://localhost:4000/api/proactive/config \
  -H "Content-Type: application/json" \
  -d '{
    "enabledAnalysis": {
      "burnoutPrevention": true,
      "fairnessOptimization": true,
      "conflictPrediction": true,
      "workloadBalancing": false,
      "scheduleOptimization": false
    },
    "autoApplyThresholds": {
      "minConfidence": 0.95,
      "maxRisk": 0.1
    }
  }'
```

This configuration:
- Enables burnout prevention, fairness optimization, and conflict prediction
- Disables workload balancing and schedule optimization (for safety)
- Requires 95% confidence before auto-applying actions
- Sets maximum risk tolerance to 10%

## 🛡️ Safety Features in Action

### 1. Error Isolation
Try breaking the proactive analysis:
```bash
# Even if this fails, your main system keeps working
curl -X POST http://localhost:4000/api/proactive/config \
  -H "Content-Type: application/json" \
  -d '{"invalid": "config"}'
```

Your existing scheduling endpoints remain functional:
```bash
curl http://localhost:4000/api/schedules
# Still works perfectly
```

### 2. Graceful Degradation
If proactive analysis encounters any issues, it logs errors but doesn't break your system.

### 3. Easy Disable
```bash
curl -X POST http://localhost:4000/api/proactive/disable
```

Everything returns to exactly how it was before.

## 📊 Real-World Example

Let's create a scenario to see proactive analysis in action:

### 1. Create Some Test Data
```bash
# Add a few analysts
curl -X POST http://localhost:4000/api/analysts \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice@example.com", "shiftType": "MORNING"}'

curl -X POST http://localhost:4000/api/analysts \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob Smith", "email": "bob@example.com", "shiftType": "EVENING"}'
```

### 2. Create Some Schedules
```bash
# Generate schedules that might be unbalanced
curl -X POST http://localhost:4000/api/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-15",
    "endDate": "2024-01-28",
    "algorithmType": "weekend-rotation"
  }'
```

### 3. Let Proactive Analysis Run
Wait a few minutes (or check immediately):

```bash
curl http://localhost:4000/api/proactive/status
```

You might see the system has:
- Detected fairness issues
- Identified optimization opportunities
- Generated suggestions for improvement

### 4. View Generated Alerts
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ dashboard { alerts { message severity actionable suggestedActions } } }"}'
```

## 🎯 Benefits Demonstrated

With proactive analysis enabled, you get:

1. **Early Warning System**: Conflicts detected before they become problems
2. **Fairness Monitoring**: Automatic detection of unequal workload distribution
3. **Burnout Prevention**: Alerts when analysts are overworked
4. **Optimization Suggestions**: Data-driven recommendations for improvement
5. **Machine Learning**: System learns from outcomes and improves over time

## 🔄 Return to Normal

At any point, disable proactive analysis to return to exactly the original system:

```bash
curl -X POST http://localhost:4000/api/proactive/disable
```

Your scheduling system continues to work exactly as it did before, with all existing functionality preserved.

## 🚀 Next Steps

1. **Start Conservative**: Use high confidence thresholds initially
2. **Monitor Performance**: Check the status endpoint regularly
3. **Review Suggestions**: Look at generated alerts and optimization opportunities
4. **Gradually Increase Automation**: Lower confidence thresholds as you gain trust
5. **Customize for Your Needs**: Adjust configuration based on your specific requirements

The beauty of this system is that it **enhances** your existing scheduling without **replacing** anything. You get all the benefits of intelligent analysis while keeping the reliability of your current system.