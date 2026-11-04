with open('scratch/qa_hierarchy_sla_test.py', 'r', encoding='utf-8') as f:
    code = f.read()

old_pm = """    # 1. Login or Register PM (Lead Project Manager)
    print("\\n[STEP 1] Authenticate Project Manager (Lead PM)...")
    pm_email = 'lead.pm@devcollab.com'
    pm_pass = 'DevCollab123!'
    status, pm_res = api_call('/auth/login', 'POST', {'email': pm_email, 'password': pm_pass})
    
    if status == 200 and pm_res.get('data', {}).get('accessToken'):
        pm_token = pm_res['data']['accessToken']
        pm_user = pm_res['data']['user']
    else:
        # Register new PM
        reg_status, reg_res = api_call('/auth/register', 'POST', {
            'name': 'Sarah Connor (Lead PM)',
            'email': pm_email,
            'password': pm_pass,
            'role': 'project_manager'
        })
        # Verify OTP
        otp_status, otp_res = api_call('/auth/verify-otp', 'POST', {
            'email': pm_email,
            'otp': '123456'
        })
        if otp_status != 200 or not otp_res.get('data', {}).get('accessToken'):
            print(f"[FAIL] PM registration/OTP failed: status={otp_status}, res={otp_res}")
            return False
        pm_token = otp_res['data']['accessToken']
        pm_user = otp_res['data']['user']
    print(f"[PASS] PM Authenticated: {pm_user.get('name')} ({pm_user.get('email')})")"""

new_pm = """    # 1. Login as Project Manager (Sarah Chen - Project Owner & PM)
    print("\\n[STEP 1] Authenticate Project Manager (Sarah Chen)...")
    status, pm_res = api_call('/auth/login', 'POST', {
        'email': 'sarah.backend@devcollab.com',
        'password': 'DevCollab123!'
    })
    if status != 200 or not pm_res.get('data', {}).get('accessToken'):
        print(f"[FAIL] PM login failed: status={status}, response={pm_res}")
        return False
    pm_token = pm_res['data']['accessToken']
    pm_user = pm_res['data']['user']
    print(f"[PASS] PM Authenticated: {pm_user.get('name')} ({pm_user.get('email')})")"""

if old_pm in code:
    code = code.replace(old_pm, new_pm)
    with open('scratch/qa_hierarchy_sla_test.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated QA test with Sarah Chen as PM")
else:
    print("WARNING: old_pm not matched")

