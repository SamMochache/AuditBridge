"""
Complete API Testing Script for AuditBridge
Run this to test all authentication and payment endpoints

Usage:
    python test_api.py

Requirements:
    - Backend server running: python manage.py runserver
    - Seed data loaded: python manage.py seed_data --clear
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"

# Test credentials (from seed data)
ADMIN_CREDENTIALS = {
    "username": "admin",
    "password": "admin123"
}

ACCOUNTANT_CREDENTIALS = {
    "username": "accountant",
    "password": "accountant123"
}


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")


def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")


def print_error(text):
    print(f"{Colors.RED}✗ {text}{Colors.END}")


def print_info(text):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.END}")


def print_response(response, show_body=True):
    """Pretty print API response"""
    status = response.status_code
    color = Colors.GREEN if 200 <= status < 300 else Colors.RED
    
    print(f"{color}Status: {status}{Colors.END}")
    
    if show_body:
        try:
            data = response.json()
            print(json.dumps(data, indent=2))
        except:
            print(response.text)


# ===================== TEST FUNCTIONS =====================

def test_login(credentials):
    """Test login endpoint"""
    print_header("Testing Login")
    
    url = f"{API_URL}/auth/login/"
    print_info(f"POST {url}")
    print_info(f"Credentials: {credentials['username']}")
    
    response = requests.post(url, json=credentials)
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        print_success("Login successful!")
        print_info(f"User: {data['user']['first_name']} {data['user']['last_name']}")
        print_info(f"Role: {data['user']['role']}")
        print_info(f"School: {data['user']['school_name']}")
        return data['access']
    else:
        print_error("Login failed!")
        return None


def test_profile(token):
    """Test get user profile"""
    print_header("Testing User Profile")
    
    url = f"{API_URL}/auth/profile/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_response(response)
    
    return response.status_code == 200


def test_dashboard_stats(token):
    """Test dashboard statistics"""
    print_header("Testing Dashboard Statistics")
    
    url = f"{API_URL}/payments/dashboard/stats/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        print_success("Dashboard stats retrieved!")
        print_info(f"Total Students: {data['students']['total_students']}")
        print_info(f"Total Collected: KES {data['payments']['total_collected']:,.2f}")
        print_info(f"Outstanding: KES {data['fees']['outstanding_balance']:,.2f}")
        print_info(f"Collection Rate: {data['fees']['collection_rate']}%")
        return True
    
    return False


def test_payment_list(token):
    """Test payment list endpoint"""
    print_header("Testing Payment List")
    
    url = f"{API_URL}/payments/list/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Retrieved {data['count']} payments")
        
        if data['results']:
            print_info("First payment:")
            payment = data['results'][0]
            print(f"  - Transaction: {payment['transaction_code']}")
            print(f"  - Amount: KES {payment['amount']}")
            print(f"  - Status: {payment['status']}")
            print(f"  - Student: {payment['student_name'] or 'Unknown'}")
        return True
    else:
        print_response(response)
        return False


def test_student_list(token):
    """Test student list endpoint"""
    print_header("Testing Student List")
    
    url = f"{API_URL}/payments/students/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Retrieved {data['count']} students")
        
        if data['results']:
            print_info("First 3 students:")
            for student in data['results'][:3]:
                print(f"  - {student['first_name']} {student['last_name']} ({student['student_id']})")
                print(f"    Class: {student['class_name']}")
                print(f"    Balance: KES {student['outstanding_balance']:,.2f}")
                print(f"    Status: {student['payment_status']}")
        return True
    else:
        print_response(response)
        return False


def test_student_search(token):
    """Test student search"""
    print_header("Testing Student Search")
    
    url = f"{API_URL}/payments/students/?search=NA20260001"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    print_info("Searching for: NA20260001")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            student = data['results'][0]
            print_success("Student found!")
            print(f"  Name: {student['first_name']} {student['last_name']}")
            print(f"  ID: {student['student_id']}")
            print(f"  Balance: KES {student['outstanding_balance']:,.2f}")
            return True
        else:
            print_error("Student not found")
            return False
    else:
        print_response(response)
        return False


def test_reconcile(token):
    """Test manual reconciliation trigger"""
    print_header("Testing Manual Reconciliation")
    
    url = f"{API_URL}/payments/reconcile/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"POST {url}")
    response = requests.post(url, headers=headers)
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        print_success("Reconciliation completed!")
        print_info(f"Total: {data['summary']['total']}")
        print_info(f"Matched: {data['summary']['matched']}")
        print_info(f"Failed: {data['summary']['failed']}")
        return True
    
    return False


def test_unmatched_payments(token):
    """Test unmatched payments endpoint"""
    print_header("Testing Unmatched Payments")
    
    url = f"{API_URL}/payments/unmatched/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Retrieved {data['count']} failed payments")
        
        if data['results']:
            print_info("Failed payments:")
            for payment in data['results'][:5]:
                print(f"  - {payment['transaction_code']}: {payment['error_message']}")
        return True
    else:
        print_response(response)
        return False


def test_class_balances(token):
    """Test class balances endpoint"""
    print_header("Testing Class Balances")
    
    url = f"{API_URL}/payments/dashboard/class-balances/"
    headers = {"Authorization": f"Bearer {token}"}
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Retrieved {len(data)} classes")
        
        print_info("Class balances:")
        for cls in data:
            print(f"  {cls['name']}:")
            print(f"    Students: {cls['student_count']}")
            print(f"    Expected: KES {cls['total_expected']:,.2f}")
            print(f"    Paid: KES {cls['total_paid']:,.2f}")
            print(f"    Outstanding: KES {cls['outstanding_balance']:,.2f}")
        return True
    else:
        print_response(response)
        return False


def test_unauthorized_access():
    """Test that endpoints require authentication"""
    print_header("Testing Unauthorized Access")
    
    url = f"{API_URL}/payments/dashboard/stats/"
    
    print_info(f"GET {url} (without token)")
    response = requests.get(url)
    
    if response.status_code == 401:
        print_success("Correctly blocked unauthorized access")
        return True
    else:
        print_error(f"Expected 401, got {response.status_code}")
        return False


def run_all_tests():
    """Run all API tests"""
    print_header("AUDITBRIDGE API TEST SUITE")
    print_info(f"Testing against: {BASE_URL}")
    print_info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Test 1: Unauthorized access
    results['unauthorized'] = test_unauthorized_access()
    
    # Test 2: Login as admin
    admin_token = test_login(ADMIN_CREDENTIALS)
    if not admin_token:
        print_error("Admin login failed - stopping tests")
        return
    
    # Test 3: Profile
    results['profile'] = test_profile(admin_token)
    
    # Test 4: Dashboard stats
    results['dashboard'] = test_dashboard_stats(admin_token)
    
    # Test 5: Payment list
    results['payment_list'] = test_payment_list(admin_token)
    
    # Test 6: Student list
    results['student_list'] = test_student_list(admin_token)
    
    # Test 7: Student search
    results['student_search'] = test_student_search(admin_token)
    
    # Test 8: Reconciliation
    results['reconcile'] = test_reconcile(admin_token)
    
    # Test 9: Unmatched payments
    results['unmatched'] = test_unmatched_payments(admin_token)
    
    # Test 10: Class balances
    results['class_balances'] = test_class_balances(admin_token)
    
    # Print summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print_success("\n🎉 ALL TESTS PASSED! Backend is ready for frontend integration.")
    else:
        print_error(f"\n⚠️  {total - passed} test(s) failed. Please check the errors above.")


if __name__ == "__main__":
    try:
        run_all_tests()
    except requests.exceptions.ConnectionError:
        print_error("\n❌ Cannot connect to backend server!")
        print_info("Make sure the server is running: python manage.py runserver")
    except Exception as e:
        print_error(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()