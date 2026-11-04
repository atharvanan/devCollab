import urllib.request
import json
import sys

BASE_URL = 'http://localhost:5000/api/v1'

def test_logout_endpoints():
    print("Testing /auth/logout endpoint...")
    
    # 1. Test logout without token
    req = urllib.request.Request(
        f'{BASE_URL}/auth/logout',
        data=b'{}',
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            assert data.get('success') is True, f"Expected success: true, got {data}"
            print("[PASS] 1. Logout without token succeeds with 200 OK")
    except Exception as e:
        print(f"[FAIL] 1. Logout without token failed: {e}")
        return False

    # 2. Test logout with invalid/expired token
    req2 = urllib.request.Request(
        f'{BASE_URL}/auth/logout',
        data=b'{}',
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.fake'
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req2) as resp:
            data = json.loads(resp.read().decode())
            assert resp.status == 200, f"Expected 200, got {resp.status}"
            assert data.get('success') is True, f"Expected success: true, got {data}"
            print("[PASS] 2. Logout with expired/invalid token succeeds gracefully with 200 OK")
    except Exception as e:
        print(f"[FAIL] 2. Logout with invalid token failed: {e}")
        return False

    # 3. Test bot login then logout with valid token
    login_payload = json.dumps({'email': 'lucas.devops@devcollab.com', 'password': 'DevCollab123!'}).encode()
    login_req = urllib.request.Request(
        f'{BASE_URL}/auth/login',
        data=login_payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(login_req) as resp:
            login_data = json.loads(resp.read().decode())
            token = login_data['data']['accessToken']
            cookie = resp.headers.get('Set-Cookie', '')
            print("[PASS] 3a. Bot login succeeded, obtained token")
            
            logout_req = urllib.request.Request(
                f'{BASE_URL}/auth/logout',
                data=b'{}',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {token}',
                    'Cookie': cookie
                },
                method='POST'
            )
            with urllib.request.urlopen(logout_req) as logout_resp:
                logout_data = json.loads(logout_resp.read().decode())
                assert logout_resp.status == 200
                assert logout_data.get('success') is True
                print("[PASS] 3b. Logout with authenticated bot user succeeds with 200 OK")
    except Exception as e:
        print(f"[FAIL] 3. Login/logout test failed: {e}")
        return False

    print("\nALL LOGOUT TESTS PASSED!")
    return True

if __name__ == '__main__':
    ok = test_logout_endpoints()
    sys.exit(0 if ok else 1)
