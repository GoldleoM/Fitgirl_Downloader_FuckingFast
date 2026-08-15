#!/usr/bin/env python3
"""
Maintenance Mode Timer Script for FitGirl Website
Run this to put the website in maintenance mode with a countdown timer.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "maintenance_config.json"
FRONTEND_CONFIG_DIR = Path(__file__).parent / "frontend" / "public"
FRONTEND_CONFIG_FILE = FRONTEND_CONFIG_DIR / "maintenance.json"

DEFAULT_DURATION_HOURS = 24


def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)
    # Also write to frontend public folder for the React app to read
    FRONTEND_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(FRONTEND_CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)


def clear_config():
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    if FRONTEND_CONFIG_FILE.exists():
        FRONTEND_CONFIG_FILE.unlink()


def start_maintenance(hours=None, message=None):
    """Start maintenance mode with specified duration."""
    if hours is None:
        hours = DEFAULT_DURATION_HOURS
    
    start_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    end_time = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat().replace('+00:00', 'Z')
    
    config = {
        "active": True,
        "start_time": start_time,
        "end_time": end_time,
        "duration_hours": hours,
        "message": message or f"Website will be back in {{time_remaining}}"
    }
    
    save_config(config)
    
    print(f"[OK] Maintenance mode STARTED")
    print(f"   Duration: {hours} hours")
    print(f"   Started:  {start_time}")
    print(f"   Ends:     {end_time}")
    print(f"   Config saved to: {CONFIG_FILE}")
    print(f"   Frontend config: {FRONTEND_CONFIG_FILE}")
    print(f"\n[WEB] Website now shows countdown timer.")
    print(f"[TIME] Will auto-recover after {hours} hours.")


def stop_maintenance():
    """Stop maintenance mode immediately."""
    clear_config()
    print("[OK] Maintenance mode STOPPED")
    print("[WEB] Website restored to normal.")


def status():
    """Show current maintenance status."""
    config = load_config()
    
    if not config or not config.get('active'):
        print("[INFO] Maintenance mode: INACTIVE")
        print("[WEB] Website is running normally.")
        return
    
    try:
        end_time = datetime.fromisoformat(config['end_time'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if now >= end_time:
            print("[WARN] Maintenance mode: EXPIRED (should auto-recover)")
            print("   Timer has ended but config not cleared.")
        else:
            remaining = end_time - now
            hours = int(remaining.total_seconds() // 3600)
            minutes = int((remaining.total_seconds() % 3600) // 60)
            seconds = int(remaining.total_seconds() % 60)
            
            print(f"[ACTIVE] Maintenance mode: ACTIVE")
            print(f"   Started:  {config['start_time']}")
            print(f"   Ends:     {config['end_time']}")
            print(f"   Remaining: {hours}h {minutes}m {seconds}s")
            print(f"   Duration: {config.get('duration_hours', '?')} hours")
    except Exception as e:
        print(f"[ERROR] Error reading config: {e}")


def extend_maintenance(hours):
    """Extend current maintenance by additional hours."""
    config = load_config()
    
    if not config or not config.get('active'):
        print("[ERROR] No active maintenance to extend. Use 'start' instead.")
        return
    
    try:
        current_end = datetime.fromisoformat(config['end_time'].replace('Z', '+00:00'))
        new_end = current_end + timedelta(hours=hours)
        config['end_time'] = new_end.isoformat().replace('+00:00', 'Z')
        config['duration_hours'] = config.get('duration_hours', 0) + hours
        save_config(config)
        
        print(f"[OK] Maintenance EXTENDED by {hours} hours")
        print(f"   New end time: {config['end_time']}")
    except Exception as e:
        print(f"[ERROR] Error extending maintenance: {e}")


def show_countdown():
    """Display live countdown in terminal."""
    config = load_config()
    
    if not config or not config.get('active'):
        print("ℹ️  No active maintenance.")
        return
    
    try:
        end_time = datetime.fromisoformat(config['end_time'].replace('Z', '+00:00'))
        
        print(f"🔴 Maintenance Countdown (Press Ctrl+C to stop watching)")
        print(f"   Ends: {config['end_time']}")
        print()
        
        while True:
            now = datetime.utcnow()
            if now >= end_time:
                print("\n⏰ TIME'S UP! Maintenance should auto-recover.")
                break
            
            remaining = end_time - now
            hours = int(remaining.total_seconds() // 3600)
            minutes = int((remaining.total_seconds() % 3600) // 60)
            seconds = int(remaining.total_seconds() % 60)
            
            # Colorful output
            if hours > 1:
                color = '\033[92m'  # Green
            elif hours > 0:
                color = '\033[93m'  # Yellow
            else:
                color = '\033[91m'  # Red
            
            reset = '\033[0m'
            sys.stdout.write(f'\r{color}[TIMER] {hours:02d}:{minutes:02d}:{seconds:02d} remaining{reset}   ')
            sys.stdout.flush()
            time.sleep(1)
        
        print()
    except KeyboardInterrupt:
        print("\n[BYE] Stopped watching.")
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nUsage:")
        print("  python maintenance_mode.py start [hours] [message]")
        print("  python maintenance_mode.py stop")
        print("  python maintenance_mode.py status")
        print("  python maintenance_mode.py extend [hours]")
        print("  python maintenance_mode.py watch")
        print("\nExamples:")
        print("  python maintenance_mode.py start 24")
        print("  python maintenance_mode.py start 48 \"Server maintenance\"")
        print("  python maintenance_mode.py stop")
        print("  python maintenance_mode.py extend 12")
        return
    
    cmd = sys.argv[1].lower()
    
    if cmd == 'start':
        hours = int(sys.argv[2]) if len(sys.argv) > 2 else None
        message = sys.argv[3] if len(sys.argv) > 3 else None
        start_maintenance(hours, message)
    elif cmd == 'stop':
        stop_maintenance()
    elif cmd == 'status':
        status()
    elif cmd == 'extend':
        hours = int(sys.argv[2]) if len(sys.argv) > 2 else 24
        extend_maintenance(hours)
    elif cmd == 'watch':
        show_countdown()
    else:
        print(f"[ERROR] Unknown command: {cmd}")
        print("Use: start, stop, status, extend, watch")


if __name__ == '__main__':
    main()