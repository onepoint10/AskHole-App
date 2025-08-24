import hashlib
import re
from flask import request
from user_agents import parse

def generate_device_fingerprint():
    """Generate a unique device fingerprint based on request data"""
    # Get user agent
    user_agent_string = request.headers.get('User-Agent', '')
    
    # Get IP address
    ip_address = get_client_ip()
    
    # Get other headers that can help identify the device
    accept_language = request.headers.get('Accept-Language', '')
    accept_encoding = request.headers.get('Accept-Encoding', '')
    
    # Create a fingerprint string
    fingerprint_data = f"{user_agent_string}|{ip_address}|{accept_language}|{accept_encoding}"
    
    # Generate hash
    fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()
    
    return fingerprint

def get_client_ip():
    """Get the real IP address of the client"""
    # Check for forwarded headers (common with proxies)
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def parse_user_agent(user_agent_string):
    """Parse user agent string to extract device information"""
    try:
        ua = parse(user_agent_string)
        
        # Determine device type
        if ua.is_mobile:
            device_type = 'mobile'
        elif ua.is_tablet:
            device_type = 'tablet'
        else:
            device_type = 'desktop'
        
        # Create device name
        browser_name = ua.browser.family if ua.browser.family else 'Unknown Browser'
        os_name = ua.os.family if ua.os.family else 'Unknown OS'
        device_name = f"{browser_name} on {os_name}"
        
        # Add device model if available
        if ua.device.family and ua.device.family != 'Other':
            device_name += f" ({ua.device.family})"
        
        return {
            'device_type': device_type,
            'device_name': device_name,
            'browser': browser_name,
            'os': os_name,
            'is_mobile': ua.is_mobile,
            'is_tablet': ua.is_tablet,
            'is_desktop': ua.is_desktop
        }
    except Exception:
        # Fallback if parsing fails
        return {
            'device_type': 'unknown',
            'device_name': 'Unknown Device',
            'browser': 'Unknown',
            'os': 'Unknown',
            'is_mobile': False,
            'is_tablet': False,
            'is_desktop': True
        }

def get_device_info_from_request():
    """Extract device information from the current request"""
    user_agent_string = request.headers.get('User-Agent', '')
    device_info = parse_user_agent(user_agent_string)
    
    return {
        'device_id': generate_device_fingerprint(),
        'device_name': device_info['device_name'],
        'device_type': device_info['device_type'],
        'user_agent': user_agent_string,
        'ip_address': get_client_ip(),
        'browser': device_info['browser'],
        'os': device_info['os']
    }