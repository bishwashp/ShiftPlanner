import sys
import re
import os
from datetime import datetime, timedelta

# Force valid path relative to execution
MIGRATE_DIR = "../../migrate"

def log(msg):
    print(f"[DEBUG] {msg}")
    sys.stdout.flush()

def parse_ics(filename, shift_name):
    file_path = os.path.join(os.path.dirname(__file__), MIGRATE_DIR, filename)
    
    if not os.path.exists(file_path):
        log(f"File not found: {file_path}")
        # Try absolute path based on known structure
        file_path = os.path.join("/Users/bishwash/Documents/GitHub/ShiftPlanner/migrate", filename)
        if not os.path.exists(file_path):
            log(f"Still not found: {file_path}")
            return []

    log(f"Reading {filename}")
    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except Exception as e:
        log(f"Error reading file: {e}")
        return []

    events = content.split('BEGIN:VEVENT')
    log(f"Found {len(events)} event blocks")
    
    results = []
    
    for evt in events[1:]:
        summary_m = re.search(r'SUMMARY:(.*)', evt)
        start_m = re.search(r'DTSTART(?:;VALUE=DATE)?:(\d{8})', evt)
        end_m = re.search(r'DTEND(?:;VALUE=DATE)?:(\d{8})', evt)

        if not summary_m or not start_m:
            continue

        summary = summary_m.group(1).strip()
        if 'OOO' in summary or '+' in summary:
            continue

        start_str = start_m.group(1)
        try:
            start_date = datetime.strptime(start_str, '%Y%m%d')
        except ValueError:
            continue

        if start_date.year != 2026:
            continue
        
        # Only Jan/Feb
        if start_date.month > 2:
            continue

        if end_m:
            end_date = datetime.strptime(end_m.group(1), '%Y%m%d') - timedelta(days=1)
        else:
            end_date = start_date

        current = start_date
        while current <= end_date:
            dow = current.weekday()
            if dow == 5 or dow == 6: # Sat/Sun
                results.append({
                    'date': current.strftime('%Y-%m-%d'),
                    'day': 'Sun' if dow == 6 else 'Sat',
                    'name': summary,
                    'shift': shift_name
                })
            current += timedelta(days=1)

    log(f"-> Extracted {len(results)} weekend shifts")
    return results

print("Starting analysis...")
all_ops = []
all_ops.extend(parse_ics('AMR AM Analysts.ics', 'AM'))
all_ops.extend(parse_ics('AMR PM Analysts.ics', 'PM'))

all_ops.sort(key=lambda x: (x['date'], x['shift']))

print('\nDate       | Day | Shift | Name')
print('-----------|-----|-------|------')
for r in all_ops:
    print(f"{r['date']} | {r['day']} | {r['shift']}    | {r['name']}")
