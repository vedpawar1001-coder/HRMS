const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  punches: [{
    punchType: { type: String, enum: ['Punch In', 'Punch Out'], required: true },
    time: { type: Date, required: true },
    location: {
      type: String,
      required: true
    },
    locationName: {
      type: String // City name like "Pune", "Nashik"
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    locationName: {
      type: String // City name like "Pune", "Nashik"
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    device: String,
    ip: String
  }],
  totalWorkingHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Short Hours', 'Late Entry', 'Early Exit', 'Missing Punch Out', 'Running Out of Time', 'Complete', 'Holiday Worked'],
    default: 'Absent'
  },
  firstPunchIn: Date,
  lastPunchOut: Date,
  isLateEntry: { type: Boolean, default: false },
  isEarlyExit: { type: Boolean, default: false },
  notificationsSent: {
    runningOutOfTime: { type: Boolean, default: false },
    shortHours: { type: Boolean, default: false }
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayName: String,
  overtime: {
    type: Number,
    default: 0
  },
  calculatedAt: Date
}, {
  timestamps: true
});

// Index for quick lookups
attendanceSchema.index({ employeeId: 1, date: 1 });

// Calculate working hours with advanced logic
attendanceSchema.methods.calculateWorkingHours = function() {
  // Reset flags at the start - they should only reflect current state
  this.isLateEntry = false;
  this.isEarlyExit = false;
  
  if (!this.punches || this.punches.length === 0) {
    this.status = 'Absent';
    this.totalWorkingHours = 0;
    return 0;
  }

  // Sort punches by time
  const sortedPunches = [...this.punches].sort((a, b) => new Date(a.time) - new Date(b.time));
  
  let totalHours = 0;
  this.firstPunchIn = sortedPunches[0]?.time || null;
  
  // Get the last punch to determine current state
  const lastPunch = sortedPunches[sortedPunches.length - 1];
  this.lastPunchOut = lastPunch?.punchType === 'Punch Out' ? lastPunch.time : null;

  // Check first punch in for late entry (only between 10:15 AM - 10:35 AM)
  // Only relevant if first punch was a Punch In
  if (this.firstPunchIn && sortedPunches[0]?.punchType === 'Punch In') {
    const firstPunchTime = new Date(this.firstPunchIn);
    
    // Late entry window: 10:15 AM - 10:35 AM
    const lateWindowStart = new Date(firstPunchTime);
    lateWindowStart.setHours(10, 15, 0, 0); // 10:15 AM
    
    const lateWindowEnd = new Date(firstPunchTime);
    lateWindowEnd.setHours(10, 35, 0, 0); // 10:35 AM
    
    // Only set isLateEntry if punch time is between 10:15 AM and 10:35 AM
    if (firstPunchTime >= lateWindowStart && firstPunchTime <= lateWindowEnd) {
      this.isLateEntry = true;
    } else {
      this.isLateEntry = false;
    }
  }

  // Check last punch out for early exit
  // Only relevant if last punch was a Punch Out
  // Early Exit warning shows ONLY when punch out is between 6:50 PM and 7:00 PM
  // Do NOT show warning if punching out before 6:50 PM or at/after 7:00 PM
  if (lastPunch?.punchType === 'Punch Out' && this.lastPunchOut) {
    const lastPunchTime = new Date(this.lastPunchOut);
    
    // Extract hours and minutes for time comparison
    const punchHour = lastPunchTime.getHours();
    const punchMinute = lastPunchTime.getMinutes();
    const punchSeconds = lastPunchTime.getSeconds();
    const punchTimeInMinutes = punchHour * 60 + punchMinute + punchSeconds / 60;
    
    // Time thresholds in minutes since midnight
    const earlyExitWindowStartMinutes = 18 * 60 + 50; // 6:50 PM = 1130 minutes
    const earlyExitWindowEndMinutes = 19 * 60; // 7:00 PM = 1140 minutes
    
    // Early Exit: Only if punch out is between 6:50 PM (inclusive) and before 7:00 PM (exclusive)
    if (punchTimeInMinutes >= earlyExitWindowStartMinutes && punchTimeInMinutes < earlyExitWindowEndMinutes) {
      this.isEarlyExit = true;
      console.log(`[ATTENDANCE] ✅ Early Exit detected: Punched out at ${lastPunchTime.toLocaleTimeString()} (${punchHour}:${punchMinute.toString().padStart(2, '0')}) - between 6:50 PM and 7:00 PM`);
    } else {
      this.isEarlyExit = false;
      if (punchTimeInMinutes < earlyExitWindowStartMinutes) {
        console.log(`[ATTENDANCE] ❌ Punch out before 6:50 PM: ${lastPunchTime.toLocaleTimeString()} (${punchHour}:${punchMinute.toString().padStart(2, '0')}) - NO early exit warning`);
      } else {
        console.log(`[ATTENDANCE] ✅ Normal punch out: ${lastPunchTime.toLocaleTimeString()} (${punchHour}:${punchMinute.toString().padStart(2, '0')}) - at or after 7:00 PM - NO warning`);
      }
    }
  }

  // Calculate total working hours from all punch in/out pairs
  for (let i = 0; i < sortedPunches.length; i++) {
    if (sortedPunches[i].punchType === 'Punch In') {
      // Find the next punch out
      let punchOut = null;
      for (let j = i + 1; j < sortedPunches.length; j++) {
        if (sortedPunches[j].punchType === 'Punch Out') {
          punchOut = sortedPunches[j];
          break;
        }
      }
      
      if (punchOut) {
        const punchInTime = new Date(sortedPunches[i].time);
        const punchOutTime = new Date(punchOut.time);
        const hours = (punchOutTime - punchInTime) / (1000 * 60 * 60); // Convert to hours
        totalHours += hours;
      }
    }
  }
  
  this.totalWorkingHours = parseFloat(totalHours.toFixed(2));
  
  // Determine status based on working hours (reuse lastPunch from above)
  const isDayEnded = lastPunch?.punchType === 'Punch Out';
  
  if (!isDayEnded && this.totalWorkingHours > 0) {
    // Still at office
    if (this.totalWorkingHours < 9) {
      this.status = 'Running Out of Time';
    } else {
      this.status = 'Complete';
    }
  } else if (isDayEnded) {
    // Day ended
    if (this.totalWorkingHours < 9) {
      this.status = 'Running Out of Time';
    } else if (this.totalWorkingHours >= 9) {
      this.status = 'Complete';
    }
    
    // Check for early exit
    if (this.isEarlyExit) {
      this.status = 'Early Exit';
    }
  } else {
    this.status = 'Absent';
  }
  
  // Check for late entry
  if (this.isLateEntry && this.status !== 'Absent') {
    if (this.status === 'Complete' || this.status === 'Running Out of Time') {
      // Keep the status but mark as late
    } else {
      this.status = 'Late Entry';
    }
  }
  
  // Check for overtime
  if (this.totalWorkingHours > 9) {
    this.overtime = parseFloat((this.totalWorkingHours - 9).toFixed(2));
  } else {
    this.overtime = 0;
  }
  
  this.calculatedAt = new Date();
  return this.totalWorkingHours;
};

module.exports = mongoose.model('Attendance', attendanceSchema);

