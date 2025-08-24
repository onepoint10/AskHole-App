#!/usr/bin/env python3

import requests
import json
import time

BASE_URL = "http://localhost:5000/api"

def test_device_persistence():
    print("Testing Device Persistence Functionality")
    print("=" * 50)
    
    # Test 1: Register a new user with remember me
    print("\n1. Testing user registration with remember me...")
    register_data = {
        "username": "testuser",
        "email": "test@example.com", 
        "password": "testpass123",
        "remember_me": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
        print(f"Registration response status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Registration successful!")
            print(f"   User: {data.get('user', {}).get('username')}")
            print(f"   Session ID: {data.get('session_id')}")
            print(f"   Device Info: {data.get('device_info')}")
            
            session_id = data.get('session_id')
            session_cookie = response.cookies.get('session')
            
            # Test 2: Check authentication
            print("\n2. Testing authentication check...")
            headers = {'Authorization': f'Bearer {session_id}'}
            auth_response = requests.get(f"{BASE_URL}/auth/check", headers=headers)
            print(f"Auth check status: {auth_response.status_code}")
            
            if auth_response.status_code == 200:
                auth_data = auth_response.json()
                print(f"✅ Authentication successful!")
                print(f"   Authenticated: {auth_data.get('authenticated')}")
                print(f"   User: {auth_data.get('user', {}).get('username')}")
            
            # Test 3: Get device sessions
            print("\n3. Testing device sessions retrieval...")
            devices_response = requests.get(f"{BASE_URL}/auth/devices", headers=headers)
            print(f"Devices response status: {devices_response.status_code}")
            
            if devices_response.status_code == 200:
                devices_data = devices_response.json()
                devices = devices_data.get('devices', [])
                print(f"✅ Found {len(devices)} device session(s)")
                
                for i, device in enumerate(devices, 1):
                    print(f"   Device {i}:")
                    print(f"     - Name: {device.get('device_name')}")
                    print(f"     - Type: {device.get('device_type')}")
                    print(f"     - Remember Me: {device.get('is_remember_me')}")
                    print(f"     - Last Used: {device.get('last_used')}")
                    print(f"     - Expires: {device.get('expires_at')}")
            
            # Test 4: Login again (should reuse existing session)
            print("\n4. Testing login with same device (should reuse session)...")
            login_data = {
                "username": "testuser",
                "password": "testpass123",
                "remember_me": True
            }
            
            login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
            print(f"Login response status: {login_response.status_code}")
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                print(f"✅ Login successful!")
                print(f"   Session ID: {login_data.get('session_id')}")
                print(f"   Device Info: {login_data.get('device_info')}")
                
                # Check if it's the same session
                if login_data.get('session_id') == session_id:
                    print("   ✅ Same session reused (device persistence working!)")
                else:
                    print("   ⚠️  New session created")
            
            # Test 5: Test session renewal
            print("\n5. Testing session renewal...")
            time.sleep(1)  # Small delay
            renewal_response = requests.get(f"{BASE_URL}/auth/check", headers=headers)
            print(f"Renewal check status: {renewal_response.status_code}")
            
            if renewal_response.status_code == 200:
                print("✅ Session renewal working!")
            
        else:
            print(f"❌ Registration failed: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure the backend is running on port 5000.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_device_persistence()